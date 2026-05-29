import json
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.core.security import get_current_user
from backend.models.user import UserInDB
from backend.agent_runner import run_agent_stream
from backend.core.config import TEMP_ROOT
from backend.core.minio_store import download_user_files, upload_generated_files
from backend.core.job_store import (
    create_job, get_status, get_events_from, enqueue_job,
    set_active_job, get_active_job, clear_active_job,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    project_id: str
    history: Optional[List[HistoryMessage]] = Field(default_factory=list)

class StartRequest(BaseModel):
    question: str
    project_id: str
    history: Optional[List[HistoryMessage]] = Field(default_factory=list)
    session_id: Optional[str] = None
    mode: Optional[str] = "full"
    approved_plan: Optional[list] = None

# ── Existing endpoints (kept for backward compat) ──────────────────────────

@router.post("/stream")
def chat_stream(req: ChatRequest, user: UserInDB = Depends(get_current_user)):
    history = [(m.role, m.content) for m in req.history] if req.history else []
    user_id = user.user_id

    def event_generator():
        tmp = Path(tempfile.mkdtemp(prefix=f"sbx_{user_id[:8]}_", dir=str(TEMP_ROOT)))
        try:
            download_user_files(user_id, tmp, project_id=req.project_id)
            for event in run_agent_stream(tmp, req.question, history=history):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            upload_generated_files(user_id, tmp, project_id=req.project_id)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── New job-based endpoints ─────────────────────────────────────────────────

@router.post("/start")
def chat_start(req: StartRequest, user: UserInDB = Depends(get_current_user)):
    """
    Start an agent job by enqueueing it to Redis for worker service.
    Returns job_id + session_id immediately — client connects to /chat/events/{job_id}.
    """
    job_id = str(uuid.uuid4())
    session_id = req.session_id or str(uuid.uuid4())
    user_id = user.user_id
    history = [(m.role, m.content) for m in req.history] if req.history else []

    create_job(user_id, job_id)
    set_active_job(user_id, session_id, job_id, req.question)
    enqueue_job({
        "job_id": job_id,
        "user_id": user_id,
        "session_id": session_id,
        "project_id": req.project_id,
        "question": req.question,
        "history": history,
        "mode": req.mode,
        "approved_plan": req.approved_plan,
        "submitted_at": time.time(),
    })
    return {"job_id": job_id, "session_id": session_id}


@router.get("/events/{job_id}")
def chat_events(
    job_id: str,
    from_idx: int = 0,
    user: UserInDB = Depends(get_current_user),
):
    """
    SSE endpoint: replay buffered events from from_idx, then stream live until done.
    On reconnect after refresh, call with from_idx=0 to replay everything.
    """
    user_id = user.user_id

    def event_stream():
        idx = from_idx
        while True:
            status = get_status(user_id, job_id)
            if status is None:
                yield f"data: {json.dumps({'type': 'error', 'content': 'Job tidak ditemukan atau sudah kadaluarsa'}, ensure_ascii=False)}\n\n"
                break

            new_events = get_events_from(user_id, job_id, start=idx)
            for ev in new_events:
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            idx += len(new_events)

            if status not in ("queued", "running"):
                break

            time.sleep(0.05)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/job/{job_id}")
def get_job_info(job_id: str, user: UserInDB = Depends(get_current_user)):
    """Check job status — used by frontend to decide whether to reconnect."""
    status = get_status(user.user_id, job_id)
    return {
        "exists": status is not None,
        "queued": status == "queued",
        "running": status == "running",
        "done": status == "done",
        "status": status,
    }


@router.get("/session/{session_id}/active-job")
def get_session_active_job(
    session_id: str,
    user: UserInDB = Depends(get_current_user),
):
    """
    Check if there is an active (running) job for this session.
    Works from ANY tab/browser — no dependency on sessionStorage.
    Returns {active: true, job_id, question} or {active: false}.
    """
    info = get_active_job(user.user_id, session_id)
    if not info:
        return {"active": False}

    job_id = info["job_id"]
    status = get_status(user.user_id, job_id)
    if status is None or status not in ("queued", "running"):
        clear_active_job(user.user_id, session_id)
        return {"active": False, "done": status == "done"}

    return {
        "active": True,
        "job_id": job_id,
        "question": info.get("question", ""),
        "status": status,
    }
