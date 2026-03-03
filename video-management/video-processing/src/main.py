import os
import tempfile
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from google.api_core.exceptions import GoogleAPIError
from google.cloud import storage


def _first_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def _gcs_client() -> storage.Client:
    return storage.Client()


app = FastAPI(title="Video Processing")
gcs_client = _gcs_client()
gcs_bucket = _first_env("GCS_BUCKET", "OB_STR_BUCKET", "MINIO_BUCKET", default="videos")


@app.on_event("startup")
def ensure_bucket() -> None:
    try:
        if not gcs_client.bucket(gcs_bucket).exists(client=gcs_client):
            raise RuntimeError(f"GCS bucket does not exist: {gcs_bucket}")
    except GoogleAPIError as exc:
        raise RuntimeError(f"Failed to initialize bucket: {exc}") from exc


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/process-video")
async def process_video(file: UploadFile = File(...)) -> dict:
    """Endpoint for Java backend to upload and process videos"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    video_info = f"{uuid4()}-{file.filename}"

    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            temp_file.write(chunk)
        temp_file.flush()
        temp_path = temp_file.name

    try:
        bucket = gcs_client.bucket(gcs_bucket)
        blob = bucket.blob(video_info)
        blob.upload_from_filename(temp_path, content_type=file.content_type or "application/octet-stream")
    except GoogleAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    return {"videoInfo": video_info}


@app.post("/videos/upload")
async def upload_video(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    video_info = f"{uuid4()}-{file.filename}"

    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            temp_file.write(chunk)
        temp_file.flush()
        temp_path = temp_file.name

    try:
        bucket = gcs_client.bucket(gcs_bucket)
        blob = bucket.blob(video_info)
        blob.upload_from_filename(temp_path, content_type=file.content_type or "application/octet-stream")
    except GoogleAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    return {"videoInfo": video_info}


@app.get("/videos")
def list_videos(prefix: str | None = None) -> dict:
    try:
        objects = gcs_client.list_blobs(gcs_bucket, prefix=prefix or "")
        return {"videos": [obj.name for obj in objects]}
    except GoogleAPIError as exc:
        raise HTTPException(status_code=500, detail=f"List failed: {exc}") from exc

@app.get("/videos/{video}")
def get_video(video: str) -> StreamingResponse:
    try:
        bucket = gcs_client.bucket(gcs_bucket)
        blob = bucket.get_blob(video)
    except GoogleAPIError as exc:
        raise HTTPException(status_code=500, detail=f"Stat failed: {exc}") from exc

    if blob is None:
        raise HTTPException(status_code=404, detail="Video not found")

    def _stream() -> bytes:
        with blob.open("rb") as stream:
            while True:
                chunk = stream.read(32 * 1024)
                if not chunk:
                    break
                yield chunk

    headers = {"Content-Disposition": f'inline; filename="{os.path.basename(video)}"'}
    if blob.size is not None:
        headers["Content-Length"] = str(blob.size)

    media_type = blob.content_type or "application/octet-stream"
    return StreamingResponse(_stream(), media_type=media_type, headers=headers)
