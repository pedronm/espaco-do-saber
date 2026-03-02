Here we'll have a Go project that streams videos to clients. It accepts RTMP input, relays it live,
and stores completed streams in MinIO.

## Features
- RTMP ingest and live relay
- HTTP endpoints for stream listing and presigned MinIO URLs
- MinIO integration (S3 compatible)

## Getting Started

### Prerequisites
- Go 1.24+
- FFmpeg (for pushing RTMP)
- MinIO server

### Installation
```bash
go mod download
```

### Running
```bash
go run main.go
```

### Environment
```
MINIO_ENDPOINT=video-storage
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=videos
MINIO_SECURE=false
RTMP_APP=live
RTMP_PUBLIC_HOST=localhost
# Optional: comma-separated allowed keys (when set, unknown keys are rejected)
RTMP_ALLOWED_STREAM_KEYS=sala-101,sala-102
```

### RTMP Usage
Push a stream (example with FFmpeg):

```bash
ffmpeg -re -i /path/to/video.mp4 -c copy -f flv rtmp://localhost:1935/live/sala-101
```

In OBS:

```text
Server: rtmp://localhost:1935/live
Stream Key: sala-101
```

Play the stream from another client (VLC/FFplay):

```
rtmp://localhost:1935/live/sala-101
```

### HTTP Endpoints
```
GET /health
GET /streams
GET /obs/config
GET /streams/{key}/live
GET /streams/{key}/recording
```

## Project Structure
```
.
├── main.go
├── go.mod
└── go.sum
```

## Notes
- The HTTP server listens on port 8083.
- The RTMP server listens on port 1935.