package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/nareix/joy4/av"
	"github.com/nareix/joy4/format/flv"
	"github.com/nareix/joy4/format/rtmp"
)

type Stream struct {
	headers      []av.CodecData
	subscribers  map[chan av.Packet]struct{}
	closed       chan struct{}
	mu           sync.RWMutex
	lastObject   string
	lastUploaded time.Time
}

func NewStream(headers []av.CodecData) *Stream {
	return &Stream{
		headers:     headers,
		subscribers: make(map[chan av.Packet]struct{}),
		closed:      make(chan struct{}),
	}
}

func (s *Stream) Headers() []av.CodecData {
	return s.headers
}

func (s *Stream) Subscribe() chan av.Packet {
	ch := make(chan av.Packet, 1024)
	s.mu.Lock()
	s.subscribers[ch] = struct{}{}
	s.mu.Unlock()
	return ch
}

func (s *Stream) Unsubscribe(ch chan av.Packet) {
	s.mu.Lock()
	if _, ok := s.subscribers[ch]; ok {
		delete(s.subscribers, ch)
		close(ch)
	}
	s.mu.Unlock()
}

func (s *Stream) Broadcast(pkt av.Packet) {
	s.mu.RLock()
	for ch := range s.subscribers {
		select {
		case ch <- pkt:
		default:
		}
	}
	s.mu.RUnlock()
}

func (s *Stream) Close() {
	s.mu.Lock()
	for ch := range s.subscribers {
		close(ch)
	}
	s.subscribers = map[chan av.Packet]struct{}{}
	close(s.closed)
	s.mu.Unlock()
}

type StreamHub struct {
	streams map[string]*Stream
	mu      sync.RWMutex
}

type ActiveUDPStreams struct {
	streams map[string]time.Time
	mu      sync.RWMutex
}

func NewStreamHub() *StreamHub {
	return &StreamHub{streams: make(map[string]*Stream)}
}

func NewActiveUDPStreams() *ActiveUDPStreams {
	return &ActiveUDPStreams{streams: make(map[string]time.Time)}
}

func (h *StreamHub) Get(key string) (*Stream, bool) {
	h.mu.RLock()
	stream, ok := h.streams[key]
	h.mu.RUnlock()
	return stream, ok
}

func (h *StreamHub) Set(key string, stream *Stream) {
	h.mu.Lock()
	h.streams[key] = stream
	h.mu.Unlock()
}

func (h *StreamHub) Delete(key string) {
	h.mu.Lock()
	delete(h.streams, key)
	h.mu.Unlock()
}

func (h *StreamHub) List() []string {
	h.mu.RLock()
	keys := make([]string, 0, len(h.streams))
	for key := range h.streams {
		keys = append(keys, key)
	}
	h.mu.RUnlock()
	return keys
}

func (a *ActiveUDPStreams) Touch(streamID string) {
	a.mu.Lock()
	a.streams[streamID] = time.Now().UTC()
	a.mu.Unlock()
}

func (a *ActiveUDPStreams) Remove(streamID string) {
	a.mu.Lock()
	delete(a.streams, streamID)
	a.mu.Unlock()
}

func (a *ActiveUDPStreams) ListActive(ttl time.Duration) []string {
	now := time.Now().UTC()
	a.mu.Lock()
	keys := make([]string, 0, len(a.streams))
	for key, lastSeen := range a.streams {
		if now.Sub(lastSeen) > ttl {
			delete(a.streams, key)
			continue
		}
		keys = append(keys, key)
	}
	a.mu.Unlock()
	return keys
}

type MinioConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Secure    bool
}

const (
	udpMagic          = 0x45534431
	udpFlagEndOfSteam = 0x1
)

type udpChunkKey struct {
	streamID string
	seq      int
}

type udpPendingChunk struct {
	fragments map[int][]byte
	expected  int
	createdAt time.Time
}

