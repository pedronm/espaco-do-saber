import os
import tempfile
from datetime import timedelta
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from minio import Minio
from minio.error import S3Error


def _get_bool_env(name: str, default: str = "false") -> bool:
    value = os.getenv(name, default).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _first_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def _minio_client() -> Minio:
    raw_endpoint = _first_env("OB_STR_ENDPOINT", "MINIO_ENDPOINT", default="video-storage")
    parsed = urlparse(raw_endpoint)

    endpoint = raw_endpoint
    secure = _get_bool_env("MINIO_SECURE", "false")

    if parsed.scheme in {"http", "https"} and parsed.hostname:
        endpoint = parsed.hostname
        if parsed.port:
            endpoint = f"{endpoint}:{parsed.port}"
        secure = parsed.scheme == "https"
    else:
        port = os.getenv("MINIO_PORT", "9000")
        endpoint = f"{endpoint}:{port}"

    access_key = _first_env("OB_STR_API_KEY", "MINIO_ACCESS_KEY", default="minioadmin")
    secret_key = _first_env("OB_STR_SECRET_KEY", "MINIO_SECRET_KEY", default="minioadmin")

    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


app = FastAPI(title="Video Processing")
minio_client = _minio_client()
minio_bucket = _first_env("OB_STR_BUCKET", "MINIO_BUCKET", default="videos")


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
        minio_client.fput_object(
            minio_bucket,
            video_info,
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
        minio_client.fput_object(
            minio_bucket,
            video_info,
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

    return {"videoInfo": video_info}


@app.get("/videos")
def list_videos(prefix: str | None = None) -> dict:
    try:
        objects = minio_client.list_objects(minio_bucket, prefix=prefix or "", recursive=True)
        return {"videos": [obj.object_name for obj in objects]}
    except S3Error as exc:
        raise HTTPException(status_code=500, detail=f"List failed: {exc}") from exc


# @app.get("/videos/{video}")

# def get_video_url(video: str) -> dict:
#     try:
#         url = minio_client.presigned_get_object(
#             minio_bucket,
#             video,
#             expires=timedelta(hours=1),
#         )
#         return {"url": url}
#     except S3Error as exc:
#         raise HTTPException(status_code=500, detail=f"Presign failed: {exc}") from exc


@app.get("/videos/{video}")
def get_video(video: str) -> StreamingResponse:
    try:
        stat = minio_client.stat_object(minio_bucket, video)
    except S3Error as exc:
        if exc.code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="Video not found") from exc
        raise HTTPException(status_code=500, detail=f"Stat failed: {exc}") from exc

    try:
        obj = minio_client.get_object(minio_bucket, video)
    except S3Error as exc:
        if exc.code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="Video not found") from exc
        raise HTTPException(status_code=500, detail=f"Get failed: {exc}") from exc

    def _stream() -> bytes:
        try:
            for chunk in obj.stream(32 * 1024):
                yield chunk
        finally:
            obj.close()
            obj.release_conn()

    headers = {
        "Content-Length": str(stat.size),
        "Content-Disposition": f'inline; filename="{os.path.basename(video)}"',
    }
    media_type = stat.content_type or "application/octet-stream"
    return StreamingResponse(_stream(), media_type=media_type, headers=headers)
