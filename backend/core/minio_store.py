"""
MinIO client untuk penyimpanan dataset pengguna.

Bucket  : ai-datasets  (konfigurasi via MINIO_BUCKET)
Layout  : datasets/{user_id}/{project_id}/{relative_path}

File internal runtime yang tidak disimpan ke MinIO:
    - _exec_script.py   (skrip sandbox sementara)
    - _chart_*.png      (grafik dibaca inline lalu dihapus oleh agent_runner)
    - .chats.json

File internal yang disimpan tapi disembunyikan dari listing UI:
    - _schema.json
"""

import io
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

from minio import Minio
from minio.error import S3Error

try:
    from backend.core.config import (
        MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
        MINIO_BUCKET, MINIO_SECURE, TEMP_ROOT
    )
except ImportError:
    MINIO_ENDPOINT = "localhost:9000"
    MINIO_ACCESS_KEY = "minioadmin"
    MINIO_SECRET_KEY = "minioadmin"
    MINIO_BUCKET = "ai-datasets"
    MINIO_SECURE = False

_RUNTIME_SKIP_NAMES = {"_exec_script.py", "_kernel_loop.py", ".chats.json"}
_LIST_SKIP_NAMES = {"_exec_script.py", "_kernel_loop.py", ".chats.json", "_schema.json"}
_SKIP_PREFIXES = ("_chart_",)


# ── Internal helpers ──────────────────────────────────────────────────────────

_CLIENT: Minio | None = None

def _get_client() -> Minio:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
    return _CLIENT


def _ensure_bucket(client: Minio) -> None:
    try:
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
    except S3Error:
        pass


def _user_prefix(user_id: str, project_id: str | None = None) -> str:
    if project_id:
        return f"datasets/{user_id}/{project_id}/"
    return f"datasets/{user_id}/"


def _is_runtime_private(name: str) -> bool:
    return name in _RUNTIME_SKIP_NAMES or any(name.startswith(p) for p in _SKIP_PREFIXES)


def _is_list_hidden(name: str) -> bool:
    return name in _LIST_SKIP_NAMES or any(name.startswith(p) for p in _SKIP_PREFIXES)


# ── Public API ────────────────────────────────────────────────────────────────

def list_user_objects(
    user_id: str,
    relative_prefix: str = "",
    *,
    project_id: str | None = None,
) -> list[dict]:
    """Daftar file/folder pada level prefix tertentu (non-recursive)."""
    client = _get_client()
    _ensure_bucket(client)
    rel = (relative_prefix or "").strip("/")
    prefix = _user_prefix(user_id, project_id)
    if rel:
        prefix = f"{prefix}{rel}/"
    items: list[dict] = []
    try:
        for obj in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=False):
            name = obj.object_name[len(prefix):]
            if not name:
                continue
            if obj.is_dir:
                folder_name = name.rstrip("/")
                full_path = f"{rel}/{folder_name}" if rel else folder_name
                img_count = 0
                size_kb = 0.0
                for sub in client.list_objects(MINIO_BUCKET, prefix=obj.object_name, recursive=True):
                    size_kb += (sub.size or 0) / 1024
                    if Path(sub.object_name).suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".gif"):
                        img_count += 1
                items.append({
                    "name": folder_name,
                    "path": full_path,
                    "size_kb": round(size_kb, 1),
                    "type": "folder",
                    "image_count": img_count,
                })
            else:
                if _is_list_hidden(name):
                    continue
                full_path = f"{rel}/{name}" if rel else name
                items.append({
                    "name": Path(name).name,
                    "path": full_path,
                    "size_kb": round((obj.size or 0) / 1024, 1),
                    "type": "file",
                })
    except S3Error:
        pass
    return items


def put_object_bytes(
    user_id: str, obj_path: str, data: bytes,
    content_type: str = "application/octet-stream",
    *,
    project_id: str | None = None,
) -> None:
    """Upload bytes ke MinIO. obj_path relatif terhadap user/project prefix."""
    client = _get_client()
    _ensure_bucket(client)
    obj_name = f"{_user_prefix(user_id, project_id)}{obj_path}"
    client.put_object(
        MINIO_BUCKET, obj_name,
        io.BytesIO(data), length=len(data),
        content_type=content_type,
    )


def get_object_bytes(user_id: str, obj_path: str, *, project_id: str | None = None) -> bytes:
    """Download object sebagai bytes. Raise S3Error jika tidak ada."""
    client = _get_client()
    resp = client.get_object(MINIO_BUCKET, f"{_user_prefix(user_id, project_id)}{obj_path}")
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def object_exists(user_id: str, obj_path: str, *, project_id: str | None = None) -> bool:
    client = _get_client()
    try:
        client.stat_object(MINIO_BUCKET, f"{_user_prefix(user_id, project_id)}{obj_path}")
        return True
    except S3Error:
        return False


