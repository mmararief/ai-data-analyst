"""Task execution engine: runs agent tasks with timeout and event streaming."""

import base64
import json
import queue
import threading
import time
import traceback
from pathlib import Path

from backend.agent.tools import create_agent
from backend.agent.utils import (
    CHART_PATH_RE,
    CHART_RE,
    IMAGE_RE,
    INTERNAL_PATH_RE,
    REACT_TRACE_RE,
    extract_text,
)

TASK_TIMEOUT_SECONDS = 480  # 8 menit — cukup untuk model lokal (Ollama) yang lambat


def execute_task(
    data_folder: Path,
    task: str,
    task_index: int,
    total_tasks: int,
    agent_prompt: str,
    model_name: str,
    agent_type: str = "execution",
):
    """Generator that yields SSE events for executing a single task."""
    yield {
        "type": "task_start",
        "content": task,
        "index": task_index,
        "total": total_tasks,
        "agent": agent_type,
    }

    known_charts = set(
        f.name for f in data_folder.glob("_chart_*.png")
    ) if data_folder.exists() else set()

    task_progress_q: queue.Queue = queue.Queue()
    task_agent_q: queue.Queue = queue.Queue()
    exec_agent = create_agent(
        data_folder, agent_prompt, model=model_name, progress_queue=task_progress_q,
    )

    def _run(ag=exec_agent, aq=task_agent_q, t=task):
        try:
            for stream_mode, chunk in ag.stream(
                {"messages": [("human", t)]}, 
                {"recursion_limit": 40},
                stream_mode=["messages", "updates"]
            ):
                if stream_mode == "messages":
                    msg_chunk, metadata = chunk
                    if metadata.get("langgraph_node") == "agent":
                        if isinstance(msg_chunk.content, str) and msg_chunk.content:
                            aq.put(("token", msg_chunk.content))
                elif stream_mode == "updates":
                    aq.put(("chunk", chunk))
            aq.put(("done", None))
        except Exception as exc:
            aq.put(("error", f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"))

    threading.Thread(target=_run, daemon=True).start()

    task_output_parts: list[str] = []
    deadline = time.monotonic() + TASK_TIMEOUT_SECONDS

    while True:
        if time.monotonic() > deadline:
            yield {"type": "error", "content": f"Task {task_index + 1} timeout setelah {TASK_TIMEOUT_SECONDS}s"}
            break

        while not task_progress_q.empty():
            msg = task_progress_q.get_nowait()
            yield {"type": "progress", "content": msg}

        try:
            kind, data = task_agent_q.get(timeout=0.05)
        except queue.Empty:
            continue

        if kind == "done":
            while not task_progress_q.empty():
                msg = task_progress_q.get_nowait()
                yield {"type": "progress", "content": msg}
            break
        if kind == "error":
            yield {"type": "error", "content": f"Task {task_index + 1} error: {data}"}
            break

        if kind == "token":
            yield {"type": "text", "content": data}
            continue

        chunk = data
        if "agent" in chunk:
            msg = chunk["agent"]["messages"][0]
            text = extract_text(msg.content)
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc.get("name") == "python_repl_tool":
                        code_str = tc["args"].get("code", "")
                        if code_str:
                            yield {"type": "code", "content": code_str, "tool": "python_repl_tool"}
                            yield {"type": "text", "content": "\n"}
                    elif tc.get("name") == "read_data_tool":
                        fname = tc["args"].get("filename", "")
                        n_rows = tc["args"].get("n_rows", 5)
                        yield {"type": "code", "content": f"read_data_tool('{fname}', n_rows={n_rows})", "tool": "read_data_tool"}
                    elif tc.get("name") == "file_export_tool":
                        fname = tc["args"].get("filename", "")
                        fmt = tc["args"].get("format", "")
                        yield {"type": "file_export_start", "filename": fname, "format": fmt}
                    elif tc.get("name") == "data_profile_tool":
                        fname = tc["args"].get("filename", "")
                        yield {"type": "code", "content": f"data_profile_tool('{fname}')", "tool": "data_profile_tool"}
                    elif tc.get("name") == "render_chart_tool":
                        chart_code = tc["args"].get("code", "")
                        chart_fname = tc["args"].get("filename", "chart.png")
                        if chart_code:
                            yield {"type": "code", "content": chart_code, "tool": "render_chart_tool", "filename": chart_fname}
                            yield {"type": "text", "content": "\n"}
                        yield {"type": "chart_start", "filename": chart_fname}

                if text:
                    text_clean = CHART_RE.sub("", IMAGE_RE.sub("", text)).strip()
                    text_clean = REACT_TRACE_RE.sub("", text_clean).strip()
                    text_clean = CHART_PATH_RE.sub("", text_clean).strip()
                    text_clean = INTERNAL_PATH_RE.sub("", text_clean).strip()
                    if text_clean:
                        task_output_parts.append(text_clean)
                    # Output teks SUDAH di-stream lewat 'token', tidak perlu yield ulang

        elif "tools" in chunk:
            tool_output = chunk["tools"]["messages"][0].content
            if not isinstance(tool_output, str):
                tool_output = str(tool_output)

            found_charts = []
            for match in CHART_RE.finditer(tool_output):
                chart_filename = Path(match.group(1).strip()).name
                local_chart = data_folder / chart_filename
                if local_chart.exists():
                    with open(local_chart, "rb") as _f:
                        img_b64 = base64.b64encode(_f.read()).decode()
                    try:
                        local_chart.unlink()
                    except Exception:
                        pass
                    yield {"type": "image", "content": img_b64}
                    found_charts.append(chart_filename)
                    known_charts.add(chart_filename)

            if not found_charts:
                img_match = IMAGE_RE.search(tool_output)
                if img_match:
                    clean_b64 = img_match.group(1).replace('\n', '').replace('\r', '').strip()
                    yield {"type": "image", "content": clean_b64}
                    found_charts.append("base64")

            if not found_charts and data_folder.exists():
                for new_chart in data_folder.glob("_chart_*.png"):
                    if new_chart.name not in known_charts:
                        try:
                            with open(new_chart, "rb") as _f:
                                img_b64 = base64.b64encode(_f.read()).decode()
                            new_chart.unlink()
                            yield {"type": "image", "content": img_b64}
                            found_charts.append(new_chart.name)
                        except Exception:
                            pass
                        known_charts.add(new_chart.name)

            clean_output = CHART_RE.sub("", IMAGE_RE.sub("", tool_output)).strip()
            clean_output = CHART_PATH_RE.sub("", clean_output).strip()
            if clean_output:
                if clean_output.startswith('{"type": "file_export"'):
                    try:
                        fe_data = json.loads(clean_output)
                        yield {"type": "file_export_done", **fe_data}
                        task_output_parts.append(clean_output)
                    except Exception:
                        task_output_parts.append(clean_output)
                        yield {"type": "output", "content": clean_output}
                elif clean_output.startswith('{"type": "chart"'):
                    try:
                        chart_data = json.loads(clean_output)
                        chart_fname = chart_data.get("filename", "")
                        chart_error = chart_data.get("error", "")

                        if chart_fname and not chart_error:
                            local_chart = data_folder / chart_fname
                            # Retry for Docker volume sync
                            import os as _os
                            for _retry in range(30):
                                try:
                                    # Force refresh directory cache on Windows
                                    _os.listdir(str(data_folder))
                                except Exception:
                                    pass
                                if local_chart.exists() and local_chart.stat().st_size > 0:
                                    break
                                time.sleep(0.5)
                            if local_chart.exists() and local_chart.stat().st_size > 0:
                                with open(local_chart, "rb") as _cf:
                                    img_b64 = base64.b64encode(_cf.read()).decode()
                                try:
                                    local_chart.unlink()
                                except Exception:
                                    pass
                                yield {"type": "image", "content": img_b64, "filename": chart_fname}
                                task_output_parts.append(f"[chart: {chart_fname}]")

                        # ── Error path: tool reported an error ──
                        elif chart_error:
                            yield {"type": "error", "content": f"Chart error: {chart_error[:300]}"}
                    except Exception:
                        task_output_parts.append(clean_output)
                        yield {"type": "output", "content": clean_output}
                elif clean_output.startswith('{"status":'):
                    # Structured output from python_repl_tool
                    try:
                        repl_data = json.loads(clean_output)
                        inner = repl_data.get("output", "")
                        if inner:
                            task_output_parts.append(inner)
                            yield {"type": "output", "content": inner}
                    except Exception:
                        task_output_parts.append(clean_output)
                        yield {"type": "output", "content": clean_output}
                else:
                    task_output_parts.append(clean_output)
                    yield {"type": "output", "content": clean_output}

    yield {
        "type": "_task_output",
        "content": "\n".join(task_output_parts),
        "task": task,
        "index": task_index,
    }


def run_phase_parallel(generators):
    """Run multiple task generators in parallel, streaming events as they arrive.

    For a single generator, events are streamed directly (no overhead).
    For multiple generators, a shared queue collects events from all threads and
    yields them in near real-time (50ms polling) — no more waiting for the
    slowest task before showing anything to the user.
    """
    if len(generators) == 1:
        yield from generators[0]
        return

    _DONE = object()  # sentinel to signal a thread finished
    shared_q: queue.Queue = queue.Queue()
    n_tasks = len(generators)

    def _drain(gen):
        try:
            for event in gen:
                shared_q.put(event)
        except Exception as e:
            shared_q.put({"type": "error", "content": str(e)})
        finally:
            shared_q.put(_DONE)

    threads = []
    for gen in generators:
        t = threading.Thread(target=_drain, args=(gen,), daemon=True)
        t.start()
        threads.append(t)

    done_received = 0
    deadline = time.monotonic() + TASK_TIMEOUT_SECONDS + 30

    while done_received < n_tasks:
        if time.monotonic() > deadline:
            yield {
                "type": "error",
                "content": f"Parallel phase timeout setelah {TASK_TIMEOUT_SECONDS + 30}s",
            }
            break
        try:
            item = shared_q.get(timeout=0.05)
        except queue.Empty:
            continue
        if item is _DONE:
            done_received += 1
        else:
            yield item

    # Drain any remaining items that arrived after the last sentinel
    while not shared_q.empty():
        try:
            item = shared_q.get_nowait()
            if item is not _DONE:
                yield item
        except queue.Empty:
            break
