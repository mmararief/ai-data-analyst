from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserInDB(BaseModel):
    user_id: str
    username: str
    hashed_password: str
    role: str = "user"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # allow ORM → pydantic (SQLAlchemy 2.x)
