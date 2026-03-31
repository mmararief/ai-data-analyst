from pydantic import BaseModel
from typing import Optional


class ProjectInDB(BaseModel):
    project_id: str
    user_id: str
    name: str
    description: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True
