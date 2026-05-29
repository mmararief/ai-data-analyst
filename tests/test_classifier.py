"""Unit tests for backend.agent.classifier — request routing & simple-task detection."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from backend.agent.classifier import (
    classify_request_type,
    heuristic_route,
    is_simple_data_task,
)


# ---------------------------------------------------------------------------
# heuristic_route
# ---------------------------------------------------------------------------
class TestHeuristicRoute:
    def test_empty_input_is_smalltalk(self):
        assert heuristic_route("") == "smalltalk"
        assert heuristic_route("   ") == "smalltalk"

    @pytest.mark.parametrize("greeting", ["halo", "hai", "hello", "selamat pagi"])
    def test_greetings_route_to_smalltalk(self, greeting):
        assert heuristic_route(greeting) == "smalltalk"

    @pytest.mark.parametrize("casual", ["makasih", "terima kasih", "thanks", "ok"])
    def test_casual_acknowledgments_route_to_smalltalk(self, casual):
        assert heuristic_route(casual) == "smalltalk"

    @pytest.mark.parametrize("question", [
        "lakukan analisis data ini",
        "buat visualisasi distribusi harga",
        "tampilkan eda lengkap",
        "preprocessing dataset penjualan",
    ])
    def test_data_keywords_route_to_data_task(self, question):
        assert heuristic_route(question) == "data_task"

    def test_explain_pattern_without_data_keyword_is_smalltalk(self):
        # "apa itu cinta" — pure explain, no data terms
        assert heuristic_route("apa itu cinta") == "smalltalk"

    def test_explain_pattern_with_ml_keyword_routes_to_smalltalk(self):
        # Since web search was removed, explain + ML term is now handled as smalltalk
        assert heuristic_route("apa itu overfitting") == "smalltalk"
        assert heuristic_route("jelaskan random forest") == "smalltalk"

    def test_short_non_analytical_input_is_smalltalk(self):
        assert heuristic_route("ya benar") == "smalltalk"


# ---------------------------------------------------------------------------
# is_simple_data_task
# ---------------------------------------------------------------------------
class TestIsSimpleDataTask:
    @pytest.mark.parametrize("question", [
        "berapa baris dataset ini",
        "tampilkan 5 baris pertama",
        "head dataset",
        "kolom apa saja yang ada",
        "cek missing value",
    ])
    def test_known_simple_keywords(self, question):
        assert is_simple_data_task(question) is True

    @pytest.mark.parametrize("question", [
        "buat dashboard streamlit interaktif",
        "bangun model klasifikasi random forest",
        "lakukan eda lengkap dengan visualisasi",
    ])
    def test_complex_tasks_are_not_simple(self, question):
        assert is_simple_data_task(question) is False

    def test_handles_empty_input(self):
        assert is_simple_data_task("") is False
        assert is_simple_data_task(None) is False  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# classify_request_type — fast paths only (no real LLM calls)
# ---------------------------------------------------------------------------
class TestClassifyRequestType:
    def test_empty_input_is_smalltalk(self):
        assert classify_request_type("") == "smalltalk"

    def test_obvious_smalltalk_skips_llm(self):
        # Should not call build_llm at all for short greetings.
        with patch("backend.agent.classifier.build_llm") as mock_build:
            assert classify_request_type("halo") == "smalltalk"
        mock_build.assert_not_called()

    def test_falls_back_to_heuristic_when_llm_raises(self):
        with patch(
            "backend.agent.classifier.build_llm",
            side_effect=RuntimeError("api unavailable"),
        ):
            # "buat eda lengkap" has data keyword → heuristic returns data_task
            assert classify_request_type("buat eda lengkap dataset penjualan") == "data_task"
