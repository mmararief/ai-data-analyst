import uuid
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.security import verify_password, hash_password, create_access_token
from backend.core.database import get_db, UserRow
from backend.models.user import UserInDB

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
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
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    row = db.query(UserRow).filter(UserRow.username == form_data.username).first()
    if not row or not verify_password(form_data.password, row.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )
    token = create_access_token({"sub": row.username, "user_id": row.user_id})
    return TokenResponse(access_token=token)
