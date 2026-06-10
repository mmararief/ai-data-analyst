import io
import json
import logging
import re
import threading
import time
from pathlib import Path
from posixpath import normpath

import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse

from backend.core.security import get_current_user
from backend.models.user import UserInDB
from backend.core.minio_store import (
    list_user_objects, put_object_bytes, get_object_bytes,
    remove_object, remove_prefix, object_exists, prefix_has_objects,
)
from backend.core.config import MAX_UPLOAD_MB, MAX_UPLOAD_FILES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet"}
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
SCHEMA_FILENAME = "_schema.json"

# ── Dashboard query engine settings ──────────────────────────────────────
# Hard cap on rows returned to the browser per widget query (safety net for
# chart queries that forget to aggregate).
MAX_QUERY_ROWS = 5000

# Short-lived in-process cache of loaded DataFrames so a dashboard with many
# widgets (and frequent filter changes) doesn't re-download + re-parse the
# whole dataset from object storage on every single query.
_DF_CACHE: dict[tuple, tuple] = {}
_DF_CACHE_LOCK = threading.Lock()
_DF_CACHE_TTL = 60  # seconds
_DF_CACHE_MAX = 16


def _load_dataset_df(user_id: str, project_id: str, rel_path: str, ext: str) -> pd.DataFrame:
    """Load a dataset into a DataFrame, using a short TTL cache."""
    key = (user_id, project_id, rel_path)
    now = time.time()
    with _DF_CACHE_LOCK:
        cached = _DF_CACHE.get(key)
        if cached and (now - cached[1]) < _DF_CACHE_TTL:
            return cached[0]

    data_bytes = get_object_bytes(user_id, rel_path, project_id=project_id)
    buf = io.BytesIO(data_bytes)
    if ext == ".csv":
        df = pd.read_csv(buf)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(buf)
    elif ext == ".json":
        df = pd.read_json(buf)
    elif ext == ".parquet":
        df = pd.read_parquet(buf)
    else:
        raise HTTPException(400, f"Format tidak didukung: {ext}")

    with _DF_CACHE_LOCK:
        # Opportunistic prune of expired/oversized cache
        if len(_DF_CACHE) >= _DF_CACHE_MAX:
            stale = [k for k, (_, ts) in _DF_CACHE.items() if (now - ts) >= _DF_CACHE_TTL]
            for k in stale:
                _DF_CACHE.pop(k, None)
            if len(_DF_CACHE) >= _DF_CACHE_MAX:
                _DF_CACHE.clear()
        _DF_CACHE[key] = (df, now)
    return df


def _validate_name(filename: str) -> None:
    """Tolak path traversal."""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Nama file tidak valid")


def _normalize_relative_path(path_value: str) -> str:
    """Normalize relative object path and block traversal."""
    value = (path_value or "").replace("\\", "/").strip()
    if not value:
        return ""
    normalized = normpath(value).replace("\\", "/").strip("/")
    if normalized in {"", "."}:
        return ""
    if normalized.startswith("../") or normalized == ".." or "/../" in normalized:
        raise HTTPException(400, "Path tidak valid")
    return normalized


def _load_schema_index(user_id: str, project_id: str) -> dict:
    if not object_exists(user_id, SCHEMA_FILENAME, project_id=project_id):
        return {"datasets": [], "updated_at": None}
    try:
        raw = get_object_bytes(user_id, SCHEMA_FILENAME, project_id=project_id)
        parsed = json.loads(raw.decode("utf-8"))
        if isinstance(parsed, dict) and isinstance(parsed.get("datasets"), list):
            return parsed
    except Exception:
        pass
    return {"datasets": [], "updated_at": None}


def _save_schema_index(user_id: str, project_id: str, payload: dict) -> None:
    payload = {
        "datasets": payload.get("datasets", []),
        "updated_at": time.time(),
    }
    put_object_bytes(
        user_id,
        SCHEMA_FILENAME,
        json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
        content_type="application/json",
        project_id=project_id,
    )


