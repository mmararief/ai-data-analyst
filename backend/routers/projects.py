import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.database import get_db, ProjectRow
from backend.core.security import get_current_user
from backend.models.user import UserInDB
from backend.core.minio_store import (
    list_user_objects,
    remove_project_files,
)
from backend.core.redis_store import list_sessions, delete_sessions_for_project

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/")
def create_project(
    req: CreateProjectRequest,
    user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project_id = str(uuid.uuid4())
    row = ProjectRow(
        project_id=project_id,
        user_id=user.user_id,
        name=req.name.strip(),
        description=(req.description or "").strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "project_id": row.project_id,
        "name": row.name,
        "description": row.description or "",
        "created_at": str(row.created_at) if row.created_at else None,
    }


@router.get("/")
def list_projects(
    user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ProjectRow)
        .filter(ProjectRow.user_id == user.user_id)
        .order_by(ProjectRow.updated_at.desc())
        .all()
    )
    projects = []
    for r in rows:
        files = list_user_objects(user.user_id, project_id=r.project_id)
        sessions = list_sessions(user.user_id, project_id=r.project_id)
        projects.append({
            "project_id": r.project_id,
            "name": r.name,
            "description": r.description or "",
            "file_count": len(files),
            "chat_count": len(sessions),
            "created_at": str(r.created_at) if r.created_at else None,
            "updated_at": str(r.updated_at) if r.updated_at else None,
        })
    return {"projects": projects}


@router.get("/{project_id}")
def get_project(
    project_id: str,
    user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(ProjectRow)
        .filter(ProjectRow.project_id == project_id, ProjectRow.user_id == user.user_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Project tidak ditemukan")
    files = list_user_objects(user.user_id, project_id=project_id)
    sessions = list_sessions(user.user_id, project_id=project_id)
    return {
        "project_id": row.project_id,
        "name": row.name,
        "description": row.description or "",
        "file_count": len(files),
        "chat_count": len(sessions),
        "created_at": str(row.created_at) if row.created_at else None,
        "updated_at": str(row.updated_at) if row.updated_at else None,
    }


@router.put("/{project_id}")
def update_project(
    project_id: str,
    req: UpdateProjectRequest,
    user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(ProjectRow)
        .filter(ProjectRow.project_id == project_id, ProjectRow.user_id == user.user_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Project tidak ditemukan")
    if req.name is not None:
        row.name = req.name.strip()
    if req.description is not None:
        row.description = req.description.strip()
    db.commit()
    db.refresh(row)
    return {
        "project_id": row.project_id,
        "name": row.name,
        "description": row.description or "",
    }


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    user: UserInDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(ProjectRow)
        .filter(ProjectRow.project_id == project_id, ProjectRow.user_id == user.user_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Project tidak ditemukan")

    remove_project_files(user.user_id, project_id)
    delete_sessions_for_project(user.user_id, project_id)

    db.delete(row)
    db.commit()
    return {"message": f"Project '{row.name}' berhasil dihapus"}
