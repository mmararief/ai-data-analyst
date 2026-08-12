"""Unit tests for backend.core.job_store — Redis job event buffer.

All Redis calls are mocked so no running Redis instance is needed.
Covers: create_job, set_job_running, append_event, finish_job, cancel_job,
        get_status, get_events_from, set_active_job, get_active_job,
        clear_active_job, enqueue_job, dequeue_job.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch, call

import pytest

from backend.core import job_store


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_redis():
    """Patch the module-level Redis client for every test."""
    mock_rc = MagicMock()
    with patch.object(job_store, "_rc", mock_rc):
        yield mock_rc


# ---------------------------------------------------------------------------
# Key builders
# ---------------------------------------------------------------------------
class TestKeyBuilders:
    def test_event_key(self):
        assert job_store._ek("u1", "j1") == "job:u1:j1:events"

    def test_status_key(self):
        assert job_store._sk("u1", "j1") == "job:u1:j1:status"

    def test_active_key(self):
        assert job_store._ak("u1", "s1") == "active:u1:s1"


# ---------------------------------------------------------------------------
# create_job
# ---------------------------------------------------------------------------
class TestCreateJob:
    def test_creates_pipeline_with_delete_and_set(self, mock_redis):
        pipe = MagicMock()
        mock_redis.pipeline.return_value = pipe

        job_store.create_job("user1", "job42")

        pipe.delete.assert_called_once_with("job:user1:job42:events")
        pipe.set.assert_called_once_with("job:user1:job42:status", "queued", ex=3600)
        pipe.execute.assert_called_once()


# ---------------------------------------------------------------------------
# set_job_running
# ---------------------------------------------------------------------------
class TestSetJobRunning:
    def test_sets_running_status(self, mock_redis):
        job_store.set_job_running("u1", "j1")
        mock_redis.set.assert_called_once_with("job:u1:j1:status", "running", ex=3600)


# ---------------------------------------------------------------------------
# append_event
# ---------------------------------------------------------------------------
class TestAppendEvent:
    def test_rpush_and_expire(self, mock_redis):
        event = {"type": "token", "data": "hello"}
        job_store.append_event("u1", "j1", event)
        mock_redis.rpush.assert_called_once()
        pushed_json = mock_redis.rpush.call_args[0][1]
        assert json.loads(pushed_json) == event
        mock_redis.expire.assert_called_once_with("job:u1:j1:events", 3600)


# ---------------------------------------------------------------------------
# finish_job
# ---------------------------------------------------------------------------
class TestFinishJob:
    def test_finish_success(self, mock_redis):
        job_store.finish_job("u1", "j1")
        mock_redis.set.assert_called_once_with("job:u1:j1:status", "done", ex=3600)

    def test_finish_with_error(self, mock_redis):
        job_store.finish_job("u1", "j1", error="timeout")
        args = mock_redis.set.call_args
        assert args[0][1].startswith("error:")
        assert "timeout" in args[0][1]

    def test_error_truncated_to_200_chars(self, mock_redis):
        long_msg = "x" * 500
        job_store.finish_job("u1", "j1", error=long_msg)
        status_val = mock_redis.set.call_args[0][1]
        # "error:" prefix + 200 chars max
        assert len(status_val) <= len("error:") + 200


# ---------------------------------------------------------------------------
# cancel_job
# ---------------------------------------------------------------------------
class TestCancelJob:
    def test_sets_cancelled_status(self, mock_redis):
        job_store.cancel_job("u1", "j1")
        mock_redis.set.assert_called_once_with("job:u1:j1:status", "cancelled", ex=3600)


# ---------------------------------------------------------------------------
# get_status
# ---------------------------------------------------------------------------
class TestGetStatus:
    def test_returns_status_string(self, mock_redis):
        mock_redis.get.return_value = "running"
        assert job_store.get_status("u1", "j1") == "running"

    def test_returns_none_when_missing(self, mock_redis):
        mock_redis.get.return_value = None
        assert job_store.get_status("u1", "j1") is None


# ---------------------------------------------------------------------------
# get_events_from
# ---------------------------------------------------------------------------
class TestGetEventsFrom:
    def test_returns_parsed_events(self, mock_redis):
        mock_redis.lrange.return_value = [
            '{"type":"token","data":"a"}',
            '{"type":"done"}',
        ]
        events = job_store.get_events_from("u1", "j1", start=0)
        assert len(events) == 2
        assert events[0]["type"] == "token"

    def test_skips_invalid_json(self, mock_redis):
        mock_redis.lrange.return_value = ['not-json{{{', '{"type":"ok"}']
        events = job_store.get_events_from("u1", "j1")
        assert len(events) == 1
        assert events[0]["type"] == "ok"

    def test_empty_when_no_events(self, mock_redis):
        mock_redis.lrange.return_value = []
        assert job_store.get_events_from("u1", "j1") == []


# ---------------------------------------------------------------------------
# Active-job helpers
# ---------------------------------------------------------------------------
class TestActiveJob:
    def test_set_and_get_active_job(self, mock_redis):
        job_store.set_active_job("u1", "s1", "j1", "what is sales?")
        args = mock_redis.set.call_args
        stored = json.loads(args[0][1])
        assert stored["job_id"] == "j1"
        assert stored["question"] == "what is sales?"

    def test_get_active_job_found(self, mock_redis):
        mock_redis.get.return_value = json.dumps({"job_id": "j1", "question": "q"})
        result = job_store.get_active_job("u1", "s1")
        assert result == {"job_id": "j1", "question": "q"}

    def test_get_active_job_not_found(self, mock_redis):
        mock_redis.get.return_value = None
        assert job_store.get_active_job("u1", "s1") is None

    def test_get_active_job_bad_json(self, mock_redis):
        mock_redis.get.return_value = "not-json"
        assert job_store.get_active_job("u1", "s1") is None

    def test_clear_active_job(self, mock_redis):
        job_store.clear_active_job("u1", "s1")
        mock_redis.delete.assert_called_once_with("active:u1:s1")


# ---------------------------------------------------------------------------
# Queue API
# ---------------------------------------------------------------------------
class TestQueueAPI:
    def test_enqueue_job(self, mock_redis):
        payload = {"job_id": "j1", "question": "test"}
        job_store.enqueue_job(payload)
        mock_redis.rpush.assert_called_once()
        pushed = json.loads(mock_redis.rpush.call_args[0][1])
        assert pushed["job_id"] == "j1"

    def test_dequeue_job_found(self, mock_redis):
        mock_redis.blpop.return_value = ("queue:jobs", '{"job_id":"j1"}')
        result = job_store.dequeue_job(timeout=1)
        assert result == {"job_id": "j1"}

    def test_dequeue_job_empty(self, mock_redis):
        mock_redis.blpop.return_value = None
        assert job_store.dequeue_job(timeout=1) is None

    def test_dequeue_job_bad_json(self, mock_redis):
        mock_redis.blpop.return_value = ("queue:jobs", "corrupt{")
        assert job_store.dequeue_job(timeout=1) is None
