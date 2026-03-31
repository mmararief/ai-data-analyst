import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.core.redis_store import list_sessions, get_session, save_session, delete_session
from backend.core.security import get_current_user
from backend.models.user import UserInDB

router = APIRouter(prefix="/history", tags=["history"])


class MsgItem(BaseModel):
    role: str
    content: str
    parts: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    codeSteps: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    images: Optional[List[str]] = Field(default_factory=list)


class SaveRequest(BaseModel):
    session_id: Optional[str] = None
    title: str
    messages: List[MsgItem]


@router.get("/{project_id}")
def list_sessions_route(project_id: str, user: UserInDB = Depends(get_current_user)):
    return {"sessions": list_sessions(user.user_id, project_id=project_id)}


@router.post("/{project_id}/save")
def save_session_route(project_id: str, req: SaveRequest, user: UserInDB = Depends(get_current_user)):
    sid = req.session_id or str(uuid.uuid4())
    save_session(
        user_id=user.user_id,
        session_id=sid,
        title=req.title,
        messages=[m.model_dump() for m in req.messages],
        project_id=project_id,
    )
    return {"session_id": sid}


@router.get("/{project_id}/{session_id}")
def get_session_route(project_id: str, session_id: str, user: UserInDB = Depends(get_current_user)):
    data = get_session(user.user_id, project_id, session_id)
    if not data:
        raise HTTPException(404, "Session tidak ditemukan")
    return data


@router.delete("/{project_id}/{session_id}")
def delete_session_route(project_id: str, session_id: str, user: UserInDB = Depends(get_current_user)):
    found = delete_session(user.user_id, project_id, session_id)
    if not found:
        raise HTTPException(404, "Session tidak ditemukan")
    return {"message": "Dihapus"}
