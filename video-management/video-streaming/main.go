package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/nareix/joy4/av"
	"github.com/nareix/joy4/format/flv"
	"github.com/nareix/joy4/format/rtmp"
)

type stream struct {
	headers     []av.CodecData
	subscribers map[chan av.Packet]struct{}
	closed      chan struct{}
	mu          sync.RWMutex
}

type streamHub struct {
	streams map[string]*stream
	mu      sync.RWMutex
}

type minioConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Secure    bool
}

type serverConfig struct {
	RTMPApp          string
	RTMPPublicHost   string
	AllowedStreamKey map[string]struct{}
	BackendBaseURL   string
	InternalToken    string
}

func newStream(headers []av.CodecData) *stream {
	return &stream{
		headers:     headers,
		subscribers: map[chan av.Packet]struct{}{},
		closed:      make(chan struct{}),
	}
}

func newStreamHub() *streamHub {
	return &streamHub{streams: map[string]*stream{}}
}

func (h *streamHub) get(key string) (*stream, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	item, ok := h.streams[key]
	return item, ok
}

func (h *streamHub) set(key string, item *stream) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.streams[key] = item
}

func (h *streamHub) delete(key string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.streams, key)
}

func (h *streamHub) list() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	keys := make([]string, 0, len(h.streams))
	for key := range h.streams {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (s *stream) subscribe() chan av.Packet {
	ch := make(chan av.Packet, 1024)
	s.mu.Lock()
	s.subscribers[ch] = struct{}{}
	s.mu.Unlock()
	return ch
}

func (s *stream) unsubscribe(ch chan av.Packet) {
	s.mu.Lock()
	if _, ok := s.subscribers[ch]; ok {
		delete(s.subscribers, ch)
		close(ch)
	}
	s.mu.Unlock()
}

func (s *stream) broadcast(pkt av.Packet) {
	s.mu.RLock()
	for ch := range s.subscribers {
		select {
		case ch <- pkt:
		default:
		}
	}
	s.mu.RUnlock()
}

func (s *stream) close() {
	s.mu.Lock()
	for ch := range s.subscribers {
		close(ch)
	}
	s.subscribers = map[chan av.Packet]struct{}{}
	close(s.closed)
	s.mu.Unlock()
}

func loadMinioConfig() minioConfig {
	endpoint := os.Getenv("MINIO_ENDPOINT")
	port := os.Getenv("MINIO_PORT")
	if endpoint == "" {
		endpoint = "video-storage"
	}
	if port == "" {
		port = "9000"
	}

	secure := strings.ToLower(os.Getenv("MINIO_SECURE")) == "true"

	return minioConfig{
		Endpoint:  fmt.Sprintf("%s:%s", endpoint, port),
		AccessKey: envOrDefault("MINIO_ACCESS_KEY", "minioadmin"),
		SecretKey: envOrDefault("MINIO_SECRET_KEY", "minioadmin"),
		Bucket:    envOrDefault("MINIO_BUCKET", "videos"),
		Secure:    secure,
	}
}

func loadServerConfig() serverConfig {
	rtmpApp := envOrDefault("RTMP_APP", "live")
	rtmpPublicHost := envOrDefault("RTMP_PUBLIC_HOST", "localhost")

	allowedKeys := map[string]struct{}{}
	allowedKeysRaw := strings.TrimSpace(os.Getenv("RTMP_ALLOWED_STREAM_KEYS"))
	if allowedKeysRaw != "" {
		for _, key := range strings.Split(allowedKeysRaw, ",") {
			trimmed := strings.TrimSpace(key)
			if trimmed == "" {
				continue
			}
			allowedKeys[trimmed] = struct{}{}
		}
	}

	return serverConfig{
		RTMPApp:          rtmpApp,
		RTMPPublicHost:   rtmpPublicHost,
		AllowedStreamKey: allowedKeys,
		BackendBaseURL:   envOrDefault("BACKEND_BASE_URL", "http://backend:8080"),
		InternalToken:    envOrDefault("STREAMING_FINALIZATION_INTERNAL_TOKEN", "internal-stream-finalize-token"),
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
			return nil
		}
		lastErr = err
		time.Sleep(delay)
	}
	return fmt.Errorf("minio bucket setup failed after %d attempts: %w", attempts, lastErr)
}

