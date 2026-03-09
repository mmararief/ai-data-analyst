import io
from pathlib import Path

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

router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet", ".pkl", ".joblib"}
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


def _validate_name(filename: str) -> None:
    """Tolak path traversal."""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Nama file tidak valid")


@router.get("/")
def list_files(user: UserInDB = Depends(get_current_user)):
    return {"files": list_user_objects(user.user_id)}


@router.post("/upload")
async def upload_file(
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

    # Read with hard cap to prevent oversized uploads from exhausting memory.
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Ukuran file melebihi batas {MAX_UPLOAD_MB} MB")

    put_object_bytes(user.user_id, file.filename, data)
    return {
        "message": f"{file.filename} berhasil diupload",
        "filename": file.filename,
        "batch_index": batch_index,
        "batch_total": batch_total,
    }


@router.delete("/")
def delete_all_files(user: UserInDB = Depends(get_current_user)):
    """Hapus semua file milik user."""
    files = list_user_objects(user.user_id)
    for f in files:
        name = f["name"]
        if prefix_has_objects(user.user_id, name):
            remove_prefix(user.user_id, name)
        elif object_exists(user.user_id, name):
            remove_object(user.user_id, name)
    return {"message": f"{len(files)} file berhasil dihapus"}


@router.delete("/{filename}")
def delete_file(filename: str, user: UserInDB = Depends(get_current_user)):
    _validate_name(filename)
    if prefix_has_objects(user.user_id, filename):
        remove_prefix(user.user_id, filename)
    elif object_exists(user.user_id, filename):
        remove_object(user.user_id, filename)
    else:
        raise HTTPException(404, "File tidak ditemukan")
    return {"message": f"{filename} berhasil dihapus"}


@router.get("/download/{filename}")
def download_file(filename: str, user: UserInDB = Depends(get_current_user)):
    _validate_name(filename)
    if not object_exists(user.user_id, filename):
        raise HTTPException(404, "File tidak ditemukan")
    data = get_object_bytes(user.user_id, filename)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/preview/{filename}")
def preview_file(filename: str, rows: int = 30, user: UserInDB = Depends(get_current_user)):
    _validate_name(filename)
    if not object_exists(user.user_id, filename):
        raise HTTPException(404, "File tidak ditemukan")
    ext = Path(filename).suffix.lower()
    try:
        data = get_object_bytes(user.user_id, filename)
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
            "filename": filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Gagal membaca file: {str(e)}")
