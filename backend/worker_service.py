import logging
import shutil
import tempfile
from pathlib import Path

from backend.agent_runner import run_agent_stream, run_pro_stream
from backend.core.job_store import append_event, clear_active_job, finish_job, set_job_running
from backend.core.minio_store import download_user_files, upload_generated_files
from backend.core.redis_store import save_session as _redis_save_session

logger = logging.getLogger(__name__)


def process_job(payload: dict) -> None:
    """Execute a single queued chat job and publish events to Redis."""
    job_id = str(payload.get("job_id", "")).strip()
    user_id = str(payload.get("user_id", "")).strip()
    session_id = str(payload.get("session_id", "")).strip()
    question = str(payload.get("question", "")).strip()
    mode = str(payload.get("mode", "normal")).strip().lower()

    history_in = payload.get("history") or []
    history: list[tuple[str, str]] = []
    for item in history_in:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            history.append((str(item[0]), str(item[1])))

    if not job_id or not user_id or not session_id or not question:
        logger.warning(f"⚠️  Invalid job payload: missing required fields")
        return

    logger.info(f"🔄 Set job {job_id} status: queued → running")
    set_job_running(user_id, job_id)
    
    tmp = Path(tempfile.mkdtemp(prefix=f"sbx_{user_id[:8]}_"))
    acc_events: list[dict] = []

    try:
        logger.info(f"📁 Downloading user files from MinIO to {tmp}...")
        download_user_files(user_id, tmp)
        
        logger.info(f"🤖 Running agent (mode={mode})...")
        fn = run_pro_stream if mode == "pro" else run_agent_stream
        event_count = 0
        for event in fn(tmp, question, history=history):
            append_event(user_id, job_id, event)
            acc_events.append(event)
            event_count += 1
            
            # Log progress every 10 events
            if event_count % 10 == 0:
                logger.debug(f"   📊 {event_count} events emitted...")

        logger.info(f"📤 Uploading generated files back to MinIO...")
        upload_generated_files(user_id, tmp)
        
        logger.info(f"💾 Auto-saving session history...")
        _auto_save_session(user_id, session_id, question, history, acc_events)
        
        logger.info(f"✅ Marking job {job_id} as done")
        finish_job(user_id, job_id)
        
    except Exception as exc:
        logger.error(f"❌ Job {job_id} execution failed: {str(exc)}")
        err_event = {"type": "error", "content": str(exc)}
        append_event(user_id, job_id, err_event)
        acc_events.append(err_event)
        _auto_save_session(user_id, session_id, question, history, acc_events)
        finish_job(user_id, job_id, error=str(exc))
    finally:
        logger.info(f"🧹 Cleanup: clear active job & temp dir")
        clear_active_job(user_id, session_id)
        shutil.rmtree(tmp, ignore_errors=True)


def _auto_save_session(
    user_id: str,
    session_id: str,
    question: str,
    history: list[tuple[str, str]],
    events: list[dict],
) -> None:
    """Build full message list from history + events and persist to Redis."""
    messages = []

    for role, content in history:
        messages.append({
            "role": role,
            "content": content,
            "parts": [],
            "codeSteps": [],
            "images": [],
        })

    messages.append({
        "role": "user",
        "content": question,
        "parts": [{"type": "text", "content": question}],
        "codeSteps": [],
        "images": [],
    })

    ai_parts: list[dict] = []
    ai_code_steps: list[dict] = []
    ai_images: list[str] = []
    ai_content = ""

    for ev in events:
        t = ev.get("type")
        c = ev.get("content", "")
        if t == "text":
            ai_content += c
            if ai_parts and ai_parts[-1]["type"] == "text":
                ai_parts[-1]["content"] += c
            else:
                ai_parts.append({"type": "text", "content": c})
        elif t == "image":
            ai_parts.append({"type": "image", "content": c})
            ai_images.append(c)
        elif t == "code":
            ai_code_steps.append({"code": c, "output": "", "progressLines": []})
        elif t == "output":
            if ai_code_steps:
                ai_code_steps[-1]["output"] = c
        elif t == "streamlit":
            ai_parts.append({"type": "streamlit", "content": c})
        elif t == "plan":
            ai_parts.insert(0, {"type": "plan", "content": c})
        elif t == "task_start":
            ai_parts.append({
                "type": "task_start",
                "content": c,
                "index": ev.get("index"),
                "total": ev.get("total"),
            })

    messages.append({
        "role": "assistant",
        "content": ai_content,
        "parts": ai_parts,
        "codeSteps": ai_code_steps,
        "images": ai_images,
    })

    try:
        _redis_save_session(
            user_id=user_id,
            session_id=session_id,
            title=question[:80],
            messages=messages,
        )
    except Exception:
        pass