type udpChunkAssembler struct {
	pending map[udpChunkKey]*udpPendingChunk
	mu      sync.Mutex
}

func newUDPChunkAssembler() *udpChunkAssembler {
	return &udpChunkAssembler{
		pending: make(map[udpChunkKey]*udpPendingChunk),
	}
}

func (a *udpChunkAssembler) addFragment(streamID string, seq int, fragIdx int, fragCount int, payload []byte) ([]byte, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	key := udpChunkKey{streamID: streamID, seq: seq}
	pending, ok := a.pending[key]
	if !ok {
		pending = &udpPendingChunk{
			fragments: make(map[int][]byte),
			expected:  fragCount,
			createdAt: time.Now().UTC(),
		}
		a.pending[key] = pending
	}

	if _, exists := pending.fragments[fragIdx]; !exists {
		copyPayload := make([]byte, len(payload))
		copy(copyPayload, payload)
		pending.fragments[fragIdx] = copyPayload
	}

	if len(pending.fragments) != pending.expected {
		return nil, false
	}

	indices := make([]int, 0, len(pending.fragments))
	for idx := range pending.fragments {
		indices = append(indices, idx)
	}
	sort.Ints(indices)

	total := 0
	for _, idx := range indices {
		total += len(pending.fragments[idx])
	}

	full := make([]byte, 0, total)
	for _, idx := range indices {
		full = append(full, pending.fragments[idx]...)
	}

	delete(a.pending, key)
	return full, true
}

func (a *udpChunkAssembler) cleanup(ttl time.Duration) {
	a.mu.Lock()
	defer a.mu.Unlock()

	now := time.Now().UTC()
	for key, pending := range a.pending {
		if now.Sub(pending.createdAt) > ttl {
			delete(a.pending, key)
		}
	}
}

func loadMinioConfig() MinioConfig {
	endpoint := os.Getenv("MINIO_ENDPOINT")
	port := os.Getenv("MINIO_PORT")
	if port == "" {
		port = "9000"
	}
	if endpoint == "" {
		endpoint = "video-storage"
	}
	secure := strings.ToLower(os.Getenv("MINIO_SECURE")) == "true"

	return MinioConfig{
		Endpoint:  fmt.Sprintf("%s:%s", endpoint, port),
		AccessKey: envOrDefault("MINIO_ACCESS_KEY", "minioadmin"),
		SecretKey: envOrDefault("MINIO_SECRET_KEY", "minioadmin"),
		Bucket:    envOrDefault("MINIO_BUCKET", "videos"),
		Secure:    secure,
	}
}

func envOrDefault(name, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	return value
}

func ensureBucket(ctx context.Context, client *minio.Client, bucket string) error {
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
}

func ensureBucketWithRetry(client *minio.Client, bucket string, attempts int, delay time.Duration) error {
	var lastErr error
	for i := 1; i <= attempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := ensureBucket(ctx, client, bucket)
		cancel()
		if err == nil {
			if i > 1 {
				log.Printf("minio became ready after %d attempts", i)
			}
			return nil
		}

		lastErr = err
		if i < attempts {
			log.Printf("minio not ready (attempt %d/%d): %v", i, attempts, err)
			time.Sleep(delay)
		}
	}

	return fmt.Errorf("minio bucket setup failed after %d attempts: %w", attempts, lastErr)
}