func main() {
	cfg := loadMinioConfig()
	serverCfg := loadServerConfig()
	minioClient, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.Secure,
	})
	if err != nil {
		log.Fatalf("minio client init failed: %v", err)
	}

	if err := ensureBucketWithRetry(minioClient, cfg.Bucket, 30, 2*time.Second); err != nil {
		log.Fatalf("minio bucket setup failed: %v", err)
	}

	hub := newStreamHub()

	httpServer := &http.Server{
		Addr:    ":8083",
		Handler: buildHTTPHandler(hub, minioClient, cfg.Bucket, serverCfg),
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
			handlePublish(conn, hub, minioClient, cfg.Bucket, serverCfg)
		},
		HandlePlay: func(conn *rtmp.Conn) {
			handlePlay(conn, hub, serverCfg)
		},
	}

	log.Printf("rtmp server listening on %s", rtmpServer.Addr)
	if err := rtmpServer.ListenAndServe(); err != nil {
		log.Fatalf("rtmp server error: %v", err)
	}
}

func handlePublish(conn *rtmp.Conn, hub *streamHub, minioClient *minio.Client, bucket string, cfg serverConfig) {
	log.Printf("publish attempt path=%s", conn.URL.Path)
	startedAt := time.Now().UTC()
	streamKey, err := resolveStreamKey(conn.URL.Path, cfg)
	if err != nil {
		log.Printf("publish denied path=%s err=%v", conn.URL.Path, err)
		return
	}
	log.Printf("publish accepted app=%s key=%s", cfg.RTMPApp, streamKey)

	headers, err := conn.Streams()
	if err != nil {
		log.Printf("rtmp publish stream header error: %v", err)
		return
	}

	active := newStream(headers)
	hub.set(streamKey, active)

	tempFile, err := os.CreateTemp("", "stream-*.flv")
	if err != nil {
		log.Printf("stream temp file error: %v", err)
		hub.delete(streamKey)
		return
	}
	defer func() {
		_ = os.Remove(tempFile.Name())
	}()

	muxer := flv.NewMuxer(tempFile)
	if err := muxer.WriteHeader(headers); err != nil {
		log.Printf("flv header error: %v", err)
		hub.delete(streamKey)
		active.close()
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
		active.broadcast(pkt)
	}

	if err := tempFile.Close(); err != nil {
		log.Printf("stream close error: %v", err)
	}

	objectName := fmt.Sprintf("recordings/%s/%s.flv", streamKey, time.Now().UTC().Format("20060102-150405"))
	if _, err := minioClient.FPutObject(context.Background(), bucket, objectName, tempFile.Name(), minio.PutObjectOptions{
		ContentType: "video/x-flv",
	}); err != nil {
		log.Printf("minio upload error: %v", err)
	}

	duration := int64(time.Since(startedAt).Seconds())
	if err := notifyStreamFinalized(cfg, streamKey, objectName, duration); err != nil {
		log.Printf("stream finalize notify error key=%s err=%v", streamKey, err)
	} else {
		log.Printf("stream finalize notified key=%s object=%s", streamKey, objectName)
	}

	log.Printf("publish finished key=%s recording=%s", streamKey, objectName)

	hub.delete(streamKey)
	active.close()
}

