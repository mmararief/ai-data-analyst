import re
import uuid
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.core.security import (
    verify_password, hash_password, create_access_token,
    create_refresh_token, verify_refresh_token,
)
from backend.core.database import get_db, UserRow
from backend.models.user import UserInDB

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    if not req.username or not req.username.strip():
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong")
    if len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter")
    if not re.match(r'^[a-zA-Z0-9_]+$', req.username):
        raise HTTPException(status_code=400, detail="Username hanya boleh mengandung huruf, angka, dan underscore")
    if db.query(UserRow).filter(UserRow.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")

    row = UserRow(
        user_id=str(uuid.uuid4()),
        username=req.username,
        hashed_password=hash_password(req.password),
    )
    db.add(row)
    db.commit()
    return {"message": "Registrasi berhasil"}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    row = db.query(UserRow).filter(UserRow.username == form_data.username).first()
    if not row or not verify_password(form_data.password, row.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )
    access_token = create_access_token({"sub": row.username, "user_id": row.user_id})
    refresh_token = create_refresh_token({"sub": row.username, "user_id": row.user_id})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = verify_refresh_token(req.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token tidak valid atau expired",
        )
    username = payload.get("sub")
    row = db.query(UserRow).filter(UserRow.username == username).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User tidak ditemukan",
        )
    new_access = create_access_token({"sub": row.username, "user_id": row.user_id})
    new_refresh = create_refresh_token({"sub": row.username, "user_id": row.user_id})
    return TokenResponse(access_token=new_access, refresh_token=new_refresh)