func main() {
	minioConfig := loadMinioConfig()
	minioClient, err := minio.New(minioConfig.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(minioConfig.AccessKey, minioConfig.SecretKey, ""),
		Secure: minioConfig.Secure,
	})
	if err != nil {
		log.Fatalf("minio client init failed: %v", err)
	}

	log.Printf("minio endpoint: %s", minioClient.EndpointURL())

	if err := ensureBucketWithRetry(minioClient, minioConfig.Bucket, 30, 2*time.Second); err != nil {
		log.Fatalf("minio bucket setup failed: %v", err)
	}

	hub := NewStreamHub()
	activeUDPStreams := NewActiveUDPStreams()

	go startUDPIngestServer(":5005", minioClient, minioConfig.Bucket, activeUDPStreams)

	httpServer := &http.Server{
		Addr:    ":8083",
		Handler: buildHTTPHandler(hub, activeUDPStreams, minioClient, minioConfig.Bucket),
	}
	go func() {
		log.Printf("http server listening on %s", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("http server error: %v", err)
		}
	}()

	rtmpServer := &rtmp.Server{
		Addr: ":1935",
		HandlePublish: func(conn *rtmp.Conn) {
			handlePublish(conn, hub, minioClient, minioConfig.Bucket)
		},
		HandlePlay: func(conn *rtmp.Conn) {
			handlePlay(conn, hub)
		},
	}

	log.Printf("rtmp server listening on %s", rtmpServer.Addr)
	if err := rtmpServer.ListenAndServe(); err != nil {
		log.Fatalf("rtmp server error: %v", err)
	}
}

func startUDPIngestServer(addr string, minioClient *minio.Client, bucket string, activeUDPStreams *ActiveUDPStreams) {
	conn, err := net.ListenPacket("udp", addr)
	if err != nil {
		log.Printf("udp ingest listen error: %v", err)
		return
	}
	defer conn.Close()

	assembler := newUDPChunkAssembler()
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			assembler.cleanup(2 * time.Minute)
		}
	}()

	buf := make([]byte, 65535)
	log.Printf("udp ingest listening on %s", addr)

	for {
		n, _, readErr := conn.ReadFrom(buf)
		if readErr != nil {
			log.Printf("udp read error: %v", readErr)
			continue
		}
		if n < 19 {
			continue
		}

		packet := buf[:n]
		magic := binary.BigEndian.Uint32(packet[0:4])
		if magic != udpMagic {
			continue
		}

		flags := packet[4]
		streamIDLen := int(binary.BigEndian.Uint16(packet[5:7]))
		seq := int(binary.BigEndian.Uint32(packet[7:11]))
		fragIdx := int(binary.BigEndian.Uint32(packet[11:15]))
		fragCount := int(binary.BigEndian.Uint32(packet[15:19]))

		headerSize := 19 + streamIDLen
		if n < headerSize || streamIDLen <= 0 {
			continue
		}

		streamID := string(packet[19:headerSize])
		payload := packet[headerSize:]

		if (flags & udpFlagEndOfSteam) != 0 {
			activeUDPStreams.Remove(streamID)
			uploadEndMarker(minioClient, bucket, streamID, seq)
			continue
		}

		activeUDPStreams.Touch(streamID)

		if fragCount <= 0 || fragIdx < 0 || fragIdx >= fragCount {
			continue
		}

		fullChunk, ready := assembler.addFragment(streamID, seq, fragIdx, fragCount, payload)
		if !ready {
			continue
		}

		objectName := fmt.Sprintf("udp/%s/chunk-%06d.webm", streamID, seq)
		_, uploadErr := minioClient.PutObject(context.Background(), bucket, objectName, bytes.NewReader(fullChunk), int64(len(fullChunk)), minio.PutObjectOptions{
			ContentType: "video/webm",
		})
		if uploadErr != nil {
			log.Printf("udp chunk upload error stream=%s seq=%d: %v", streamID, seq, uploadErr)
			continue
		}

		log.Printf("udp chunk uploaded stream=%s seq=%d size=%d", streamID, seq, len(fullChunk))
	}
}

func uploadEndMarker(minioClient *minio.Client, bucket string, streamID string, finalSeq int) {
	marker := map[string]any{
		"stream":        streamID,
		"finalSequence": finalSeq,
		"endedAt":       time.Now().UTC().Format(time.RFC3339),
	}

	content, err := json.Marshal(marker)
	if err != nil {
		log.Printf("udp end marker marshal error: %v", err)
		return
	}

	objectName := "udp/" + streamID + "/end-" + strconv.FormatInt(time.Now().UTC().Unix(), 10) + ".json"
	_, uploadErr := minioClient.PutObject(context.Background(), bucket, objectName, bytes.NewReader(content), int64(len(content)), minio.PutObjectOptions{
		ContentType: "application/json",
	})
	if uploadErr != nil {
		log.Printf("udp end marker upload error stream=%s: %v", streamID, uploadErr)
	}
}

