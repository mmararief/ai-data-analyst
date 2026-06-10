"""Unit tests for backend.agent.llm — LLM factory and retry logic.

Covers:
  - build_llm provider routing (sumopod / ollama / missing deps)
  - invoke_with_retry retry & non-retry paths
  - stream_with_retry retry, fallback to invoke on NotImplementedError
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch, call

import pytest

from backend.agent.llm import build_llm, invoke_with_retry, stream_with_retry


# ---------------------------------------------------------------------------
# build_llm — provider routing
# ---------------------------------------------------------------------------
class TestBuildLlm:
    @patch("backend.agent.llm.ChatOpenAI")
    def test_sumopod_creates_chatopenai(self, mock_cls):
        with patch("backend.agent.llm.AI_PROVIDER", "sumopod"), \
             patch("backend.agent.llm.SUMOPOD_API_KEY", "sk-test"), \
             patch("backend.agent.llm.SUMOPOD_BASE_URL", "https://api.test.com"):
            build_llm("gpt-4o-mini", temperature=0.5, max_output_tokens=1024)
        mock_cls.assert_called_once()
        kwargs = mock_cls.call_args[1]
        assert kwargs["model"] == "gpt-4o-mini"
        assert kwargs["temperature"] == 0.5
        assert kwargs["api_key"] == "sk-test"

    @patch("backend.agent.llm.ChatOllama")
    def test_ollama_creates_chatollama(self, mock_cls):
        with patch("backend.agent.llm.AI_PROVIDER", "ollama"), \
             patch("backend.agent.llm.OLLAMA_BASE_URL", "http://localhost:11434"):
            build_llm("llama3", temperature=0.3, max_output_tokens=512)
        mock_cls.assert_called_once()
        kwargs = mock_cls.call_args[1]
        assert kwargs["model"] == "llama3"

    def test_sumopod_raises_without_api_key(self):
        with patch("backend.agent.llm.AI_PROVIDER", "sumopod"), \
             patch("backend.agent.llm.SUMOPOD_API_KEY", ""), \
             patch("backend.agent.llm.ChatOpenAI", MagicMock()):
            with pytest.raises(RuntimeError, match="SUMOPOD_API_KEY"):
                build_llm("gpt-4o", temperature=0, max_output_tokens=100)

    def test_ollama_raises_when_dep_missing(self):
        with patch("backend.agent.llm.AI_PROVIDER", "ollama"), \
             patch("backend.agent.llm.ChatOllama", None):
            with pytest.raises(RuntimeError, match="langchain-ollama"):
                build_llm("llama3", temperature=0, max_output_tokens=100)

    def test_sumopod_raises_when_dep_missing(self):
        with patch("backend.agent.llm.AI_PROVIDER", "sumopod"), \
             patch("backend.agent.llm.ChatOpenAI", None):
            with pytest.raises(RuntimeError, match="langchain-openai"):
                build_llm("gpt-4o", temperature=0, max_output_tokens=100)


# ---------------------------------------------------------------------------
# invoke_with_retry
# ---------------------------------------------------------------------------
class TestInvokeWithRetry:
    def test_succeeds_first_try(self):
        llm = MagicMock()
        llm.invoke.return_value = "answer"
        result = invoke_with_retry(llm, ["msg"], retries=3, backoff=0.01)
        assert result == "answer"
        assert llm.invoke.call_count == 1

    def test_retries_on_429(self):
        llm = MagicMock()
        llm.invoke.side_effect = [Exception("429 rate limit"), "ok"]
        result = invoke_with_retry(llm, ["msg"], retries=3, backoff=0.01)
        assert result == "ok"
        assert llm.invoke.call_count == 2

    def test_retries_on_503(self):
        llm = MagicMock()
        llm.invoke.side_effect = [Exception("503 overloaded"), "ok"]
        result = invoke_with_retry(llm, ["msg"], retries=3, backoff=0.01)
        assert result == "ok"

    def test_retries_on_status_code_500(self):
        exc = Exception("server error")
        exc.status_code = 500
        llm = MagicMock()
        llm.invoke.side_effect = [exc, "recovered"]
        result = invoke_with_retry(llm, ["msg"], retries=3, backoff=0.01)
        assert result == "recovered"

    def test_does_not_retry_on_non_transient_error(self):
        llm = MagicMock()
        llm.invoke.side_effect = ValueError("bad input")
        with pytest.raises(ValueError, match="bad input"):
            invoke_with_retry(llm, ["msg"], retries=3, backoff=0.01)
        assert llm.invoke.call_count == 1

    def test_exhausts_retries_then_raises(self):
        llm = MagicMock()
        llm.invoke.side_effect = Exception("429 rate limit")
        with pytest.raises(Exception, match="429"):
            invoke_with_retry(llm, ["msg"], retries=2, backoff=0.01)
        assert llm.invoke.call_count == 2


# ---------------------------------------------------------------------------
# stream_with_retry
# ---------------------------------------------------------------------------
class TestStreamWithRetry:
    def test_yields_tokens(self):
        llm = MagicMock()
        llm.stream.return_value = iter(["a", "b", "c"])
        result = list(stream_with_retry(llm, ["msg"], retries=3, backoff=0.01))
        assert result == ["a", "b", "c"]

    def test_falls_back_to_invoke_on_not_implemented(self):
        llm = MagicMock()
        llm.stream.side_effect = NotImplementedError()
        llm.invoke.return_value = "full_response"

        with patch("backend.agent.llm.invoke_with_retry", return_value="full_response") as mock_inv:
            result = list(stream_with_retry(llm, ["msg"], retries=3, backoff=0.01))
        assert result == ["full_response"]

    def test_retries_on_transient_error(self):
        llm = MagicMock()
        llm.stream.side_effect = [Exception("502 bad gateway"), iter(["ok"])]
        result = list(stream_with_retry(llm, ["msg"], retries=3, backoff=0.01))
        assert result == ["ok"]
        assert llm.stream.call_count == 2

    def test_does_not_retry_non_transient(self):
        llm = MagicMock()
        llm.stream.side_effect = TypeError("oops")
        with pytest.raises(TypeError, match="oops"):
            list(stream_with_retry(llm, ["msg"], retries=3, backoff=0.01))
        assert llm.stream.call_count == 1

    def test_exhausts_retries_and_raises(self):
        llm = MagicMock()
        llm.stream.side_effect = Exception("rate limit exceeded")
        with pytest.raises(Exception, match="rate limit"):
            list(stream_with_retry(llm, ["msg"], retries=2, backoff=0.01))
        assert llm.stream.call_count == 2
