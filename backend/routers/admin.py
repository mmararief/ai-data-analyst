"""Admin monitoring and maintenance router.

Provides endpoints for:
- System statistics (users, projects, tokens, queue, sandboxes, hardware)
- User management and LLM token usage tracking
- Worker & Redis queue monitoring
- Docker sandbox container monitoring
- System maintenance actions (clean sandboxes, clean temp files, clean Redis cache)
"""

import os
import shutil
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import docker
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.config import TEMP_ROOT
from backend.core.database import get_db, UserRow, ProjectRow, UserTokenUsageRow
from backend.core.security import require_admin
from backend.models.user import UserInDB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateRoleRequest(BaseModel):
    role: str  # "admin" | "user"


@router.get("/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: UserInDB = Depends(require_admin),
):
    """Return high-level system overview stats."""
    total_users = db.query(UserRow).count()
    total_projects = db.query(ProjectRow).count()
    
    # Token usage aggregation
    token_stats = db.query(
        func.coalesce(func.sum(UserTokenUsageRow.prompt_tokens), 0).label("prompt"),
        func.coalesce(func.sum(UserTokenUsageRow.completion_tokens), 0).label("completion"),
        func.coalesce(func.sum(UserTokenUsageRow.total_tokens), 0).label("total"),
    ).first()

    # Redis queue and active jobs
    queue_len = 0
    active_jobs_count = 0
    try:
        from backend.core.job_store import _rc, _QUEUE_KEY
        queue_len = _rc.llen(_QUEUE_KEY)
        active_keys = _rc.keys("active:*:*")
        active_jobs_count = len(active_keys)
    except Exception as e:
        logger.warning(f"Error querying Redis stats: {e}")

    # Docker sandbox containers count
    sandbox_count = 0
    try:
        client = docker.from_env()
        sandboxes = client.containers.list(all=True, filters={"name": "ai-sandbox-"})
        sandbox_count = len(sandboxes)
    except Exception as e:
        logger.warning(f"Error querying Docker sandboxes: {e}")

    # Disk usage
    disk_total_gb = 0.0
    disk_used_gb = 0.0
    disk_free_gb = 0.0
    disk_percent = 0.0
    try:
        total, used, free = shutil.disk_usage(str(TEMP_ROOT) if os.path.exists(str(TEMP_ROOT)) else "/")
        disk_total_gb = round(total / (1024**3), 2)
        disk_used_gb = round(used / (1024**3), 2)
        disk_free_gb = round(free / (1024**3), 2)
        disk_percent = round((used / total) * 100, 1)
    except Exception:
        pass

    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "token_usage": {
            "prompt_tokens": int(token_stats.prompt) if token_stats else 0,
            "completion_tokens": int(token_stats.completion) if token_stats else 0,
            "total_tokens": int(token_stats.total) if token_stats else 0,
        },
        "worker": {
            "queue_len": queue_len,
            "active_jobs": active_jobs_count,
            "sandbox_containers": sandbox_count,
        },
        "system": {
            "disk_total_gb": disk_total_gb,
            "disk_used_gb": disk_used_gb,
            "disk_free_gb": disk_free_gb,
            "disk_percent": disk_percent,
        },
    }


@router.get("/users")
def get_admin_users(
    db: Session = Depends(get_db),
    admin_user: UserInDB = Depends(require_admin),
):
    """Return all registered users with project count and token usage statistics."""
    users = db.query(UserRow).all()
    user_list = []

    for u in users:
        proj_count = db.query(ProjectRow).filter(ProjectRow.user_id == u.user_id).count()
        
        # Token usage per user
        t_stat = db.query(
            func.coalesce(func.sum(UserTokenUsageRow.prompt_tokens), 0).label("prompt"),
            func.coalesce(func.sum(UserTokenUsageRow.completion_tokens), 0).label("completion"),
            func.coalesce(func.sum(UserTokenUsageRow.total_tokens), 0).label("total"),
            func.count(UserTokenUsageRow.id).label("requests_count"),
        ).filter(UserTokenUsageRow.user_id == u.user_id).first()

        user_list.append({
            "user_id": u.user_id,
            "username": u.username,
            "role": getattr(u, "role", "user") or "user",
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "project_count": proj_count,
            "requests_count": int(t_stat.requests_count) if t_stat else 0,
            "tokens": {
                "prompt": int(t_stat.prompt) if t_stat else 0,
                "completion": int(t_stat.completion) if t_stat else 0,
                "total": int(t_stat.total) if t_stat else 0,
            },
        })

    # Sort users: newest created first
    user_list.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return {"users": user_list}