func handlePublish(conn *rtmp.Conn, hub *StreamHub, minioClient *minio.Client, bucket string) {
	streamKey := streamKeyFromURL(conn.URL.Path)

	headers, err := conn.Streams()
	if err != nil {
		log.Printf("rtmp publish stream header error: %v", err)
		return
	}

	stream := NewStream(headers)
	hub.Set(streamKey, stream)

	tempFile, err := os.CreateTemp("", "stream-*.flv")
	if err != nil {
		log.Printf("stream temp file error: %v", err)
		hub.Delete(streamKey)
		return
	}
	defer func() {
		if err := os.Remove(tempFile.Name()); err != nil {
			log.Printf("temp cleanup error: %v", err)
		}
	}()

	muxer := flv.NewMuxer(tempFile)
	if err := muxer.WriteHeader(headers); err != nil {
		log.Printf("flv header error: %v", err)
		hub.Delete(streamKey)
		stream.Close()
		return
	}

	for {
		pkt, err := conn.ReadPacket()
		if err != nil {
			break
		}
		if err := muxer.WritePacket(pkt); err != nil {
			log.Printf("flv write error: %v", err)
			break
		}
		stream.Broadcast(pkt)
	}

	if err := tempFile.Close(); err != nil {
		log.Printf("stream close error: %v", err)
	}

	objectName := fmt.Sprintf("%s/%s.flv", streamKey, time.Now().UTC().Format("20060102-150405"))
	if _, err := minioClient.FPutObject(context.Background(), bucket, objectName, tempFile.Name(), minio.PutObjectOptions{
		ContentType: "video/x-flv",
	}); err != nil {
		log.Printf("minio upload error: %v", err)
	} else {
		stream.mu.Lock()
		stream.lastObject = objectName
		stream.lastUploaded = time.Now().UTC()
		stream.mu.Unlock()
	}

	hub.Delete(streamKey)
	stream.Close()
}

func handlePlay(conn *rtmp.Conn, hub *StreamHub) {
	streamKey := streamKeyFromURL(conn.URL.Path)
	stream, ok := hub.Get(streamKey)
	if !ok {
		log.Printf("stream not found: %s", streamKey)
		return
	}

	if err := conn.WriteHeader(stream.Headers()); err != nil {
		log.Printf("rtmp write header error: %v", err)
		return
	}

	ch := stream.Subscribe()
	defer stream.Unsubscribe(ch)

	for {
		select {
		case pkt, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WritePacket(pkt); err != nil {
				return
			}
		case <-stream.closed:
			return
		}
	}
}

func streamKeyFromURL(path string) string {
	key := strings.TrimPrefix(path, "/")
	if key == "" {
		key = "default"
	}
	return key
}

