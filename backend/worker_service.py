import logging
import shutil
import tempfile
from pathlib import Path

from backend.agent_runner import run_agent_stream
from backend.core.config import TEMP_ROOT
from backend.core.job_store import append_event, clear_active_job, finish_job, set_job_running
from backend.core.minio_store import download_user_files, upload_generated_files
from backend.core.redis_store import save_session as _redis_save_session

logger = logging.getLogger(__name__)


class JobPayloadError(ValueError):
    """Raised when a queued payload is missing required fields.

    The worker loop catches this separately so the job is reported as failed
    (not silently dropped) while still being distinguishable from runtime
    errors inside the agent pipeline.
    """


def process_job(payload: dict) -> None:
    """Execute a single queued chat job and publish events to Redis.

    Raises:
        JobPayloadError: payload is missing required fields. Caller must
            still ensure ``finish_job`` and ``clear_active_job`` are invoked
            so the session does not get stuck.
        Exception: any other failure is re-raised after the job is marked as
            errored, so the worker loop can log a real failure (instead of
            misreporting it as success).
    """
    job_id = str(payload.get("job_id", "")).strip()
    user_id = str(payload.get("user_id", "")).strip()
    session_id = str(payload.get("session_id", "")).strip()
    project_id = str(payload.get("project_id", "")).strip()
    question = str(payload.get("question", "")).strip()
    mode = str(payload.get("mode", "full")).strip()
    approved_plan = payload.get("approved_plan")

    history_in = payload.get("history") or []
    history: list[tuple[str, str]] = []
    for item in history_in:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            history.append((str(item[0]), str(item[1])))

    if not job_id or not user_id or not session_id or not question or not project_id:
        missing = [
            name for name, val in [
                ("job_id", job_id), ("user_id", user_id), ("session_id", session_id),
                ("question", question), ("project_id", project_id),
            ] if not val
        ]
        msg = f"Invalid job payload: missing required fields {missing}"
        logger.warning("⚠️  %s", msg)
        # Try to clean up any state we *can* identify so the session/job is
        # not stuck. Best-effort — these calls must never raise.
        if user_id and job_id:
            try:
                finish_job(user_id, job_id, error=msg)
            except Exception:
                logger.debug("finish_job cleanup failed for invalid payload", exc_info=True)
        if user_id and session_id:
            try:
                clear_active_job(user_id, session_id)
            except Exception:
                logger.debug("clear_active_job cleanup failed for invalid payload", exc_info=True)
        raise JobPayloadError(msg)

    logger.info(f"🔄 Set job {job_id} status: queued → running")
    set_job_running(user_id, job_id)

    tmp = Path(tempfile.mkdtemp(prefix=f"sbx_{user_id[:8]}_", dir=str(TEMP_ROOT)))
    acc_events: list[dict] = []

    try:
        logger.info(f"📁 Downloading project files from MinIO to {tmp}...")
        download_user_files(user_id, tmp, project_id=project_id)

        logger.info("🤖 Running agent...")
        event_count = 0
        for event in run_agent_stream(
            tmp,
            question,
            history=history,
            mode=mode,
            approved_plan=approved_plan,
        ):
            append_event(user_id, job_id, event)
            acc_events.append(event)
            event_count += 1

            if event_count % 10 == 0:
                logger.debug(f"   📊 {event_count} events emitted...")

        logger.info(f"📤 Uploading generated files back to MinIO...")
        upload_generated_files(user_id, tmp, project_id=project_id)

        logger.info(f"💾 Auto-saving session history...")
        _auto_save_session(user_id, project_id, session_id, question, history, acc_events)

        logger.info(f"✅ Marking job {job_id} as done")
        finish_job(user_id, job_id)

    except Exception as exc:
        logger.error(f"❌ Job {job_id} execution failed: {str(exc)}")
        err_event = {"type": "error", "content": str(exc)}
        try:
            append_event(user_id, job_id, err_event)
        except Exception:
            logger.debug("append_event failed during error handling", exc_info=True)
        acc_events.append(err_event)
        try:
            _auto_save_session(user_id, project_id, session_id, question, history, acc_events)
        except Exception:
            logger.debug("auto-save failed during error handling", exc_info=True)
        try:
            finish_job(user_id, job_id, error=str(exc))
        except Exception:
            logger.debug("finish_job failed during error handling", exc_info=True)
        # Re-raise so the worker loop can log the real failure (and metrics
        # / alerting can react). Without this, _worker_loop misreported
        # every failed job as "completed successfully".
        raise
    finally:
        logger.info(f"🧹 Cleanup: clear active job & temp dir")
        from sandbox import cleanup_sandbox
        try:
            cleanup_sandbox(str(tmp))
        except Exception:
            logger.debug("cleanup_sandbox failed", exc_info=True)
        try:
            clear_active_job(user_id, session_id)
        except Exception:
            logger.debug("clear_active_job failed during cleanup", exc_info=True)
        shutil.rmtree(tmp, ignore_errors=True)





def _auto_save_session(
    user_id: str,
    project_id: str,
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
            "parts": [{"type": "text", "content": content}],
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
    plan_part: dict | None = None

    for ev in events:
        t = ev.get("type")
        c = ev.get("content", "")
        if t == "text":
            # Tambahkan pemisah baris agar paragraf tidak menempel
            if ai_content:
                ai_content += "\n\n"
            ai_content += c
            if ai_parts and ai_parts[-1]["type"] == "text":
                ai_parts[-1]["content"] += "\n\n" + c
            else:
                ai_parts.append({"type": "text", "content": c})
        elif t == "image":
            ai_parts.append({"type": "image", "content": c, "filename": ev.get("filename", "")})
            ai_images.append(c)
        elif t == "code":
            ai_code_steps.append({"code": c, "output": "", "progressLines": []})
            ai_parts.append({"type": "code_step", "stepIndex": len(ai_code_steps) - 1})
        elif t == "output":
            if ai_code_steps:
                ai_code_steps[-1]["output"] = c
        elif t == "plan":
            plan_part = {"type": "plan", "content": c}
        elif t == "task_start":
            ai_parts.append({
                "type": "task_start",
                "content": c,
                "index": ev.get("index"),
                "total": ev.get("total"),
            })
        elif t == "agent_label":
            ai_parts.append({"type": "agent_label", "content": c})
        elif t == "clarification":
            # Support both the new Intent Agent shape (questions: [...]) and
            # the legacy single-question shape (question + options) so that
            # historical sessions still render correctly.
            clar_part: dict = {"type": "clarification"}
            questions = ev.get("questions")
            if isinstance(questions, list) and questions:
                clar_part["questions"] = questions
            if ev.get("question"):
                clar_part["question"] = ev.get("question", "")
                clar_part["options"] = ev.get("options", [])
            if ev.get("intent"):
                clar_part["intent"] = ev.get("intent")
            if ev.get("reasoning"):
                clar_part["reasoning"] = ev.get("reasoning")
            ai_parts.append(clar_part)
        elif t == "critic":
            ai_parts.append({
                "type": "critic",
                "judgment": ev.get("judgment", "ok"),
                "feedback": ev.get("feedback", ""),
                "additional_tasks": ev.get("additional_tasks", []),
            })


    if plan_part:
        ai_parts.insert(0, plan_part)

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
            project_id=project_id,
        )
    except Exception as exc:
        logger.warning("Auto-save session %s failed: %s", session_id, exc)
