Here we'll have a python project for storing videos in a MinIO server.

## Overview

A Python project that manages video uploads and storage using MinIO, an S3-compatible object storage service.

## Features

- REST API for upload, list, and presigned download URLs
- MinIO integration (S3 compatible)
- Basic health endpoint

## Requirements

- Python 3.11+
- MinIO server
- Dependencies listed in `requirements.txt`

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set up your MinIO connection details in `.env` or environment variables:

```
MINIO_ENDPOINT=video-storage
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=videos
MINIO_SECURE=false
```

## Usage

Start the service:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir ./src
```

Upload a video:

```bash
curl -F "file=@/path/to/video.mp4" http://localhost:8000/videos/upload
```

List videos:

```bash
curl http://localhost:8000/videos
```

Get a presigned URL:

```bash
curl http://localhost:8000/videos/{objectName}
```

## Project Structure

```
├── src/
│   ├── __init__.py
│   └── main.py
├── requirements.txt
└── README.MD
```