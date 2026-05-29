"""LLM client construction and retry logic."""

import logging
import os
import random
import time

try:
    from langchain_openai import ChatOpenAI
except Exception:
    ChatOpenAI = None

try:
    from langchain_ollama import ChatOllama
except Exception:
    ChatOllama = None

from backend.core.config import (
    AI_PROVIDER,
    SUMOPOD_API_KEY,
    SUMOPOD_BASE_URL,
    OLLAMA_BASE_URL,
)

logger = logging.getLogger(__name__)


def build_llm(model: str, temperature: float, max_output_tokens: int):
    """Create chat model client with per-model provider auto-detection.

    Provider resolution order:
    1. Check global AI_PROVIDER env variable (default to sumopod)
    """
    provider = (AI_PROVIDER or "sumopod").strip().lower()

    if provider == "ollama":
        if ChatOllama is None:
            raise RuntimeError("Dependency 'langchain-ollama' belum terpasang")
        # Nama model harus sama dengan yang ada di Ollama (contoh: "llama3", "qwen2.5")
        return ChatOllama(
            model=model,
            temperature=temperature,
            base_url=OLLAMA_BASE_URL,
        )

    # Default to SumoPod (OpenAI-compatible)
    if ChatOpenAI is None:
        raise RuntimeError("Dependency 'langchain-openai' belum terpasang")
    if not SUMOPOD_API_KEY:
        raise RuntimeError("SUMOPOD_API_KEY belum di-set")

    return ChatOpenAI(
        model=model,
        temperature=temperature,
        max_tokens=max_output_tokens,
        api_key=SUMOPOD_API_KEY,
        base_url=SUMOPOD_BASE_URL,
        timeout=120,
    )


def invoke_with_retry(llm, messages, *, retries: int = 3, backoff: float = 2.0):
    """Call llm.invoke with exponential-backoff retry on transient errors."""
    for attempt in range(1, retries + 1):
        try:
            return llm.invoke(messages)
        except Exception as exc:
            exc_str = str(exc).lower()
            retryable = any(tok in exc_str for tok in [
                "429",
                "rate limit",
                "502",
                "503",
                "overloaded",
                "resource exhausted",
                "quota",
            ])
            status_code = getattr(exc, "status_code", None)
            if status_code == 500:
                retryable = True

            if not retryable or attempt == retries:
                raise

            wait = (backoff ** attempt) + random.uniform(0, 1)
            logger.warning(
                "LLM invoke attempt %d/%d failed (%s), retrying in %.1fs",
                attempt,
                retries,
                exc,
                wait,
            )
            time.sleep(wait)


def stream_with_retry(llm, messages, *, retries: int = 3, backoff: float = 2.0):
    """Stream tokens from llm.stream() with retry on transient errors.

    Yields AIMessageChunk objects token by token.
    Falls back to non-streaming invoke if stream is not supported.
    """
    for attempt in range(1, retries + 1):
        try:
            yield from llm.stream(messages)
            return
        except NotImplementedError:
            # Provider doesn't support streaming – fall back to single invoke
            response = invoke_with_retry(llm, messages, retries=retries, backoff=backoff)
            yield response
            return
        except Exception as exc:
            exc_str = str(exc).lower()
            retryable = any(tok in exc_str for tok in [
                "429",
                "rate limit",
                "502",
                "503",
                "overloaded",
                "resource exhausted",
                "quota",
            ])
            status_code = getattr(exc, "status_code", None)
            if status_code == 500:
                retryable = True

            if not retryable or attempt == retries:
                raise

            wait = (backoff ** attempt) + random.uniform(0, 1)
            logger.warning(
                "LLM stream attempt %d/%d failed (%s), retrying in %.1fs",
                attempt,
                retries,
                exc,
                wait,
            )
            time.sleep(wait)

