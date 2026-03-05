import json
from datetime import datetime, timezone


def _json(data, status=200):
    return Response.new(
        json.dumps(data),
        headers={"content-type": "application/json"},
        status=status,
    )


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


async def on_fetch(request, env):
    url = URL.new(request.url)
    path = url.pathname
    method = request.method.upper()

    if path == "/health" and method == "GET":
        return _json({"ok": True, "service": "video-processing-worker", "env": env.APP_ENV})

    if path == "/jobs" and method == "POST":
        payload = await request.json()
        source_url = payload.get("sourceUrl")
        target_key = payload.get("targetKey")

        if not source_url or not target_key:
            return _json({"message": "sourceUrl and targetKey are required"}, 400)

        job_id = f"job-{Date.now()}"

        metadata = {
            "id": job_id,
            "sourceUrl": source_url,
            "targetKey": target_key,
            "status": "queued",
            "createdAt": _now_iso(),
        }

        await env.VIDEOS_BUCKET.put(f"jobs/{job_id}.json", json.dumps(metadata))

        return _json(metadata, 201)

    if path.startswith("/jobs/") and method == "GET":
        job_id = path.split("/jobs/")[-1]
        if not job_id:
            return _json({"message": "Invalid job id"}, 400)

        obj = await env.VIDEOS_BUCKET.get(f"jobs/{job_id}.json")
        if obj is None:
            return _json({"message": "Job not found"}, 404)

        content = await obj.text()
        return _json(json.loads(content))

    return _json({"message": "Not found"}, 404)