func buildHTTPHandler(hub *StreamHub, activeUDPStreams *ActiveUDPStreams, minioClient *minio.Client, bucket string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/ingest/chunk", func(w http.ResponseWriter, r *http.Request) {
		handleIngestChunk(w, r, activeUDPStreams, minioClient, bucket)
	})

	mux.HandleFunc("/ingest/end", func(w http.ResponseWriter, r *http.Request) {
		handleIngestEnd(w, r, activeUDPStreams, minioClient, bucket)
	})

	mux.HandleFunc("/ingest/final", func(w http.ResponseWriter, r *http.Request) {
		handleIngestFinal(w, r, minioClient, bucket)
	})

	mux.HandleFunc("/streams", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/streams" {
			http.NotFound(w, r)
			return
		}

		rtmpStreams := hub.List()
		udpStreams := activeUDPStreams.ListActive(15 * time.Second)

		combined := make([]string, 0, len(rtmpStreams)+len(udpStreams))
		seen := make(map[string]struct{})

		for _, stream := range rtmpStreams {
			if _, ok := seen[stream]; ok {
				continue
			}
			seen[stream] = struct{}{}
			combined = append(combined, stream)
		}

		for _, stream := range udpStreams {
			if _, ok := seen[stream]; ok {
				continue
			}
			seen[stream] = struct{}{}
			combined = append(combined, stream)
		}

		writeJSON(w, http.StatusOK, map[string]any{"streams": combined})
	})

	// HLS streaming endpoint for live videos
	mux.HandleFunc("/streams/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/object") {
			handleStreamObject(w, r, hub, minioClient, bucket)
		} else if strings.HasSuffix(r.URL.Path, "/hls/index.m3u8") {
			handleStreamHlsIndex(w, r, hub, activeUDPStreams)
		} else if strings.Contains(r.URL.Path, "/hls/") {
			handleStreamHlsSegment(w, r, minioClient, bucket)
		} else if strings.HasSuffix(r.URL.Path, "/recording") {
			handleStreamRecording(w, r, minioClient, bucket)
		} else if strings.HasSuffix(r.URL.Path, "/live") {
			handleStreamLive(w, r, hub)
		} else {
			http.NotFound(w, r)
		}
	})

	return mux
}

func handleStreamHlsIndex(w http.ResponseWriter, r *http.Request, hub *StreamHub, activeUDPStreams *ActiveUDPStreams) {
	key := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/hls/index.m3u8")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	_, activeInRTMP := hub.Get(key)
	active := activeInRTMP
	if !active {
		udpActive := activeUDPStreams.ListActive(15 * time.Second)
		for _, liveID := range udpActive {
			if liveID == key {
				active = true
				break
			}
		}
	}

	log.Printf("[HLS] manifest request stream=%s active=%t remote=%s query=%s", key, active, r.RemoteAddr, r.URL.RawQuery)

	playlist := strings.Builder{}
	playlist.WriteString("#EXTM3U\n")
	playlist.WriteString("#EXT-X-VERSION:3\n")
	playlist.WriteString("#EXT-X-TARGETDURATION:8\n")
	playlist.WriteString("#EXT-X-MEDIA-SEQUENCE:0\n")
	playlist.WriteString("#EXTINF:8.0,\n")
	playlist.WriteString("segment.webm?t=" + strconv.FormatInt(time.Now().UTC().UnixMilli(), 10) + "\n")
	if !active {
		playlist.WriteString("#EXT-X-ENDLIST\n")
	}

	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(playlist.String()))
}

func handleStreamHlsSegment(w http.ResponseWriter, r *http.Request, minioClient *minio.Client, bucket string) {
	prefix := strings.TrimPrefix(r.URL.Path, "/streams/")
	parts := strings.SplitN(prefix, "/hls/", 2)
	if len(parts) != 2 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	streamKey := parts[0]
	segmentName := parts[1]
	log.Printf("[HLS] segment request stream=%s segment=%s remote=%s query=%s", streamKey, segmentName, r.RemoteAddr, r.URL.RawQuery)
	streamRecordingContent(w, streamKey, minioClient, bucket)
}

