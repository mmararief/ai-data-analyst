"""Unit tests for backend.core.redis_store — session persistence layer.

All Redis calls are mocked. Covers: key builders, helpers, list_sessions,
get_session, save_session, delete_session, delete_sessions_for_project.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

from backend.core import redis_store


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_redis():
    """Patch the module-level redis_client for every test."""
    mock_rc = MagicMock()
    with patch.object(redis_store, "redis_client", mock_rc):
        yield mock_rc


# ---------------------------------------------------------------------------
# Key builders & utilities
# ---------------------------------------------------------------------------
class TestKeyBuilders:
    def test_sess_key(self):
        assert redis_store._sess_key("u1", "p1", "s1") == "sess:u1:p1:s1"

    def test_idx_key(self):
        assert redis_store._idx_key("u1", "p1") == "sessidx:u1:p1"


class TestHelpers:
    def test_now_iso_returns_utc(self):
        iso = redis_store._now_iso()
        dt = datetime.fromisoformat(iso)
        assert dt.tzinfo is not None

    def test_iso_to_score_valid(self):
        iso = "2024-06-01T12:00:00+00:00"
        score = redis_store._iso_to_score(iso)
        assert score > 0

    def test_iso_to_score_invalid(self):
        assert redis_store._iso_to_score("not-a-date") == 0.0


# ---------------------------------------------------------------------------
# list_sessions
# ---------------------------------------------------------------------------
class TestListSessions:
    def test_returns_sessions_newest_first(self, mock_redis):
        mock_redis.zrevrange.return_value = ["s2", "s1"]
        mock_redis.hgetall.side_effect = [
            {"title": "Second", "created_at": "t2", "updated_at": "t2",
             "messages_json": '[{"role":"user","content":"hi"}]'},
            {"title": "First", "created_at": "t1", "updated_at": "t1",
             "messages_json": "[]"},
        ]
        result = redis_store.list_sessions("u1", project_id="p1")
        assert len(result) == 2
        assert result[0]["session_id"] == "s2"
        assert result[0]["message_count"] == 1
        assert result[1]["message_count"] == 0

    def test_removes_orphaned_index_entries(self, mock_redis):
        mock_redis.zrevrange.return_value = ["s_orphan"]
        mock_redis.hgetall.return_value = {}  # no data
        result = redis_store.list_sessions("u1", project_id="p1")
        assert result == []
        mock_redis.zrem.assert_called_once_with("sessidx:u1:p1", "s_orphan")

    def test_empty_project(self, mock_redis):
        mock_redis.zrevrange.return_value = []
        assert redis_store.list_sessions("u1", project_id="p1") == []


# ---------------------------------------------------------------------------
# get_session
# ---------------------------------------------------------------------------
class TestGetSession:
    def test_found(self, mock_redis):
        mock_redis.hgetall.return_value = {
            "title": "My Session",
            "created_at": "t1",
            "updated_at": "t2",
            "messages_json": '[{"role":"user","content":"hello"}]',
        }
        sess = redis_store.get_session("u1", "p1", "s1")
        assert sess["title"] == "My Session"
        assert len(sess["messages"]) == 1

    def test_not_found(self, mock_redis):
        mock_redis.hgetall.return_value = {}
        assert redis_store.get_session("u1", "p1", "s1") is None

    def test_missing_messages_defaults_to_empty(self, mock_redis):
        mock_redis.hgetall.return_value = {"title": "T", "created_at": "", "updated_at": ""}
        sess = redis_store.get_session("u1", "p1", "s1")
        assert sess["messages"] == []


# ---------------------------------------------------------------------------
# save_session
# ---------------------------------------------------------------------------
class TestSaveSession:
    def test_creates_new_session(self, mock_redis):
        mock_redis.hget.return_value = None  # no existing created_at
        sid = redis_store.save_session(
            "u1", "s1", "Title", [{"role": "user", "content": "hi"}], project_id="p1",
        )
        assert sid == "s1"
        mock_redis.hset.assert_called_once()
        mapping = mock_redis.hset.call_args[1]["mapping"]
        assert mapping["title"] == "Title"
        msgs = json.loads(mapping["messages_json"])
        assert len(msgs) == 1

    def test_preserves_existing_created_at(self, mock_redis):
        mock_redis.hget.return_value = "2024-01-01T00:00:00+00:00"
        redis_store.save_session("u1", "s1", "Title", [], project_id="p1")
        mapping = mock_redis.hset.call_args[1]["mapping"]
        assert mapping["created_at"] == "2024-01-01T00:00:00+00:00"

    def test_updates_sorted_set_index(self, mock_redis):
        mock_redis.hget.return_value = None
        redis_store.save_session("u1", "s1", "T", [], project_id="p1")
        mock_redis.zadd.assert_called_once()


# ---------------------------------------------------------------------------
# delete_session
# ---------------------------------------------------------------------------
class TestDeleteSession:
    def test_deletes_existing(self, mock_redis):
        mock_redis.exists.return_value = True
        result = redis_store.delete_session("u1", "p1", "s1")
        assert result is True
        mock_redis.delete.assert_called_once_with("sess:u1:p1:s1")
        mock_redis.zrem.assert_called_once()

    def test_returns_false_for_nonexistent(self, mock_redis):
        mock_redis.exists.return_value = False
        result = redis_store.delete_session("u1", "p1", "s_missing")
        assert result is False
        mock_redis.delete.assert_not_called()


# ---------------------------------------------------------------------------
# delete_sessions_for_project
# ---------------------------------------------------------------------------
class TestDeleteSessionsForProject:
    def test_deletes_all_and_returns_count(self, mock_redis):
        mock_redis.zrange.return_value = ["s1", "s2", "s3"]
        mock_redis.exists.side_effect = [True, True, False]  # s3 already gone

        count = redis_store.delete_sessions_for_project("u1", "p1")
        assert count == 2
        # Index key itself should be deleted
        assert call("sessidx:u1:p1") in mock_redis.delete.call_args_list

    def test_empty_project_returns_zero(self, mock_redis):
        mock_redis.zrange.return_value = []
        assert redis_store.delete_sessions_for_project("u1", "p1") == 0
