"""Unit tests for backend.agent.intent — Intent Agent helpers.

Covers the pure helper functions (no LLM calls) plus run_intent_agent's
fallback path when the LLM client raises.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from backend.agent.intent import (
    MAX_CLARIFICATION_QUESTIONS,
    VALID_INTENTS,
    _extract_json_object,
    _normalize_questions,
    format_clarification_answer_context,
    run_intent_agent,
)


# ---------------------------------------------------------------------------
# _extract_json_object
# ---------------------------------------------------------------------------
class TestExtractJsonObject:
    def test_returns_none_for_empty_input(self):
        assert _extract_json_object("") is None
        assert _extract_json_object(None) is None  # type: ignore[arg-type]

    def test_parses_simple_object(self):
        result = _extract_json_object('{"intent": "eda"}')
        assert result == {"intent": "eda"}

    def test_strips_markdown_code_fence(self):
        raw = '```json\n{"intent": "ml", "confidence": 0.9}\n```'
        assert _extract_json_object(raw) == {"intent": "ml", "confidence": 0.9}

    def test_handles_nested_objects_and_arrays(self):
        # Critical: regex non-greedy approaches break on this; we use brace counting.
        raw = '''
        Some preamble text.
        {
          "intent": "ambiguous",
          "clarification_questions": [
            {"id": "q1", "question": "A?", "options": ["x", "y"]},
            {"id": "q2", "question": "B?", "options": ["1", "2"]}
          ],
          "needs_clarification": true
        }
        Trailing noise.
        '''
        result = _extract_json_object(raw)
        assert result is not None
        assert result["intent"] == "ambiguous"
        assert len(result["clarification_questions"]) == 2

    def test_handles_braces_inside_strings(self):
        raw = '{"question": "What is {scope}?", "options": ["a", "b"]}'
        result = _extract_json_object(raw)
        assert result == {"question": "What is {scope}?", "options": ["a", "b"]}

    def test_handles_escaped_quotes_inside_strings(self):
        raw = r'{"text": "He said \"hi\""}'
        result = _extract_json_object(raw)
        assert result == {"text": 'He said "hi"'}

    def test_returns_none_for_no_object(self):
        assert _extract_json_object("just plain text") is None

    def test_returns_none_for_invalid_json(self):
        assert _extract_json_object("{not valid json}") is None

    def test_returns_none_for_top_level_array(self):
        # Function explicitly only accepts top-level objects.
        assert _extract_json_object('["a", "b"]') is None


# ---------------------------------------------------------------------------
# _normalize_questions
# ---------------------------------------------------------------------------
class TestNormalizeQuestions:
    def test_returns_empty_for_non_list(self):
        assert _normalize_questions(None) == []
        assert _normalize_questions("not a list") == []
        assert _normalize_questions({"a": 1}) == []

    def test_skips_questions_with_too_few_options(self):
        questions = [{"question": "Only one?", "options": ["only"]}]
        assert _normalize_questions(questions) == []

    def test_skips_questions_with_empty_text(self):
        questions = [{"question": "", "options": ["a", "b"]}]
        assert _normalize_questions(questions) == []

    def test_assigns_default_id_when_missing(self):
        questions = [{"question": "What?", "options": ["a", "b"]}]
        result = _normalize_questions(questions)
        assert len(result) == 1
        assert result[0]["id"] == "q1"

    def test_caps_at_max_clarification_questions(self):
        # Build more questions than allowed — only the first MAX should survive.
        too_many = [
            {"question": f"Q{i}", "options": ["a", "b"]}
            for i in range(MAX_CLARIFICATION_QUESTIONS + 5)
        ]
        result = _normalize_questions(too_many)
        assert len(result) == MAX_CLARIFICATION_QUESTIONS

    def test_caps_options_at_5(self):
        questions = [{"question": "Many?", "options": [f"opt{i}" for i in range(10)]}]
        result = _normalize_questions(questions)
        assert len(result[0]["options"]) == 5

    def test_strips_whitespace_and_drops_empty_options(self):
        questions = [{"question": "Trim?", "options": ["  a  ", "", "  ", "b"]}]
        result = _normalize_questions(questions)
        assert result[0]["options"] == ["a", "b"]

    def test_preserves_allow_multiple_flag(self):
        questions = [
            {"question": "Multi?", "options": ["a", "b"], "allow_multiple": True},
            {"question": "Single?", "options": ["a", "b"]},
        ]
        result = _normalize_questions(questions)
        assert result[0]["allow_multiple"] is True
        assert result[1]["allow_multiple"] is False


# ---------------------------------------------------------------------------
# format_clarification_answer_context
# ---------------------------------------------------------------------------
class TestFormatClarificationAnswerContext:
    def test_returns_question_when_no_answers(self):
        result = format_clarification_answer_context("hello", {})
        assert result == "hello"

    def test_includes_single_string_answer(self):
        result = format_clarification_answer_context(
            "Original question", {"intent": "EDA"}
        )
        assert "Original question" in result
        assert "intent: EDA" in result
        assert "JAWABAN KLARIFIKASI" in result

    def test_joins_list_answers_with_comma(self):
        result = format_clarification_answer_context(
            "Q", {"choices": ["a", "b", "c"]}
        )
        assert "choices: a, b, c" in result


# ---------------------------------------------------------------------------
# run_intent_agent — fallback paths only (no real LLM calls)
# ---------------------------------------------------------------------------
class TestRunIntentAgent:
    def test_returns_safe_fallback_for_empty_question(self):
        result = run_intent_agent("", "files", "schema", model="any")
        assert result["needs_clarification"] is False
        assert result["intent"] == "ambiguous"
        assert result["clarification_questions"] == []

    def test_returns_safe_fallback_when_llm_raises(self):
        with patch("backend.agent.intent.build_llm", side_effect=RuntimeError("api down")):
            result = run_intent_agent("analisis dong", "data.csv", "", model="m")
        assert result["needs_clarification"] is False
        assert result["intent"] == "ambiguous"

    def test_clamps_confidence_to_unit_interval(self):
        from langchain_core.messages import AIMessage  # noqa: WPS433 — local import

        bogus_response = AIMessage(content='{"intent": "eda", "confidence": 99}')
        with patch("backend.agent.intent.build_llm") as mock_build, \
             patch("backend.agent.intent.invoke_with_retry", return_value=bogus_response):
            mock_build.return_value = object()
            result = run_intent_agent("buat eda", "f", "s", model="m")
        assert result["confidence"] == 1.0

    def test_downgrades_to_no_clarification_when_questions_invalid(self):
        from langchain_core.messages import AIMessage

        # Model says clarification needed but provides no valid questions ->
        # pipeline must not stall, so we force needs_clarification=False.
        payload = '{"intent": "ambiguous", "needs_clarification": true, "clarification_questions": []}'
        with patch("backend.agent.intent.build_llm") as mock_build, \
             patch("backend.agent.intent.invoke_with_retry", return_value=AIMessage(content=payload)):
            mock_build.return_value = object()
            result = run_intent_agent("?", "f", "s", model="m")
        assert result["needs_clarification"] is False

    def test_normalizes_unknown_intent_to_ambiguous(self):
        from langchain_core.messages import AIMessage

        payload = '{"intent": "unknown_thing", "confidence": 0.5, "needs_clarification": false}'
        with patch("backend.agent.intent.build_llm") as mock_build, \
             patch("backend.agent.intent.invoke_with_retry", return_value=AIMessage(content=payload)):
            mock_build.return_value = object()
            result = run_intent_agent("?", "f", "s", model="m")
        assert result["intent"] == "ambiguous"
        assert "ambiguous" in VALID_INTENTS  # sanity