func handleIngestChunk(w http.ResponseWriter, r *http.Request, activeUDPStreams *ActiveUDPStreams, minioClient *minio.Client, bucket string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(70 << 20); err != nil {
		http.Error(w, "invalid multipart payload", http.StatusBadRequest)
		return
	}

	liveID := r.FormValue("liveId")
	if liveID == "" {
		http.Error(w, "liveId is required", http.StatusBadRequest)
		return
	}

	sequenceText := r.FormValue("sequence")
	sequence, err := strconv.Atoi(sequenceText)
	if err != nil {
		http.Error(w, "invalid sequence", http.StatusBadRequest)
		return
	}

	chunkFile, _, err := r.FormFile("chunk")
	if err != nil {
		http.Error(w, "chunk is required", http.StatusBadRequest)
		return
	}
	defer chunkFile.Close()

	payload, err := io.ReadAll(chunkFile)
	if err != nil {
		http.Error(w, "failed to read chunk", http.StatusBadRequest)
		return
	}

	log.Printf("[INGEST] chunk received liveId=%s seq=%d bytes=%d remote=%s", liveID, sequence, len(payload), r.RemoteAddr)

	objectName := fmt.Sprintf("udp/%s/chunk-%06d.webm", liveID, sequence)
	_, err = minioClient.PutObject(context.Background(), bucket, objectName, bytes.NewReader(payload), int64(len(payload)), minio.PutObjectOptions{
		ContentType: "video/webm",
	})
	if err != nil {
		http.Error(w, "failed to persist chunk", http.StatusBadGateway)
		return
	}

	log.Printf("[INGEST] chunk persisted liveId=%s seq=%d object=%s", liveID, sequence, objectName)

	activeUDPStreams.Touch(liveID)

	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ACTIVE",
		"liveId":   liveID,
		"sequence": sequence,
	})
}

func handleIngestEnd(w http.ResponseWriter, r *http.Request, activeUDPStreams *ActiveUDPStreams, minioClient *minio.Client, bucket string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid json payload", http.StatusBadRequest)
		return
	}

	liveID, _ := payload["liveId"].(string)
	if liveID == "" {
		http.Error(w, "liveId is required", http.StatusBadRequest)
		return
	}

	finalSequence := 0
	if value, ok := payload["sequence"].(float64); ok {
		finalSequence = int(value)
	}

	log.Printf("[INGEST] end received liveId=%s finalSequence=%d remote=%s", liveID, finalSequence, r.RemoteAddr)

	uploadEndMarker(minioClient, bucket, liveID, finalSequence)
	activeUDPStreams.Remove(liveID)

	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "COMPLETED",
		"liveId":   liveID,
		"sequence": finalSequence,
	})
}

func handleIngestFinal(w http.ResponseWriter, r *http.Request, minioClient *minio.Client, bucket string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(800 << 20); err != nil {
		http.Error(w, "invalid multipart payload", http.StatusBadRequest)
		return
	}

	liveID := r.FormValue("liveId")
	if liveID == "" {
		http.Error(w, "liveId is required", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	payload, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "failed to read final recording", http.StatusBadRequest)
		return
	}

	log.Printf("[INGEST] final received liveId=%s bytes=%d remote=%s", liveID, len(payload), r.RemoteAddr)

	objectName := fmt.Sprintf("udp/%s/final.webm", liveID)
	_, err = minioClient.PutObject(context.Background(), bucket, objectName, bytes.NewReader(payload), int64(len(payload)), minio.PutObjectOptions{
		ContentType: "video/webm",
	})
	if err != nil {
		http.Error(w, "failed to persist final recording", http.StatusBadGateway)
		return
	}

	log.Printf("[INGEST] final persisted liveId=%s object=%s", liveID, objectName)

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "OK",
		"liveId": liveID,
		"object": objectName,
	})
}

func handleStreamObject(w http.ResponseWriter, r *http.Request, hub *StreamHub, minioClient *minio.Client, bucket string) {
	key := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/object")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	stream, ok := hub.Get(key)
	if !ok || stream.lastObject == "" {
		http.Error(w, "stream not found", http.StatusNotFound)
		return
	}

	url, err := minioClient.PresignedGetObject(context.Background(), bucket, stream.lastObject, time.Hour, nil)
	if err != nil {
		http.Error(w, "presign failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"object": stream.lastObject,
		"url":    url.String(),
	})
}

