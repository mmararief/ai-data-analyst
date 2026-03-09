import docker
import shutil
import tempfile
import time
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from backend.core.security import get_current_user
from backend.models.user import UserInDB
from backend.core.minio_store import download_user_files

router = APIRouter(prefix="/streamlit", tags=["streamlit"])

CONTAINER_PORT = 8501

# Track one Streamlit container per user
_active: dict[str, dict] = {}


class RunRequest(BaseModel):
    filename: str


@router.post("/run")
def run_streamlit(req: RunRequest, request: Request, user: UserInDB = Depends(get_current_user)):
    if not req.filename.endswith(".py") or ".." in req.filename or "/" in req.filename or "\\" in req.filename:
        raise HTTPException(400, "Nama file tidak valid")

    # Verify file exists in MinIO before starting
    from backend.core.minio_store import object_exists
    if not object_exists(user.user_id, req.filename):
        raise HTTPException(404, "File tidak ditemukan")

    # Stop any existing Streamlit container for this user
    _stop_user(user.user_id)

    # Download user files to a temp dir, then mount it
    tmp = Path(tempfile.mkdtemp(prefix=f"stl_{user.user_id[:8]}_"))
    try:
        download_user_files(user.user_id, tmp)
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(500, f"Gagal menyiapkan data: {str(e)}")

    client = docker.from_env()
    abs_folder = str(tmp.resolve())
    container_name = f"streamlit-{user.user_id[:12]}"

    # Cleanup leftover container with same name
    try:
        old = client.containers.get(container_name)
        old.remove(force=True)
    except docker.errors.NotFound:
        pass

    try:
        container = client.containers.run(
            image="ai-sandbox:latest",
            command=[
                "streamlit", "run", f"/app/data/{req.filename}",
                f"--server.port={CONTAINER_PORT}",
                "--server.headless=true",
                "--server.enableCORS=false",
                "--server.enableXsrfProtection=false",
                "--browser.gatherUsageStats=false",
            ],
            volumes={abs_folder: {'bind': '/app/data', 'mode': 'rw'}},
            ports={f'{CONTAINER_PORT}/tcp': None},
            working_dir="/app/data",
            detach=True,
            mem_limit="512m",
            name=container_name,
        )
    except docker.errors.APIError as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(500, f"Gagal memulai container: {str(e)}")

    container.reload()
    bindings = (container.attrs.get("NetworkSettings", {}).get("Ports", {}).get(f"{CONTAINER_PORT}/tcp") or [])
    if not bindings:
        container.remove(force=True)
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(500, "Gagal mendapatkan port Streamlit")

    host_port = bindings[0].get("HostPort")
    host = request.url.hostname or "localhost"
    scheme = request.url.scheme or "http"
    url = f"{scheme}://{host}:{host_port}/"

    _active[user.user_id] = {
        "container_id": container.id,
        "filename": req.filename,
        "tmp_dir": str(tmp),
        "url": url,
    }
    time.sleep(3)  # Wait for Streamlit to boot

    return {"url": url, "filename": req.filename}


@router.get("/status")
def streamlit_status(user: UserInDB = Depends(get_current_user)):
    info = _active.get(user.user_id)
    if not info:
        return {"running": False}
    try:
        client = docker.from_env()
        container = client.containers.get(info["container_id"])
        if container.status != "running":
            _active.pop(user.user_id, None)
            return {"running": False}
    except docker.errors.NotFound:
        _active.pop(user.user_id, None)
        return {"running": False}
    return {
        "running": True,
        "url": info.get("url"),
        "filename": info["filename"],
    }


@router.post("/stop")
def stop_streamlit(user: UserInDB = Depends(get_current_user)):
    _stop_user(user.user_id)
    return {"message": "Streamlit dihentikan"}


def _stop_user(user_id: str):
    info = _active.pop(user_id, None)
    if not info:
        return
    try:
        client = docker.from_env()
        container = client.containers.get(info["container_id"])
        container.stop(timeout=5)
        container.remove(force=True)
    except (docker.errors.NotFound, docker.errors.APIError):
        pass
    if info.get("tmp_dir"):
        shutil.rmtree(info["tmp_dir"], ignore_errors=True)