def _infer_schema(filename: str, data: bytes) -> dict | None:
    ext = Path(filename).suffix.lower()
    try:
        buf = io.BytesIO(data)
        if ext == ".csv":
            df = pd.read_csv(buf)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(buf)
        elif ext == ".json":
            df = pd.read_json(buf)
        elif ext == ".parquet":
            df = pd.read_parquet(buf)
        elif ext == ".pkl":
            raise HTTPException(
                400,
                "Format .pkl (pickle) tidak didukung karena risiko keamanan. "
                "Konversi ke CSV/Parquet terlebih dahulu.",
            )
        else:
            return None
        if not isinstance(df, pd.DataFrame):
            return None
        return {
            "file": filename,
            "rows": int(len(df)),
            "columns": df.columns.tolist(),
            "types": {col: str(dtype) for col, dtype in df.dtypes.items()},
        }
    except Exception:
        return None


def _upsert_schema_entry(user_id: str, project_id: str, schema: dict | None, filename: str) -> None:
    index = _load_schema_index(user_id, project_id)
    datasets = [item for item in index.get("datasets", []) if item.get("file") != filename]
    if schema is not None:
        datasets.append(schema)
    index["datasets"] = sorted(datasets, key=lambda item: item.get("file", ""))
    if index["datasets"]:
        _save_schema_index(user_id, project_id, index)
    elif object_exists(user_id, SCHEMA_FILENAME, project_id=project_id):
        remove_object(user_id, SCHEMA_FILENAME, project_id=project_id)


@router.get("/{project_id}/")
def list_files(project_id: str, path: str = "", user: UserInDB = Depends(get_current_user)):
    from backend.core.minio_store import list_all_project_files
    all_files = list_all_project_files(user.user_id, project_id=project_id)
    
    datasets = []
    exports = []
    
    for f in all_files:
        path_str = f["path"]
        suffix = Path(path_str).suffix.lower()
        if path_str.startswith("exports/"):
            if suffix:
                exports.append(f)
        else:
            if suffix in ALLOWED_EXTENSIONS:
                datasets.append(f)
            
    return {
        "datasets": datasets,
        "exports": exports,
    }


@router.post("/{project_id}/upload")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    batch_total: int = Form(1),
    batch_index: int = Form(1),
    user: UserInDB = Depends(get_current_user),
):
    if batch_total < 1 or batch_total > MAX_UPLOAD_FILES:
        raise HTTPException(400, f"Maksimal upload {MAX_UPLOAD_FILES} file per batch")
    if batch_index < 1 or batch_index > batch_total:
        raise HTTPException(400, "Urutan batch upload tidak valid")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Format tidak didukung: {ext}")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Ukuran file melebihi batas {MAX_UPLOAD_MB} MB")

    put_object_bytes(user.user_id, file.filename, data, project_id=project_id)
    _upsert_schema_entry(user.user_id, project_id, _infer_schema(file.filename, data), file.filename)
    return {
        "message": f"{file.filename} berhasil diupload",
        "filename": file.filename,
        "batch_index": batch_index,
        "batch_total": batch_total,
    }


@router.delete("/{project_id}/")
def delete_all_files(project_id: str, user: UserInDB = Depends(get_current_user)):
    """Hapus semua file milik user dalam project."""
    files = list_user_objects(user.user_id, project_id=project_id)
    for f in files:
        name = f["name"]
        if prefix_has_objects(user.user_id, name, project_id=project_id):
            remove_prefix(user.user_id, name, project_id=project_id)
        elif object_exists(user.user_id, name, project_id=project_id):
            remove_object(user.user_id, name, project_id=project_id)
    if object_exists(user.user_id, SCHEMA_FILENAME, project_id=project_id):
        remove_object(user.user_id, SCHEMA_FILENAME, project_id=project_id)
    return {"message": f"{len(files)} file berhasil dihapus"}


@router.delete("/{project_id}/{filename:path}")
def delete_file(project_id: str, filename: str, user: UserInDB = Depends(get_current_user)):
    rel_path = _normalize_relative_path(filename)
    if not rel_path:
        raise HTTPException(400, "Nama file tidak valid")
    if prefix_has_objects(user.user_id, rel_path, project_id=project_id):
        remove_prefix(user.user_id, rel_path, project_id=project_id)
    elif object_exists(user.user_id, rel_path, project_id=project_id):
        remove_object(user.user_id, rel_path, project_id=project_id)
    else:
        raise HTTPException(404, "File tidak ditemukan")
    _upsert_schema_entry(user.user_id, project_id, None, rel_path)
    return {"message": f"{rel_path} berhasil dihapus"}


