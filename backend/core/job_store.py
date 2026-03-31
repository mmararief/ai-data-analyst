"""
Redis-backed event buffer untuk streaming agent jobs.

Setiap job menyimpan events di Redis sehingga client bisa reconnect
setelah refresh tanpa kehilangan hasil.

Keys (semua dengan TTL 1 jam):
  job:{user_id}:{job_id}:events  → Redis List (JSON event dicts)
    job:{user_id}:{job_id}:status  → String: "queued" | "running" | "done" | "error:..."
  active:{user_id}:{session_id}  → JSON {job_id, question}  (selama job berjalan)
    queue:jobs                     → Redis List (payload JSON untuk worker)
"""

import json
import redis

_JOB_TTL = 3600  # detik (1 jam)
_QUEUE_KEY = "queue:jobs"

try:
    from backend.core.config import REDIS_URL
except ImportError:
    REDIS_URL = "redis://localhost:6379/0"

_rc = redis.from_url(REDIS_URL, decode_responses=True)


def _ek(user_id: str, job_id: str) -> str:
    return f"job:{user_id}:{job_id}:events"


def _sk(user_id: str, job_id: str) -> str:
    return f"job:{user_id}:{job_id}:status"


def create_job(user_id: str, job_id: str) -> None:
    """Inisialisasi job baru di Redis."""
    pipe = _rc.pipeline()
    pipe.delete(_ek(user_id, job_id))
    pipe.set(_sk(user_id, job_id), "queued", ex=_JOB_TTL)
    pipe.execute()


def set_job_running(user_id: str, job_id: str) -> None:
    """Tandai job sedang diproses worker."""
    _rc.set(_sk(user_id, job_id), "running", ex=_JOB_TTL)


def append_event(user_id: str, job_id: str, event: dict) -> None:
    """Tambahkan satu event ke buffer job."""
    key = _ek(user_id, job_id)
    _rc.rpush(key, json.dumps(event, ensure_ascii=False))
    _rc.expire(key, _JOB_TTL)


def finish_job(user_id: str, job_id: str, error: str | None = None) -> None:
    """Tandai job selesai (atau error)."""
    status = f"error:{error[:200]}" if error else "done"
    _rc.set(_sk(user_id, job_id), status, ex=_JOB_TTL)


def get_status(user_id: str, job_id: str) -> str | None:
    """Return status string atau None jika job tidak ada / sudah expired."""
    return _rc.get(_sk(user_id, job_id))


def get_events_from(user_id: str, job_id: str, start: int = 0) -> list[dict]:
    """Return list events mulai dari index start."""
    raw = _rc.lrange(_ek(user_id, job_id), start, -1)
    result = []
    for r in raw:
        try:
            result.append(json.loads(r))
        except (json.JSONDecodeError, TypeError):
            pass
    return result


# ── Active-job per session (untuk reconnect dari tab/browser manapun) ──────

def _ak(user_id: str, session_id: str) -> str:
    return f"active:{user_id}:{session_id}"


def set_active_job(user_id: str, session_id: str, job_id: str, question: str) -> None:
    """Catat bahwa session ini sedang menjalankan job."""
    _rc.set(
        _ak(user_id, session_id),
        json.dumps({"job_id": job_id, "question": question}, ensure_ascii=False),
        ex=_JOB_TTL,
    )


def get_active_job(user_id: str, session_id: str) -> dict | None:
    """Return {job_id, question} atau None jika tidak ada job aktif."""
    raw = _rc.get(_ak(user_id, session_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def clear_active_job(user_id: str, session_id: str) -> None:
    """Hapus penanda active job (dipanggil setelah job selesai)."""
    _rc.delete(_ak(user_id, session_id))


# ── Queue API (producer/consumer) ───────────────────────────────────────────

def enqueue_job(payload: dict) -> None:
    """Masukkan job payload ke antrean Redis (FIFO)."""
    _rc.rpush(_QUEUE_KEY, json.dumps(payload, ensure_ascii=False))


def dequeue_job(timeout: int = 5) -> dict | None:
    """Ambil satu job payload dari antrean secara blocking."""
    item = _rc.blpop(_QUEUE_KEY, timeout=timeout)
    if not item:
        return None
    _, raw = item
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
