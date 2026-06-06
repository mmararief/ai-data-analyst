"""Unit tests for backend.agent.pipeline — single-agent pipeline logic.

Tests the routing and clarification flow without requiring Docker or LLM calls.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from backend.agent.pipeline import run_agent_stream


class TestClarificationFlow:
    """When multiple datasets exist and user doesn't mention one, pipeline should clarify."""

    def test_emits_clarification_when_multiple_datasets_no_mention(self, tmp_path):
        """Multiple dataset files and no mention in question -> clarification event."""
        (tmp_path / "sales.csv").write_text("a,b\n1,2")
        (tmp_path / "customers.xlsx").write_bytes(b"fake excel")

        # Mock the LLM call for clarification generation
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = json.dumps({
            "question": "File mana yang ingin dianalisis?",
            "options": ["sales.csv", "customers.xlsx", "Semua"]
        })
        mock_llm.invoke.return_value = mock_response

        with patch("backend.agent.pipeline.build_llm", return_value=mock_llm):
            events = list(run_agent_stream(
                data_folder=tmp_path,
                question="lakukan analisis lengkap",
                history=[],
            ))

        # Should emit clarification then done
        types = [e["type"] for e in events]
        assert "clarification" in types
        assert types[-1] == "done"

        clar = next(e for e in events if e["type"] == "clarification")
        assert len(clar["questions"]) == 1
        assert clar["questions"][0]["id"] == "select_dataset"

    def test_skips_clarification_when_file_mentioned(self, tmp_path):
        """If user mentions specific file name, no clarification needed."""
        (tmp_path / "sales.csv").write_text("a,b\n1,2")
        (tmp_path / "customers.csv").write_text("x,y\n3,4")

        # The pipeline should NOT emit clarification when file is mentioned.
        # It will proceed to create the agent, so we mock that part.
        mock_agent = MagicMock()
        mock_agent.get_state.return_value = MagicMock(values={})
        mock_agent.stream.return_value = iter([])  # No events from agent

        with patch("backend.agent.tools.create_agent", return_value=mock_agent), \
             patch("backend.core.config.MODEL_CHAT", "test-model"):
            events = list(run_agent_stream(
                data_folder=tmp_path,
                question="analisis file sales.csv",
                history=[],
            ))

        types = [e["type"] for e in events]
        assert "clarification" not in types

    def test_skips_clarification_with_single_dataset(self, tmp_path):
        """Single dataset file should never trigger clarification."""
        (tmp_path / "data.csv").write_text("col1,col2\n1,2")

        mock_agent = MagicMock()
        mock_agent.get_state.return_value = MagicMock(values={})
        mock_agent.stream.return_value = iter([])

        with patch("backend.agent.tools.create_agent", return_value=mock_agent), \
             patch("backend.core.config.MODEL_CHAT", "test-model"):
            events = list(run_agent_stream(
                data_folder=tmp_path,
                question="lakukan EDA lengkap",
                history=[],
            ))

        types = [e["type"] for e in events]
        assert "clarification" not in types

    def test_skips_clarification_when_history_exists(self, tmp_path):
        """If there's existing history, user has already been talking — skip clarification."""
        (tmp_path / "a.csv").write_text("x\n1")
        (tmp_path / "b.csv").write_text("y\n2")

        mock_agent = MagicMock()
        mock_agent.get_state.return_value = MagicMock(values={})
        mock_agent.stream.return_value = iter([])

        with patch("backend.agent.tools.create_agent", return_value=mock_agent), \
             patch("backend.core.config.MODEL_CHAT", "test-model"):
            events = list(run_agent_stream(
                data_folder=tmp_path,
                question="sekarang buat chart",
                history=[("user", "hello"), ("assistant", "hi")],
            ))

        types = [e["type"] for e in events]
        assert "clarification" not in types

    def test_excludes_dashboard_json_from_dataset_count(self, tmp_path):
        """dashboard.json should not count as a user dataset."""
        (tmp_path / "data.csv").write_text("a\n1")
        (tmp_path / "dashboard.json").write_text("{}")

        mock_agent = MagicMock()
        mock_agent.get_state.return_value = MagicMock(values={})
        mock_agent.stream.return_value = iter([])

        with patch("backend.agent.tools.create_agent", return_value=mock_agent), \
             patch("backend.core.config.MODEL_CHAT", "test-model"):
            events = list(run_agent_stream(
                data_folder=tmp_path,
                question="analisis data",
                history=[],
            ))

        types = [e["type"] for e in events]
        # Only 1 real dataset -> no clarification
        assert "clarification" not in types


class TestPipelineErrorHandling:
    """Pipeline propagates exceptions to the caller (worker_service handles them)."""

    def test_raises_on_agent_crash(self, tmp_path):
        """If create_agent raises, the exception propagates to the caller (worker_service)."""
        (tmp_path / "data.csv").write_text("a\n1")

        def crash_agent(*args, **kwargs):
            raise RuntimeError("LLM unavailable")

        with patch("backend.agent.tools.create_agent", side_effect=crash_agent), \
             patch("backend.core.config.MODEL_CHAT", "test-model"):
            with pytest.raises(RuntimeError, match="LLM unavailable"):
                list(run_agent_stream(
                    data_folder=tmp_path,
                    question="analisis",
                    history=[],
                ))