def prefix_has_objects(user_id: str, folder_name: str, *, project_id: str | None = None) -> bool:
    """Cek apakah suatu folder prefix punya isi."""
    client = _get_client()
    prefix = f"{_user_prefix(user_id, project_id)}{folder_name}/"
    try:
        return any(True for _ in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=False))
    except S3Error:
        return False


def remove_object(user_id: str, obj_path: str, *, project_id: str | None = None) -> None:
    """Hapus satu object."""
    client = _get_client()
    client.remove_object(MINIO_BUCKET, f"{_user_prefix(user_id, project_id)}{obj_path}")


def remove_prefix(user_id: str, folder_name: str, *, project_id: str | None = None) -> None:
    """Hapus semua object di bawah folder prefix secara rekursif."""
    client = _get_client()
    prefix = f"{_user_prefix(user_id, project_id)}{folder_name}/"
    for obj in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True):
        client.remove_object(MINIO_BUCKET, obj.object_name)


def remove_project_files(user_id: str, project_id: str) -> None:
    """Bulk-delete semua file di bawah prefix project."""
    client = _get_client()
    _ensure_bucket(client)
    prefix = _user_prefix(user_id, project_id)
    try:
        for obj in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True):
            client.remove_object(MINIO_BUCKET, obj.object_name)
    except S3Error:
        pass


def download_user_files(
    user_id: str,
    target_dir: Path,
    *,
    project_id: str | None = None,
) -> None:
    """Download semua file user/project dari MinIO ke target_dir (untuk sandbox)."""
    client = _get_client()
    _ensure_bucket(client)
    prefix = _user_prefix(user_id, project_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        for obj in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True):
            rel = obj.object_name[len(prefix):]
            if not rel or obj.is_dir:
                continue
            if _is_runtime_private(Path(rel).name):
                continue
            dest = target_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            client.fget_object(MINIO_BUCKET, obj.object_name, str(dest))
    except S3Error:
        pass


def upload_generated_files(
    user_id: str,
    source_dir: Path,
    before_state: dict[str, tuple[float, int]] = None,
    *,
    project_id: str | None = None,
) -> None:
    """
    Upload file yang baru di-generate atau dimodifikasi di source_dir kembali ke MinIO.
    """
    client = _get_client()
    _ensure_bucket(client)
    prefix = _user_prefix(user_id, project_id)

    for f in source_dir.rglob("*"):
        if not f.is_file():
            continue
        if _is_runtime_private(f.name):
            continue
        rel = f.relative_to(source_dir).as_posix()
        obj_name = f"{prefix}{rel}"

        is_changed = True
        if before_state is not None and rel in before_state:
            old_mtime, old_size = before_state[rel]
            new_mtime = f.stat().st_mtime
            new_size = f.stat().st_size
            if new_size == old_size and new_mtime == old_mtime:
                is_changed = False

        if is_changed:
            client.fput_object(MINIO_BUCKET, obj_name, str(f))


@contextmanager
def sandbox_context(user_id: str, *, project_id: str | None = None):
    """
    Context manager: download file user dari MinIO ke temp dir,
    yield Path untuk sandbox, lalu upload file baru/modified yang di-generate balik ke MinIO.
    Temp dir selalu di-cleanup.
    """
    tmp = Path(tempfile.mkdtemp(prefix=f"sbx_{user_id[:8]}_", dir=str(TEMP_ROOT)))
    try:
        download_user_files(user_id, tmp, project_id=project_id)
        # Pastikan folder exports selalu ada agar kode python yang menulis ke sana tidak error
        (tmp / "exports").mkdir(exist_ok=True)

        # Rekam status file sebelum eksekusi sandbox
        before_state = {}
        for f in tmp.rglob("*"):
            if f.is_file():
                try:
                    stat = f.stat()
                    before_state[f.relative_to(tmp).as_posix()] = (stat.st_mtime, stat.st_size)
                except Exception:
                    pass

        yield tmp
        upload_generated_files(user_id, tmp, before_state, project_id=project_id)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def list_all_project_files(user_id: str, project_id: str) -> list[dict]:
    """Daftar seluruh file milik user dalam project secara rekursif."""
    client = _get_client()
    _ensure_bucket(client)
    prefix = _user_prefix(user_id, project_id)
    items = []
    try:
        for obj in client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True):
            rel = obj.object_name[len(prefix):]
            if not rel or obj.is_dir:
                continue
            if _is_list_hidden(Path(rel).name):
                continue
            items.append({
                "name": Path(rel).name,
                "path": rel,
                "size_kb": round((obj.size or 0) / 1024, 1),
                "type": "file",
            })
    except S3Error:
        pass
    return items
