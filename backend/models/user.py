from pydantic import BaseModel


class UserInDB(BaseModel):
    user_id: str
    username: str
    hashed_password: str

    class Config:
        from_attributes = True  # allow ORM → pydantic (SQLAlchemy 2.x)
