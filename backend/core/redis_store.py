"""
Redis store untuk chat history & sessions.

Schema (project-scoped):
  sess:{user_id}:{project_id}:{session_id}   → Redis Hash
      fields: title, created_at, updated_at, messages_json
  sessidx:{user_id}:{project_id}             → Redis Sorted Set
      member=session_id, score=updated_at_timestamp (float, detik)
"""
import json
from datetime import datetime, timezone

import redis

try:
    from backend.core.config import REDIS_URL
except ImportError:
    REDIS_URL = "redis://localhost:6379/0"

redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def _sess_key(user_id: str, project_id: str, session_id: str) -> str:
    return f"sess:{user_id}:{project_id}:{session_id}"


def _idx_key(user_id: str, project_id: str) -> str:
    return f"sessidx:{user_id}:{project_id}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_to_score(iso: str) -> float:
    try:
        return datetime.fromisoformat(iso).timestamp()
    except Exception:
        return 0.0


# ── Public API ───────────────────────────────────────────────────────────────

def list_sessions(user_id: str, *, project_id: str) -> list[dict]:
    """Return list of session summaries for a project, newest first."""
    idx_key = _idx_key(user_id, project_id)
    session_ids = redis_client.zrevrange(idx_key, 0, -1)
    sessions = []
    for sid in session_ids:
        data = redis_client.hgetall(_sess_key(user_id, project_id, sid))
        if not data:
            redis_client.zrem(idx_key, sid)
            continue
        messages = json.loads(data.get("messages_json", "[]"))
        sessions.append({
            "session_id": sid,
            "title": data.get("title", ""),
            "created_at": data.get("created_at", ""),
            "updated_at": data.get("updated_at", ""),
            "message_count": len(messages),
        })
    return sessions


def get_session(user_id: str, project_id: str, session_id: str) -> dict | None:
    """Return full session dict or None if not found."""
    data = redis_client.hgetall(_sess_key(user_id, project_id, session_id))
    if not data:
        return None
    return {
        "title": data.get("title", ""),
        "created_at": data.get("created_at", ""),
        "updated_at": data.get("updated_at", ""),
        "messages": json.loads(data.get("messages_json", "[]")),
    }


def save_session(
    user_id: str,
    session_id: str,
    title: str,
    messages: list,
    *,
    project_id: str,
) -> str:
    """Create or update a session. Returns session_id."""
    sess_key = _sess_key(user_id, project_id, session_id)
    existing = redis_client.hget(sess_key, "created_at")
    now = _now_iso()

    redis_client.hset(sess_key, mapping={
        "title": title,
        "messages_json": json.dumps(messages, ensure_ascii=False),
        "created_at": existing or now,
        "updated_at": now,
    })
    redis_client.zadd(_idx_key(user_id, project_id), {session_id: _iso_to_score(now)})
    return session_id


def delete_session(user_id: str, project_id: str, session_id: str) -> bool:
    """Delete session. Returns True if it existed, False otherwise."""
    sess_key = _sess_key(user_id, project_id, session_id)
    existed = redis_client.exists(sess_key)
    if existed:
        redis_client.delete(sess_key)
        redis_client.zrem(_idx_key(user_id, project_id), session_id)
    return bool(existed)


def delete_sessions_for_project(user_id: str, project_id: str) -> int:
    """Delete all sessions for a project. Returns count deleted."""
    idx_key = _idx_key(user_id, project_id)
    session_ids = redis_client.zrange(idx_key, 0, -1)
    count = 0
    for sid in session_ids:
        sess_key = _sess_key(user_id, project_id, sid)
        if redis_client.exists(sess_key):
            redis_client.delete(sess_key)
            count += 1
    redis_client.delete(idx_key)
    return count
