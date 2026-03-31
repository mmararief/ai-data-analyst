import logging
import shutil
import tempfile
from pathlib import Path

from backend.agent_runner import run_agent_stream
from backend.core.automl import train_automl
from backend.core.job_store import append_event, clear_active_job, finish_job, set_job_running
from backend.core.minio_store import download_user_files, upload_generated_files
from backend.core.redis_store import save_session as _redis_save_session

logger = logging.getLogger(__name__)


def process_job(payload: dict) -> None:
    """Execute a single queued chat job and publish events to Redis."""
    job_id = str(payload.get("job_id", "")).strip()
    user_id = str(payload.get("user_id", "")).strip()
    session_id = str(payload.get("session_id", "")).strip()
    project_id = str(payload.get("project_id", "")).strip()
    question = str(payload.get("question", "")).strip()

    history_in = payload.get("history") or []
    history: list[tuple[str, str]] = []
    for item in history_in:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            history.append((str(item[0]), str(item[1])))

    if not job_id or not user_id or not session_id or not question or not project_id:
        logger.warning(f"⚠️  Invalid job payload: missing required fields")
        return

    logger.info(f"🔄 Set job {job_id} status: queued → running")
    set_job_running(user_id, job_id)
    
    tmp = Path(tempfile.mkdtemp(prefix=f"sbx_{user_id[:8]}_"))
    acc_events: list[dict] = []

    try:
        logger.info(f"📁 Downloading project files from MinIO to {tmp}...")
        download_user_files(user_id, tmp, project_id=project_id)
        
        logger.info("🤖 Running agent...")
        event_count = 0
        for event in run_agent_stream(tmp, question, history=history):
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
        append_event(user_id, job_id, err_event)
        acc_events.append(err_event)
        _auto_save_session(user_id, project_id, session_id, question, history, acc_events)
        finish_job(user_id, job_id, error=str(exc))
    finally:
        logger.info(f"🧹 Cleanup: clear active job & temp dir")
        clear_active_job(user_id, session_id)
        shutil.rmtree(tmp, ignore_errors=True)


def process_automl_job(payload: dict) -> None:
    """Execute a single AutoML training job and store the result in Redis."""
    job_id = str(payload.get("job_id", "")).strip()
    user_id = str(payload.get("user_id", "")).strip()
    session_id = str(payload.get("session_id", "")).strip()
    project_id = str(payload.get("project_id", "")).strip()
    dataset_name = str(payload.get("dataset_name", "")).strip()
    target_column = str(payload.get("target_column", "")).strip()
    problem_type = str(payload.get("problem_type", "auto")).strip()
    model_name = payload.get("model_name")
    test_size = float(payload.get("test_size", 0.2))
    random_state = int(payload.get("random_state", 42))

    if not job_id or not user_id or not dataset_name or not target_column:
        logger.warning("⚠️  Invalid AutoML job payload: missing required fields")
        return

    logger.info(f"🔄 Set AutoML job {job_id} status: queued → running")
    set_job_running(user_id, job_id)

    tmp = Path(tempfile.mkdtemp(prefix=f"aml_{user_id[:8]}_"))

    try:
        logger.info(f"📁 Downloading project files from MinIO to {tmp}...")
        download_user_files(user_id, tmp, project_id=project_id or None)

        logger.info(f"🤖 Running AutoML training (problem_type={problem_type})...")
        artifacts = train_automl(
            data_folder=tmp,
            dataset_name=dataset_name,
            target_column=target_column,
            problem_type=problem_type,
            model_name=model_name,
            test_size=test_size,
            random_state=random_state,
        )

        logger.info(f"📤 Uploading generated files back to MinIO...")
        upload_generated_files(user_id, tmp, project_id=project_id or None)

        append_event(user_id, job_id, {"type": "automl_result", "content": artifacts.metadata})

        logger.info(f"✅ Marking AutoML job {job_id} as done")
        finish_job(user_id, job_id)

    except Exception as exc:
        logger.error(f"❌ AutoML job {job_id} failed: {str(exc)}")
        append_event(user_id, job_id, {"type": "error", "content": str(exc)})
        finish_job(user_id, job_id, error=str(exc))
    finally:
        logger.info(f"🧹 Cleanup: clear active job (if any) & temp dir")
        if session_id:
            try:
                clear_active_job(user_id, session_id)
            except Exception:
                logger.warning("Failed to clear active job for AutoML session %s", session_id, exc_info=True)
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
        elif t == "critic":
            ai_parts.append({
                "type": "critic",
                "judgment": ev.get("judgment", "ok"),
                "feedback": ev.get("feedback", ""),
                "additional_tasks": ev.get("additional_tasks", []),
            })
        elif t == "automl_train_done":
            # Simpan ringkasan hasil AutoML agar bisa dilihat lagi di history
            automl_payload = {k: v for k, v in ev.items() if k != "type"}
            ai_parts.append({"type": "automl_train_done", **automl_payload})

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