func notifyStreamFinalized(cfg serverConfig, liveID string, storageObject string, durationSeconds int64) error {
	payload := map[string]any{
		"liveId":          liveID,
		"storageObject":   storageObject,
		"durationSeconds": durationSeconds,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequest(http.MethodPost, cfg.BackendBaseURL+"/api/internal/streams/finalized", bytes.NewReader(body))
	if err != nil {
		return err
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", cfg.InternalToken)

	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 300 {
		data, _ := io.ReadAll(response.Body)
		return fmt.Errorf("backend finalize status=%d body=%s", response.StatusCode, string(data))
	}

	return nil
}

func handlePlay(conn *rtmp.Conn, hub *streamHub, cfg serverConfig) {
	log.Printf("play attempt path=%s", conn.URL.Path)
	streamKey, err := resolveStreamKey(conn.URL.Path, cfg)
	if err != nil {
		log.Printf("play denied path=%s err=%v", conn.URL.Path, err)
		return
	}
	log.Printf("play accepted app=%s key=%s", cfg.RTMPApp, streamKey)

	active, ok := hub.get(streamKey)
	if !ok {
		log.Printf("stream not found: %s", streamKey)
		return
	}

	if err := conn.WriteHeader(active.headers); err != nil {
		log.Printf("rtmp write header error: %v", err)
		return
	}

	ch := active.subscribe()
	defer active.unsubscribe(ch)

	for {
		select {
		case pkt, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WritePacket(pkt); err != nil {
				return
			}
		case <-active.closed:
			return
		}
	}
}

func buildHTTPHandler(hub *streamHub, minioClient *minio.Client, bucket string, cfg serverConfig) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/streams", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/streams" {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"streams": hub.list()})
	})

	mux.HandleFunc("/obs/config", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/obs/config" {
			http.NotFound(w, r)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"server":              "rtmp://" + cfg.RTMPPublicHost + ":1935/" + cfg.RTMPApp,
			"streamKeyExample":    "sala-101",
			"playerExample":       "rtmp://" + cfg.RTMPPublicHost + ":1935/" + cfg.RTMPApp + "/sala-101",
			"requiresAllowedKeys": len(cfg.AllowedStreamKey) > 0,
		})
	})

	mux.HandleFunc("/diag/runtime", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/diag/runtime" {
			http.NotFound(w, r)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"rtmpListen":         ":1935",
			"httpListen":         ":8083",
			"rtmpApp":            cfg.RTMPApp,
			"rtmpPublicHost":     cfg.RTMPPublicHost,
			"activeStreams":      hub.list(),
			"allowedKeysEnabled": len(cfg.AllowedStreamKey) > 0,
			"allowedKeysCount":   len(cfg.AllowedStreamKey),
		})
	})

	mux.HandleFunc("/streams/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimSuffix(r.URL.Path, "/")
		r = cloneRequestWithPath(r, path)

		if strings.HasSuffix(path, "/flv") {
			handleStreamFlv(w, r, hub)
			return
		}
		if strings.HasSuffix(path, "/recording") {
			handleStreamRecording(w, r, minioClient, bucket)
			return
		}
		if strings.HasSuffix(path, "/live") {
			handleStreamLive(w, r, hub)
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/streaming/streams", func(w http.ResponseWriter, r *http.Request) {
		r = cloneRequestWithPath(r, strings.TrimPrefix(r.URL.Path, "/streaming"))
		if r.URL.Path != "/streams" {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"streams": hub.list()})
	})

	mux.HandleFunc("/streaming/streams/", func(w http.ResponseWriter, r *http.Request) {
		r = cloneRequestWithPath(r, strings.TrimPrefix(r.URL.Path, "/streaming"))
		path := strings.TrimSuffix(r.URL.Path, "/")
		r = cloneRequestWithPath(r, path)

		if strings.HasSuffix(path, "/flv") {
			handleStreamFlv(w, r, hub)
			return
		}
		if strings.HasSuffix(path, "/recording") {
			handleStreamRecording(w, r, minioClient, bucket)
			return
		}
		if strings.HasSuffix(path, "/live") {
			handleStreamLive(w, r, hub)
			return
		}
		http.NotFound(w, r)
	})

	return withRequestLogging(mux)
}

func cloneRequestWithPath(r *http.Request, path string) *http.Request {
	clone := r.Clone(r.Context())
	clone.URL.Path = path
	return clone
}

func withRequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		log.Printf("http request method=%s path=%s query=%s remote=%s", r.Method, r.URL.Path, r.URL.RawQuery, r.RemoteAddr)
		next.ServeHTTP(w, r)
		log.Printf("http response method=%s path=%s duration=%s", r.Method, r.URL.Path, time.Since(startedAt).String())
	})
}

func handleStreamLive(w http.ResponseWriter, r *http.Request, hub *streamHub) {
	path := strings.TrimSuffix(r.URL.Path, "/")
	key := strings.TrimSuffix(strings.TrimPrefix(path, "/streams/"), "/live")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	_, active := hub.get(key)
	if !active {
		http.Error(w, "stream not found or not live", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "live",
		"stream": key,
		"rtmp":   "rtmp://video-streaming:1935/live/" + key,
	})
}