@router.put("/users/{target_user_id}/role")
def update_user_role(
    target_user_id: str,
    req: UpdateRoleRequest,
    db: Session = Depends(get_db),
    admin_user: UserInDB = Depends(require_admin),
):
    """Toggle role between 'admin' and 'user'."""
    if req.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role harus 'admin' atau 'user'")

    target_user = db.query(UserRow).filter(UserRow.user_id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    # Guard: prevent removing the last admin
    if target_user.role == "admin" and req.role == "user":
        admin_count = db.query(UserRow).filter(UserRow.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Tidak dapat mencabut hak admin terakhir")

    target_user.role = req.role
    db.commit()
    return {"message": f"Role pengguna {target_user.username} berhasil diubah menjadi {req.role}", "role": req.role}


@router.get("/workers")
def get_worker_status(
    admin_user: UserInDB = Depends(require_admin),
):
    """Get active worker queue and active job details from Redis."""
    from backend.core.job_store import _rc, _QUEUE_KEY

    queue_jobs = []
    active_jobs = []

    try:
        # 1. Queue items (peek first 20)
        items = _rc.lrange(_QUEUE_KEY, 0, 19)
        import json
        for it in items:
            try:
                queue_jobs.append(json.loads(it))
            except Exception:
                pass

        # 2. Active jobs
        active_keys = _rc.keys("active:*:*")
        for k in active_keys:
            val = _rc.get(k)
            parts = k.split(":")
            u_id = parts[1] if len(parts) > 1 else ""
            s_id = parts[2] if len(parts) > 2 else ""
            
            job_info = {"key": k, "user_id": u_id, "session_id": s_id}
            if val:
                try:
                    job_info.update(json.loads(val))
                except Exception:
                    job_info["raw"] = val
            active_jobs.append(job_info)

    except Exception as e:
        logger.warning(f"Failed to fetch worker details: {e}")

    return {
        "queue_length": len(queue_jobs),
        "queue_items": queue_jobs,
        "active_jobs_count": len(active_jobs),
        "active_jobs": active_jobs,
    }


@router.get("/sandboxes")
def get_docker_sandboxes(
    admin_user: UserInDB = Depends(require_admin),
):
    """List all running and created ai-sandbox containers."""
    sandbox_list = []
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True, filters={"name": "ai-sandbox-"})
        for c in containers:
            sandbox_list.append({
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "unknown",
                "created": c.attrs.get("Created"),
            })
    except Exception as e:
        logger.warning(f"Failed to inspect sandboxes: {e}")

    return {
        "count": len(sandbox_list),
        "sandboxes": sandbox_list,
    }


@router.post("/maintenance/clean-sandboxes")
def maintenance_clean_sandboxes(
    admin_user: UserInDB = Depends(require_admin),
):
    """Kill and remove all orphan ai-sandbox containers."""
    from sandbox import cleanup_all_sandboxes
    cleaned_count = 0
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True, filters={"name": "ai-sandbox-"})
        cleaned_count = len(containers)
        cleanup_all_sandboxes()
    except Exception as e:
        logger.error(f"Maintenance clean sandboxes failed: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal membersihkan sandbox: {e}")

    return {
        "success": True,
        "message": f"Berhasil membersihkan {cleaned_count} kontainer sandbox",
        "cleaned_count": cleaned_count,
    }


@router.post("/maintenance/clean-temp")
def maintenance_clean_temp(
    admin_user: UserInDB = Depends(require_admin),
):
    """Clean up old temporary directories in temp root."""
    cleaned_dirs = 0
    reclaimed_bytes = 0
    try:
        temp_dir = Path(TEMP_ROOT)
        if temp_dir.exists():
            for item in temp_dir.iterdir():
                if item.is_dir() and item.name.startswith("sbx_"):
                    # Check age: older than 30 minutes
                    mtime = item.stat().st_mtime
                    if time.time() - mtime > 1800:
                        try:
                            # Estimate size
                            for f in item.glob("**/*"):
                                if f.is_file():
                                    reclaimed_bytes += f.stat().st_size
                            shutil.rmtree(item, ignore_errors=True)
                            cleaned_dirs += 1
                        except Exception:
                            pass
    except Exception as e:
        logger.error(f"Maintenance clean temp failed: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal membersihkan temp: {e}")

    reclaimed_mb = round(reclaimed_bytes / (1024 * 1024), 2)
    return {
        "success": True,
        "message": f"Berhasil membersihkan {cleaned_dirs} folder sementara ({reclaimed_mb} MB terbebas)",
        "cleaned_dirs": cleaned_dirs,
        "reclaimed_mb": reclaimed_mb,
    }


@router.post("/maintenance/clean-redis-jobs")
def maintenance_clean_redis_jobs(
    admin_user: UserInDB = Depends(require_admin),
):
    """Clean up stale active job keys in Redis."""
    cleaned_keys = 0
    try:
        from backend.core.job_store import _rc
        active_keys = _rc.keys("active:*:*")
        for k in active_keys:
            _rc.delete(k)
            cleaned_keys += 1
    except Exception as e:
        logger.error(f"Maintenance clean redis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal membersihkan Redis: {e}")

    return {
        "success": True,
        "message": f"Berhasil mereset {cleaned_keys} active job di Redis",
        "cleaned_keys": cleaned_keys,
    }
