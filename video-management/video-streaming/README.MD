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
```

### RTMP Usage
Push a stream (example with FFmpeg):

```bash
ffmpeg -re -i /path/to/video.mp4 -c copy -f flv rtmp://localhost:1935/live
```

Play the stream from another client:

```
rtmp://localhost:1935/live
```

### HTTP Endpoints
```
GET /health
GET /streams
GET /streams/{key}/object
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