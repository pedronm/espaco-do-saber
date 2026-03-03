Here we'll have a python project for storing videos in Google Cloud Storage.

## Overview

A Python project that manages video uploads and storage using Google Cloud Storage.

## Features

- REST API for upload, list, and presigned download URLs
- Google Cloud Storage integration
- Basic health endpoint

## Requirements

- Python 3.11+
- Google Cloud Storage bucket
- Dependencies listed in `requirements.txt`

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set up your GCS connection details in `.env` or environment variables:

```
GCS_BUCKET=videos
GOOGLE_APPLICATION_CREDENTIALS=/var/secrets/google/key.json
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