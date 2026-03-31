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
PORT_POOL_START = 8501
PORT_POOL_END = 8530  # Expanded to 30 ports

# Track one Streamlit container per user
_active: dict[str, dict] = {}


def _get_used_ports() -> set[int]:
    """Get currently used ports from ALL Streamlit containers (running or not)."""
    used = set()
    try:
        client = docker.from_env()
        # Check ALL containers including stopped/created ones
        containers = client.containers.list(all=True, filters={"name": "streamlit-"})
        for container in containers:
            try:
                ports = container.attrs.get("NetworkSettings", {}).get("Ports", {})
                bindings = ports.get(f"{CONTAINER_PORT}/tcp", [])
                if bindings:
                    host_port = int(bindings[0].get("HostPort", 0))
                    if PORT_POOL_START <= host_port <= PORT_POOL_END:
                        used.add(host_port)
                # Also check HostConfig for port bindings (for created containers)
                host_config = container.attrs.get("HostConfig", {})
                port_bindings = host_config.get("PortBindings", {}) or {}
                for port_key, bindings_list in port_bindings.items():
                    if f"{CONTAINER_PORT}/tcp" in port_key and bindings_list:
                        host_port = int(bindings_list[0].get("HostPort", 0))
                        if PORT_POOL_START <= host_port <= PORT_POOL_END:
                            used.add(host_port)
            except (KeyError, ValueError, TypeError):
                pass
    except Exception:
        pass
    return used


class RunRequest(BaseModel):
    filename: str
    project_id: str


@router.post("/run")
def run_streamlit(req: RunRequest, request: Request, user: UserInDB = Depends(get_current_user)):
    if not req.filename.endswith(".py") or ".." in req.filename or "/" in req.filename or "\\" in req.filename:
        raise HTTPException(400, "Nama file tidak valid")

    from backend.core.minio_store import object_exists
    if not object_exists(user.user_id, req.filename, project_id=req.project_id):
        raise HTTPException(404, "File tidak ditemukan")

    client = docker.from_env()
    container_name = f"streamlit-{user.user_id[:12]}"

    # Stop any existing Streamlit container for this user (from tracking)
    _stop_user(user.user_id)

    # Force cleanup leftover container with same name (release ports)
    try:
        old = client.containers.get(container_name)
        old.stop(timeout=2)
        old.remove(force=True)
        time.sleep(1)  # Wait for port to be fully released
    except docker.errors.NotFound:
        pass
    except Exception:
        pass

    # Allocate a host port for this container
    host_port = _allocate_port()
    if not host_port:
        # Try cleanup orphaned containers and retry
        _cleanup_orphaned_containers()
        host_port = _allocate_port()
        if not host_port:
            raise HTTPException(503, "Tidak ada port tersedia untuk Streamlit")

    # Download user files to a temp dir, then mount it
    tmp = Path(tempfile.mkdtemp(prefix=f"stl_{user.user_id[:8]}_"))
    try:
        download_user_files(user.user_id, tmp, project_id=req.project_id)
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(500, f"Gagal menyiapkan data: {str(e)}")

    abs_folder = str(tmp.resolve())

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
            ports={f'{CONTAINER_PORT}/tcp': host_port},
            working_dir="/app/data",
            detach=True,
            mem_limit="512m",
            name=container_name,
        )
    except docker.errors.APIError as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(500, f"Gagal memulai container: {str(e)}")

    host = request.url.hostname or "localhost"
    scheme = request.url.scheme or "http"
    url = f"{scheme}://{host}:{host_port}/"

    _active[user.user_id] = {
        "container_id": container.id,
        "filename": req.filename,
        "tmp_dir": str(tmp),
        "url": url,
        "host_port": host_port,
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


def _allocate_port() -> int | None:
    """Allocate a free port from the pool by checking actual Docker usage."""
    used_ports = _get_used_ports()
    for port in range(PORT_POOL_START, PORT_POOL_END + 1):
        if port not in used_ports:
            return port
    return None


def _cleanup_orphaned_containers():
    """Remove ALL Streamlit containers that are not tracked in _active."""
    try:
        client = docker.from_env()
        active_ids = {info["container_id"] for info in _active.values()}
        # List ALL containers including stopped/created/exited ones
        containers = client.containers.list(all=True, filters={"name": "streamlit-"})
        for container in containers:
            if container.id not in active_ids:
                try:
                    container.stop(timeout=2)
                    container.remove(force=True)
                except (docker.errors.NotFound, docker.errors.APIError):
                    pass
        # Extra wait for ports to be fully released
        time.sleep(1)
    except Exception:
        pass