@router.get("/{project_id}/download/{filename:path}")
def download_file(project_id: str, filename: str, user: UserInDB = Depends(get_current_user)):
    rel_path = _normalize_relative_path(filename)
    if not rel_path or not object_exists(user.user_id, rel_path, project_id=project_id):
        raise HTTPException(404, "File tidak ditemukan")
    data = get_object_bytes(user.user_id, rel_path, project_id=project_id)
    dl_name = Path(rel_path).name
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{dl_name}"'},
    )


@router.get("/{project_id}/preview/{filename:path}")
def preview_file(project_id: str, filename: str, rows: int = 30, user: UserInDB = Depends(get_current_user)):
    rows = max(1, min(rows, 500))
    rel_path = _normalize_relative_path(filename)
    if not rel_path or not object_exists(user.user_id, rel_path, project_id=project_id):
        raise HTTPException(404, "File tidak ditemukan")
    ext = Path(rel_path).suffix.lower()
    try:
        data = get_object_bytes(user.user_id, rel_path, project_id=project_id)
        buf = io.BytesIO(data)
        if ext == ".csv":
            df = pd.read_csv(buf, nrows=rows)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(buf, nrows=rows)
        elif ext == ".json":
            df = pd.read_json(buf).head(rows)
        elif ext == ".parquet":
            df = pd.read_parquet(buf).head(rows)
        else:
            raise HTTPException(400, "Format tidak didukung untuk preview")
        return {
            "columns": df.columns.tolist(),
            "data": df.fillna("").astype(str).values.tolist(),
            "total_rows": len(df),
            "filename": rel_path,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Gagal membaca file: {str(e)}")


from pydantic import BaseModel

class QueryRequest(BaseModel):
    dataset_name: str
    query: str

@router.post("/{project_id}/query")
def query_dataset(
    project_id: str,
    payload: QueryRequest,
    user: UserInDB = Depends(get_current_user)
):
    dataset_name = payload.dataset_name
    query = payload.query
    
    _validate_name(dataset_name)
    rel_path = _normalize_relative_path(dataset_name)
    if not rel_path or not object_exists(user.user_id, rel_path, project_id=project_id):
        raise HTTPException(404, f"Dataset {dataset_name} tidak ditemukan")

    ext = Path(rel_path).suffix.lower()
    df = _load_dataset_df(user.user_id, project_id, rel_path, ext)

    # Normalize backtick-quoted identifiers to DuckDB double quotes
    query = re.sub(r'`([^`]+)`', r'"\1"', query)
    # Cap result size: wrap the (SELECT) query in an outer LIMIT as a safety net
    clean_q = query.strip().rstrip(";").strip()
    # Block DDL/admin SQL statements that should never come from the UI
    _first_token = clean_q.split()[0].upper() if clean_q.split() else ""
    _BLOCKED_SQL = {"DROP", "ALTER", "CREATE", "INSERT", "UPDATE", "DELETE",
                    "TRUNCATE", "GRANT", "REVOKE", "COPY", "EXPORT", "IMPORT",
                    "ATTACH", "DETACH", "LOAD", "INSTALL", "PRAGMA", "SET",
                    "CALL", "EXECUTE", "EXEC"}
    if _first_token in _BLOCKED_SQL:
        raise HTTPException(400, f"Operasi SQL '{_first_token}' tidak diizinkan. Hanya SELECT query yang didukung.")
    capped_query = f"SELECT * FROM ({clean_q}) AS _capped LIMIT {MAX_QUERY_ROWS}"

    import duckdb
    con = None
    try:
        # Lock down the engine: no filesystem/network/extension access, so a
        # crafted query can only touch the registered in-memory `dataset`.
        con = duckdb.connect(config={"enable_external_access": False})
        con.register("dataset", df)
        res_df = con.execute(capped_query).df()

        # Clean NaN/Inf values so they are JSON-serializable
        res_df = res_df.fillna("")

        return {
            "columns": res_df.columns.tolist(),
            "data": res_df.astype(str).values.tolist(),
            "total_rows": len(res_df),
        }
    except Exception as e:
        logger.warning(
            "query_dataset failed (project=%s, dataset=%s): %s",
            project_id, dataset_name, e,
        )
        raise HTTPException(400, f"Gagal mengeksekusi query: {str(e)[:300]}")
    finally:
        if con is not None:
            try:
                con.close()
            except Exception:
                pass
