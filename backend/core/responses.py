"""Shared HTTP response helpers."""

from typing import Iterator

from fastapi.responses import StreamingResponse

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


def sse_response(generator: Iterator[str]) -> StreamingResponse:
    """Wrap a ``data: …\\n\\n`` generator in a ``StreamingResponse`` with standard SSE headers."""
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
