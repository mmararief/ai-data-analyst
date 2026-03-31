"""Backward-compatibility shim — all logic now lives in backend.agent.*"""

import warnings as _w

_w.filterwarnings("ignore", category=DeprecationWarning)

from backend.agent.pipeline import run_agent_stream  # noqa: F401

__all__ = ["run_agent_stream"]
