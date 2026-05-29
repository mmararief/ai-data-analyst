"""Unit tests for backend.worker_service.

Focus on the contract changes introduced by the recent bugfix pass:
  - Invalid payloads raise JobPayloadError (no more silent return)
  - Errors from the agent re-raise after cleanup (no more silent success)
  - Auto-save understands BOTH the new (`questions`) and legacy
    (`question` + `options`) clarification event shapes.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from backend.worker_service import (
    JobPayloadError,
    _auto_save_session,
    process_job,
)


# ---------------------------------------------------------------------------
# Helper: a payload that satisfies all required fields
# ---------------------------------------------------------------------------
def _valid_payload(**overrides) -> dict:
    base = {
        "job_id": "job-123",
        "user_id": "user-abc",
        "session_id": "sess-xyz",
        "project_id": "proj-1",
        "question": "berapa jumlah baris dataset",
        "history": [],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# process_job — payload validation
# ---------------------------------------------------------------------------
class TestProcessJobPayloadValidation:
    @pytest.mark.parametrize("missing_field", [
        "job_id", "user_id", "session_id", "project_id", "question",
    ])
    def test_raises_for_missing_required_field(self, missing_field):
        payload = _valid_payload(**{missing_field: ""})

        with patch("backend.worker_service.finish_job") as mock_finish, \
             patch("backend.worker_service.clear_active_job") as mock_clear:
            with pytest.raises(JobPayloadError) as exc_info:
                process_job(payload)

        assert missing_field in str(exc_info.value)
        # Cleanup is best-effort: only attempted when we know the user/job
        if missing_field not in {"user_id", "job_id"}:
            mock_finish.assert_called_once()
        if missing_field not in {"user_id", "session_id"}:
            mock_clear.assert_called_once()

    def test_does_not_call_set_job_running_for_invalid_payload(self):
        with patch("backend.worker_service.set_job_running") as mock_set, \
             patch("backend.worker_service.finish_job"), \
             patch("backend.worker_service.clear_active_job"):
            with pytest.raises(JobPayloadError):
                process_job(_valid_payload(question=""))
        mock_set.assert_not_called()

    def test_cleanup_failures_do_not_mask_original_error(self):
        # Even if Redis cleanup raises, the JobPayloadError must still surface
        # so the worker loop can log it correctly.
        with patch("backend.worker_service.finish_job", side_effect=Exception("redis down")), \
             patch("backend.worker_service.clear_active_job", side_effect=Exception("redis down")):
            with pytest.raises(JobPayloadError):
                process_job(_valid_payload(question=""))


# ---------------------------------------------------------------------------
# process_job — runtime error re-raise contract
# ---------------------------------------------------------------------------
class TestProcessJobRuntimeErrorReraise:
    def test_reraises_exception_from_agent_run(self):
        """The worker loop relies on this re-raise to log a real failure."""
        with patch("backend.worker_service.set_job_running"), \
             patch("backend.worker_service.download_user_files"), \
             patch("backend.worker_service.upload_generated_files"), \
             patch("backend.worker_service.append_event"), \
             patch("backend.worker_service.clear_active_job"), \
             patch("backend.worker_service.finish_job") as mock_finish, \
             patch("backend.worker_service._auto_save_session"), \
             patch(
                 "backend.worker_service.run_agent_stream",
                 side_effect=RuntimeError("agent crashed"),
             ):
            with pytest.raises(RuntimeError, match="agent crashed"):
                process_job(_valid_payload())

        # finish_job must be called with the error before the re-raise
        mock_finish.assert_called_once()
        _, kwargs = mock_finish.call_args
        assert kwargs.get("error") == "agent crashed"


# ---------------------------------------------------------------------------
# _auto_save_session — clarification event back-compat
# ---------------------------------------------------------------------------
class TestAutoSaveClarification:
    def test_persists_new_questions_array_format(self):
        events = [{
            "type": "clarification",
            "questions": [
                {"id": "q1", "question": "Goal?", "options": ["A", "B"], "allow_multiple": False},
            ],
            "intent": "ambiguous",
            "reasoning": "too vague",
        }]
        captured = {}

        def fake_save(**kwargs):
            captured.update(kwargs)

        with patch("backend.worker_service._redis_save_session", side_effect=fake_save):
            _auto_save_session("u", "p", "s", "?", [], events)

        assistant_msg = captured["messages"][-1]
        clar_part = next(p for p in assistant_msg["parts"] if p["type"] == "clarification")
        assert clar_part["questions"][0]["question"] == "Goal?"
        assert clar_part["intent"] == "ambiguous"
        assert clar_part["reasoning"] == "too vague"

    def test_persists_legacy_single_question_format(self):
        events = [{
            "type": "clarification",
            "question": "Old style?",
            "options": ["yes", "no"],
        }]
        captured = {}

        def fake_save(**kwargs):
            captured.update(kwargs)

        with patch("backend.worker_service._redis_save_session", side_effect=fake_save):
            _auto_save_session("u", "p", "s", "?", [], events)

        assistant_msg = captured["messages"][-1]
        clar_part = next(p for p in assistant_msg["parts"] if p["type"] == "clarification")
        assert clar_part["question"] == "Old style?"
        assert clar_part["options"] == ["yes", "no"]