func handleStreamRecording(w http.ResponseWriter, r *http.Request, minioClient *minio.Client, bucket string) {
	path := strings.TrimSuffix(r.URL.Path, "/")
	key := strings.TrimSuffix(strings.TrimPrefix(path, "/streams/"), "/recording")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	log.Printf("recording lookup started key=%s path=%s", key, path)

	prefix := fmt.Sprintf("recordings/%s/", key)
	objects := minioClient.ListObjects(context.Background(), bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true})

	candidates := make([]string, 0)
	for object := range objects {
		if object.Err != nil {
			continue
		}
		if strings.HasSuffix(object.Key, ".flv") {
			candidates = append(candidates, object.Key)
		}
	}

	if len(candidates) == 0 {
		log.Printf("recording lookup empty key=%s prefix=%s", key, prefix)
		http.Error(w, "recording not found", http.StatusNotFound)
		return
	}

	sort.Strings(candidates)
	latestObject := candidates[len(candidates)-1]
	obj, err := minioClient.GetObject(context.Background(), bucket, latestObject, minio.GetObjectOptions{})
	if err != nil {
		log.Printf("recording object open failed key=%s object=%s err=%v", key, latestObject, err)
		http.Error(w, "recording not found", http.StatusNotFound)
		return
	}
	defer obj.Close()
	log.Printf("recording streaming key=%s object=%s", key, latestObject)

	parts := strings.Split(latestObject, "/")
	fileName := parts[len(parts)-1]
	if !strings.HasSuffix(strings.ToLower(fileName), ".flv") {
		fileName = fileName + ".flv"
	}
	sanitizedKey := strings.ReplaceAll(key, "/", "-")
	if !strings.HasPrefix(fileName, sanitizedKey+"-") {
		fileName = sanitizedKey + "-" + fileName
	}

	w.Header().Set("Content-Type", "video/x-flv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"; filename*=UTF-8''%s", fileName, url.PathEscape(fileName)))
	w.Header().Set("X-Recording-Filename", fileName)
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, obj)
}

func handleStreamFlv(w http.ResponseWriter, r *http.Request, hub *streamHub) {
	path := strings.TrimSuffix(r.URL.Path, "/")
	key := strings.TrimSuffix(strings.TrimPrefix(path, "/streams/"), "/flv")
	if key == "" {
		http.NotFound(w, r)
		return
	}

	active, ok := hub.get(key)
	if !ok {
		http.Error(w, "stream not found or not live", http.StatusNotFound)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "video/x-flv")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	muxer := flv.NewMuxer(w)
	if err := muxer.WriteHeader(active.headers); err != nil {
		log.Printf("flv live header error stream=%s err=%v", key, err)
		return
	}
	flusher.Flush()

	ch := active.subscribe()
	defer active.unsubscribe(ch)

	for {
		select {
		case pkt, ok := <-ch:
			if !ok {
				return
			}
			if err := muxer.WritePacket(pkt); err != nil {
				log.Printf("flv live packet error stream=%s err=%v", key, err)
				return
			}
			flusher.Flush()
		case <-r.Context().Done():
			return
		case <-active.closed:
			return
		}
	}
}

func resolveStreamKey(path string, cfg serverConfig) (string, error) {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return "", errors.New("missing application and stream key")
	}

	parts := strings.Split(trimmed, "/")
	if len(parts) < 2 {
		return "", errors.New("expected /<app>/<streamKey>")
	}

	app := strings.TrimSpace(parts[0])
	streamKey := strings.TrimSpace(parts[1])
	if app == "" || streamKey == "" {
		return "", errors.New("invalid app or stream key")
	}

	if app != cfg.RTMPApp {
		return "", fmt.Errorf("invalid application %q, expected %q", app, cfg.RTMPApp)
	}

	if len(cfg.AllowedStreamKey) > 0 {
		if _, ok := cfg.AllowedStreamKey[streamKey]; !ok {
			return "", fmt.Errorf("stream key %q not allowed", streamKey)
		}
	}

	return streamKey, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("json encode error: %v", err)
	}
}
