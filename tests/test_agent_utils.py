"""Unit tests for backend.agent.utils — pure helper functions.

These tests cover the utility functions used by the single-agent pipeline.
No Docker or external services required.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.agent.utils import (
    CHART_PATH_RE,
    CHART_RE,
    IMAGE_RE,
    INTERNAL_PATH_RE,
    extract_text,
    list_data_contents,
    list_data_files,
    load_schema_context,
    load_schema_payload,
    answer_simple_task_from_schema,
    trim_content,
    parse_json_from_llm,
    _format_number_id,
)


# ---------------------------------------------------------------------------
# extract_text
# ---------------------------------------------------------------------------
class TestExtractText:
    def test_returns_string_as_is(self):
        assert extract_text("hello") == "hello"

    def test_returns_empty_for_none(self):
        assert extract_text(None) == ""

    def test_extracts_text_blocks_from_list(self):
        content = [
            {"type": "text", "text": "Hello"},
            {"type": "image", "url": "x.png"},
            {"type": "text", "text": "World"},
        ]
        assert extract_text(content) == "Hello World"

    def test_handles_empty_list(self):
        assert extract_text([]) == ""


# ---------------------------------------------------------------------------
# trim_content
# ---------------------------------------------------------------------------
class TestTrimContent:
    def test_short_content_unchanged(self):
        assert trim_content("abc", 100) == "abc"

    def test_long_content_trimmed(self):
        text = "A" * 200
        result = trim_content(text, 50)
        assert len(result) < 200
        assert "[dipotong]" in result

    def test_preserves_start_and_end(self):
        text = "START" + "x" * 200 + "END"
        result = trim_content(text, 50)
        assert result.startswith("START")
        assert result.endswith("END")


# ---------------------------------------------------------------------------
# list_data_files
# ---------------------------------------------------------------------------
class TestListDataFiles:
    def test_returns_empty_for_nonexistent_folder(self, tmp_path):
        fake = tmp_path / "nonexistent"
        assert list_data_files(fake) == []

    def test_excludes_underscore_and_dot_prefixed(self, tmp_path):
        (tmp_path / "data.csv").write_text("a,b")
        (tmp_path / "_internal.json").write_text("{}")
        (tmp_path / ".hidden").write_text("")
        result = list_data_files(tmp_path)
        assert result == ["data.csv"]

    def test_excludes_directories(self, tmp_path):
        (tmp_path / "subdir").mkdir()
        (tmp_path / "file.csv").write_text("x")
        assert list_data_files(tmp_path) == ["file.csv"]

    def test_sorted_output(self, tmp_path):
        (tmp_path / "z.csv").write_text("x")
        (tmp_path / "a.csv").write_text("x")
        assert list_data_files(tmp_path) == ["a.csv", "z.csv"]


# ---------------------------------------------------------------------------
# list_data_contents
# ---------------------------------------------------------------------------
class TestListDataContents:
    def test_empty_folder(self, tmp_path):
        result = list_data_contents(tmp_path)
        assert result == "- (belum ada file)"

    def test_lists_files(self, tmp_path):
        (tmp_path / "data.csv").write_text("a,b")
        result = list_data_contents(tmp_path)
        assert "/app/data/data.csv" in result

    def test_excludes_chart_files(self, tmp_path):
        (tmp_path / "_chart_abc.png").write_text("")
        (tmp_path / "real.csv").write_text("x")
        result = list_data_contents(tmp_path)
        assert "_chart_" not in result
        assert "real.csv" in result

    def test_shows_folder_with_count(self, tmp_path):
        sub = tmp_path / "exports"
        sub.mkdir()
        (sub / "report.html").write_text("<html>")
        result = list_data_contents(tmp_path)
        assert "exports/" in result
        assert "1 file" in result


# ---------------------------------------------------------------------------
# load_schema_payload / load_schema_context
# ---------------------------------------------------------------------------
class TestSchemaLoading:
    def test_returns_none_when_no_schema(self, tmp_path):
        assert load_schema_payload(tmp_path) is None

    def test_loads_valid_schema(self, tmp_path):
        schema = {"datasets": [{"file": "data.csv", "rows": 100, "columns": ["a", "b"]}]}
        (tmp_path / "_schema.json").write_text(json.dumps(schema))
        result = load_schema_payload(tmp_path)
        assert result == schema

    def test_returns_none_for_invalid_json(self, tmp_path):
        (tmp_path / "_schema.json").write_text("not json{{{")
        assert load_schema_payload(tmp_path) is None

    def test_context_includes_file_info(self, tmp_path):
        schema = {"datasets": [{"file": "sales.csv", "rows": 500, "columns": ["price", "qty"], "types": {"price": "float64", "qty": "int64"}}]}
        (tmp_path / "_schema.json").write_text(json.dumps(schema))
        ctx = load_schema_context(tmp_path)
        assert "sales.csv" in ctx
        assert "rows=500" in ctx
        assert "price" in ctx


# ---------------------------------------------------------------------------
# answer_simple_task_from_schema
# ---------------------------------------------------------------------------
class TestAnswerSimpleTask:
    @pytest.fixture
    def schema_folder(self, tmp_path):
        schema = {"datasets": [{"file": "data.csv", "rows": 1234, "columns": ["col_a", "col_b", "col_c"], "types": {"col_a": "int64", "col_b": "object", "col_c": "float64"}}]}
        (tmp_path / "_schema.json").write_text(json.dumps(schema))
        return tmp_path

    def test_answers_row_count(self, schema_folder):
        result = answer_simple_task_from_schema(schema_folder, "berapa baris dataset ini?")
        assert "1.234" in result

    def test_answers_column_count(self, schema_folder):
        result = answer_simple_task_from_schema(schema_folder, "berapa kolom dataset ini?")
        assert "3" in result

    def test_answers_column_names(self, schema_folder):
        result = answer_simple_task_from_schema(schema_folder, "kolom apa saja yang ada?")
        assert "col_a" in result
        assert "col_b" in result

    def test_answers_shape(self, schema_folder):
        result = answer_simple_task_from_schema(schema_folder, "tampilkan shape dataset")
        assert "(1234, 3)" in result

    def test_returns_none_for_unknown_question(self, schema_folder):
        result = answer_simple_task_from_schema(schema_folder, "buat visualisasi scatter plot")
        assert result is None

    def test_returns_none_without_schema(self, tmp_path):
        result = answer_simple_task_from_schema(tmp_path, "berapa baris")
        assert result is None


# ---------------------------------------------------------------------------
# _format_number_id
# ---------------------------------------------------------------------------
class TestFormatNumberId:
    def test_small_number(self):
        assert _format_number_id(42) == "42"

    def test_thousands(self):
        assert _format_number_id(1234) == "1.234"

    def test_millions(self):
        assert _format_number_id(1234567) == "1.234.567"


# ---------------------------------------------------------------------------
# parse_json_from_llm
# ---------------------------------------------------------------------------
class TestParseJsonFromLlm:
    def test_returns_none_for_empty(self):
        assert parse_json_from_llm("") is None
        assert parse_json_from_llm(None) is None

    def test_extracts_object(self):
        raw = 'Some text {"key": "value"} more text'
        assert parse_json_from_llm(raw) == {"key": "value"}

    def test_extracts_array(self):
        raw = 'Here is the plan: ["step 1", "step 2"]'
        assert parse_json_from_llm(raw) == ["step 1", "step 2"]

    def test_returns_none_for_invalid(self):
        assert parse_json_from_llm("no json here") is None


# ---------------------------------------------------------------------------
# Regex constants
# ---------------------------------------------------------------------------
class TestRegexConstants:
    def test_chart_re_matches(self):
        text = "[[CHART_FILE]]output.png[[/CHART_FILE]]"
        match = CHART_RE.search(text)
        assert match is not None
        assert match.group(1) == "output.png"

    def test_image_re_matches(self):
        text = "[[IMAGE_START]]base64data[[IMAGE_END]]"
        match = IMAGE_RE.search(text)
        assert match is not None
        assert match.group(1) == "base64data"

    def test_chart_path_re(self):
        text = "/app/data/_chart_abc123.png"
        assert CHART_PATH_RE.search(text) is not None

    def test_internal_path_re_matches_schema(self):
        text = "/app/data/_schema.json"
        assert INTERNAL_PATH_RE.search(text) is not None

    def test_internal_path_re_matches_ctx(self):
        text = "/app/data/_ctx_abc.pkl"
        assert INTERNAL_PATH_RE.search(text) is not None