func handleStreamLive(w http.ResponseWriter, r *http.Request, hub *StreamHub) {
	key := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/live")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	_, ok := hub.Get(key)
	if !ok {
		http.Error(w, "stream not found or not live", http.StatusNotFound)
		return
	}

	// Return stream info and RTMP URL for client to connect
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "live",
		"stream": key,
		"rtmp":   "rtmp://video-streaming:1935/" + key,
	})
}

func handleStreamRecording(w http.ResponseWriter, r *http.Request, minioClient *minio.Client, bucket string) {
	key := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/streams/"), "/recording")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	log.Printf("[RECORDING] request stream=%s remote=%s query=%s", key, r.RemoteAddr, r.URL.RawQuery)

	streamRecordingContent(w, key, minioClient, bucket)
}

func streamRecordingContent(w http.ResponseWriter, key string, minioClient *minio.Client, bucket string) {

	finalObjectName := fmt.Sprintf("udp/%s/final.webm", key)
	if finalInfo, err := minioClient.StatObject(context.Background(), bucket, finalObjectName, minio.StatObjectOptions{}); err == nil && finalInfo.Size > 0 {
		log.Printf("[RECORDING] using final object stream=%s object=%s size=%d", key, finalObjectName, finalInfo.Size)
		obj, getErr := minioClient.GetObject(context.Background(), bucket, finalObjectName, minio.GetObjectOptions{})
		if getErr == nil {
			defer obj.Close()
			w.Header().Set("Content-Type", "video/webm")
			w.WriteHeader(http.StatusOK)
			written, copyErr := io.Copy(w, obj)
			if copyErr != nil {
				log.Printf("[RECORDING] final stream copy error stream=%s object=%s err=%v", key, finalObjectName, copyErr)
			} else {
				log.Printf("[RECORDING] final stream copy complete stream=%s object=%s bytes=%d", key, finalObjectName, written)
			}
			return
		}
		log.Printf("[RECORDING] failed opening final object stream=%s object=%s err=%v", key, finalObjectName, getErr)
	}

	prefix := fmt.Sprintf("udp/%s/", key)
	objects := minioClient.ListObjects(context.Background(), bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	chunkObjects := make([]string, 0)
	for objectInfo := range objects {
		if objectInfo.Err != nil {
			log.Printf("recording list error stream=%s: %v", key, objectInfo.Err)
			continue
		}

		if strings.HasPrefix(objectInfo.Key, prefix+"chunk-") && strings.HasSuffix(objectInfo.Key, ".webm") {
			chunkObjects = append(chunkObjects, objectInfo.Key)
		}
	}

	if len(chunkObjects) == 0 {
		log.Printf("[RECORDING] no chunks found stream=%s", key)
		http.Error(w, "recording not found", http.StatusNotFound)
		return
	}

	sort.Strings(chunkObjects)
	log.Printf("[RECORDING] concatenating chunks stream=%s count=%d", key, len(chunkObjects))
	w.Header().Set("Content-Type", "video/webm")
	w.WriteHeader(http.StatusOK)

	for _, objectName := range chunkObjects {
		object, err := minioClient.GetObject(context.Background(), bucket, objectName, minio.GetObjectOptions{})
		if err != nil {
			log.Printf("recording get object error stream=%s object=%s err=%v", key, objectName, err)
			continue
		}

		written, err := io.Copy(w, object)
		if err != nil {
			_ = object.Close()
			log.Printf("recording stream write error stream=%s object=%s err=%v", key, objectName, err)
			return
		}

		log.Printf("[RECORDING] chunk appended stream=%s object=%s bytes=%d", key, objectName, written)

		if err := object.Close(); err != nil {
			log.Printf("recording close object error stream=%s object=%s err=%v", key, objectName, err)
		}
	}

	log.Printf("[RECORDING] concatenation complete stream=%s", key)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

func safeFileName(name string) string {
	cleaned := filepath.Base(name)
	cleaned = strings.ReplaceAll(cleaned, "..", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "-")
	return cleaned
}
