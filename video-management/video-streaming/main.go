package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "path/filepath"
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

func NewStreamHub() *StreamHub {
    return &StreamHub{streams: make(map[string]*Stream)}
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

type MinioConfig struct {
    Endpoint  string
    AccessKey string
    SecretKey string
    Bucket    string
    Secure    bool
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

func main() {
    minioConfig := loadMinioConfig()
    minioClient, err := minio.New(minioConfig.Endpoint, &minio.Options{
        Creds:  credentials.NewStaticV4(minioConfig.AccessKey, minioConfig.SecretKey, ""),
        Secure: minioConfig.Secure,
    })
    if err != nil {
        log.Fatalf("minio client init failed: %v", err)
    }

    if err := ensureBucket(context.Background(), minioClient, minioConfig.Bucket); err != nil {
        log.Fatalf("minio bucket setup failed: %v", err)
    }

    hub := NewStreamHub()

    httpServer := &http.Server{
        Addr:    ":8083",
        Handler: buildHTTPHandler(hub, minioClient, minioConfig.Bucket),
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

func buildHTTPHandler(hub *StreamHub, minioClient *minio.Client, bucket string) http.Handler {
    mux := http.NewServeMux()

    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
    })

    mux.HandleFunc("/streams", func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/streams" {
            http.NotFound(w, r)
            return
        }
        writeJSON(w, http.StatusOK, map[string]any{"streams": hub.List()})
    })

    mux.HandleFunc("/streams/", func(w http.ResponseWriter, r *http.Request) {
        if !strings.HasSuffix(r.URL.Path, "/object") {
            http.NotFound(w, r)
            return
        }

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
    })

    return mux
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
