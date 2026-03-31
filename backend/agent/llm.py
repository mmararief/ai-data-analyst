"""LLM client construction and retry logic."""

import logging
import os
import random
import time

from langchain_google_genai import ChatGoogleGenerativeAI

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
    GOOGLE_API_KEY,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_HTTP_REFERER,
    OPENROUTER_APP_TITLE,
    OLLAMA_BASE_URL,
)

logger = logging.getLogger(__name__)


def build_llm(model: str, temperature: float, max_output_tokens: int):
    """Create chat model client with per-model provider auto-detection.

    Provider resolution order:
    1. model starts with 'gemini'  -> Google
    2. model contains '/'          -> OpenRouter  (e.g. stepfun/step-3.5-flash:free)
    3. fallback to global AI_PROVIDER env variable
    """
    model_lower = (model or "").lower()
    if model_lower.startswith("gemini"):
        provider = "google"
    elif "/" in model_lower:
        provider = "openrouter"
    else:
        provider = (AI_PROVIDER or "google").strip().lower()

    if provider == "ollama":
        if ChatOllama is None:
            raise RuntimeError("Dependency 'langchain-ollama' belum terpasang")
        # Nama model harus sama dengan yang ada di Ollama (contoh: "llama3", "qwen2.5")
        return ChatOllama(
            model=model,
            temperature=temperature,
            base_url=OLLAMA_BASE_URL,
        )

    if provider == "openrouter":
        if ChatOpenAI is None:
            raise RuntimeError("Dependency 'langchain-openai' belum terpasang")
        if not OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY belum di-set")

        headers = {}
        if OPENROUTER_HTTP_REFERER:
            headers["HTTP-Referer"] = OPENROUTER_HTTP_REFERER
        if OPENROUTER_APP_TITLE:
            headers["X-Title"] = OPENROUTER_APP_TITLE

        kwargs = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_output_tokens,
            "api_key": OPENROUTER_API_KEY,
            "base_url": OPENROUTER_BASE_URL,
            "timeout": 120,
        }
        if headers:
            kwargs["default_headers"] = headers
        return ChatOpenAI(**kwargs)

    # Google Gemini provider
    if not GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY belum di-set")

    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        google_api_key=GOOGLE_API_KEY,
        request_timeout=120,
    )


def invoke_with_retry(llm, messages, *, retries: int = 3, backoff: float = 2.0):
    """Call llm.invoke with exponential-backoff retry on transient errors."""
    for attempt in range(1, retries + 1):
        try:
            # Timeout dikonfigurasi di level client (mis. ChatOpenAI(timeout=...),
            # ChatGoogleGenerativeAI(request_timeout=...)). Di sini jangan kirim
            # argumen timeout tambahan karena tidak semua backend mendukungnya.
            return llm.invoke(messages)
        except Exception as exc:
            exc_str = str(exc).lower()
            # Hanya pattern yang jelas-jelas transient; 500 di-skip untuk
            # menghindari false positive berbasis string.
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
