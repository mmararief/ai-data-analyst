"""Shared pytest fixtures.

Sets up a stub for the ``sandbox`` module so tests do not require Docker, and
provides a few small helpers that are useful across the suite.
"""

from __future__ import annotations

import os
import sys
import types
from pathlib import Path

import pytest


# Ensure the project root is on sys.path so `from backend... import ...` works
# when pytest is invoked from any working directory.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ---------------------------------------------------------------------------
# Stub the `sandbox` module BEFORE importing any backend.agent.* submodules.
# `sandbox.py` lives at the repo root and depends on Docker — we don't need
# real execution for unit tests, just an importable shim.
# ---------------------------------------------------------------------------
def _install_sandbox_stub() -> None:
    if "sandbox" in sys.modules:
        return
    stub = types.ModuleType("sandbox")

    def run_ai_code_securely(*args, **kwargs):  # noqa: D401
        """Test stub: returns an empty string instead of running Docker."""
        return ""

    def stream_ai_code_securely(*args, **kwargs):  # noqa: D401
        """Test stub: yields nothing instead of streaming Docker output."""
        return iter(())

    stub.run_ai_code_securely = run_ai_code_securely
    stub.stream_ai_code_securely = stream_ai_code_securely
    sys.modules["sandbox"] = stub


_install_sandbox_stub()


# ---------------------------------------------------------------------------
# Provide deterministic env defaults so config import does not fail and tests
# remain hermetic regardless of the developer's local .env file.
# ---------------------------------------------------------------------------
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("SUMOPOD_API_KEY", "test-sumopod-api-key")
os.environ.setdefault("MYSQL_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("MODEL_CHAT", "gpt-4o-mini-test")


@pytest.fixture
def empty_data_folder(tmp_path: Path) -> Path:
    """Return an empty temporary folder usable as the agent's data directory."""
    return tmp_path
