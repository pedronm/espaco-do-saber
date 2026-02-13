import os
import tempfile
from datetime import timedelta
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from minio import Minio
from minio.error import S3Error


def _get_bool_env(name: str, default: str = "false") -> bool:
    value = os.getenv(name, default).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _minio_client() -> Minio:
    endpoint = os.getenv("MINIO_ENDPOINT", "video-storage")
    port = os.getenv("MINIO_PORT", "9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    secure = _get_bool_env("MINIO_SECURE", "false")
    return Minio(f"{endpoint}:{port}", access_key=access_key, secret_key=secret_key, secure=secure)


app = FastAPI(title="Video Processing")
minio_client = _minio_client()
minio_bucket = os.getenv("MINIO_BUCKET", "videos")


@app.on_event("startup")
def ensure_bucket() -> None:
    try:
        if not minio_client.bucket_exists(minio_bucket):
            minio_client.make_bucket(minio_bucket)
    except S3Error as exc:
        raise RuntimeError(f"Failed to initialize bucket: {exc}") from exc


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/videos/upload")
async def upload_video(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    object_name = f"{uuid4()}-{file.filename}"

    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            temp_file.write(chunk)
        temp_file.flush()
        temp_path = temp_file.name

    try:
        minio_client.fput_object(
            minio_bucket,
            object_name,
            temp_path,
            content_type=file.content_type or "application/octet-stream",
        )
    except S3Error as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    return {"objectName": object_name}


@app.get("/videos")
def list_videos(prefix: str | None = None) -> dict:
    try:
        objects = minio_client.list_objects(minio_bucket, prefix=prefix or "", recursive=True)
        return {"objects": [obj.object_name for obj in objects]}
    except S3Error as exc:
        raise HTTPException(status_code=500, detail=f"List failed: {exc}") from exc


@app.get("/videos/{object_name}")
def get_video_url(object_name: str) -> dict:
    try:
        url = minio_client.presigned_get_object(
            minio_bucket,
            object_name,
            expires=timedelta(hours=1),
        )
        return {"url": url}
    except S3Error as exc:
        raise HTTPException(status_code=500, detail=f"Presign failed: {exc}") from exc
