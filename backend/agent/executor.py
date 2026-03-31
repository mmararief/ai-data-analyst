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
    STREAMLIT_RE,
    extract_text,
)

TASK_TIMEOUT_SECONDS = 300


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
            for chunk in ag.stream({"messages": [("human", t)]}, {"recursion_limit": 40}):
                aq.put(("chunk", chunk))
            aq.put(("done", None))
        except Exception as exc:
            aq.put(("error", f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"))

    threading.Thread(target=_run, daemon=True).start()

    task_output_parts: list[str] = []
    automl_active = False
    deadline = time.monotonic() + TASK_TIMEOUT_SECONDS

    while True:
        if time.monotonic() > deadline:
            yield {"type": "error", "content": f"Task {task_index + 1} timeout setelah {TASK_TIMEOUT_SECONDS}s"}
            break

        while not task_progress_q.empty():
            msg = task_progress_q.get_nowait()
            if automl_active:
                yield {"type": "automl_progress", "content": msg}
            else:
                yield {"type": "progress", "content": msg}

        try:
            kind, data = task_agent_q.get(timeout=0.05)
        except queue.Empty:
            continue

        if kind == "done":
            while not task_progress_q.empty():
                msg = task_progress_q.get_nowait()
                if automl_active:
                    yield {"type": "automl_progress", "content": msg}
                else:
                    yield {"type": "progress", "content": msg}
            break
        if kind == "error":
            automl_active = False
            yield {"type": "error", "content": f"Task {task_index + 1} error: {data}"}
            break

        chunk = data
        if "agent" in chunk:
            msg = chunk["agent"]["messages"][0]
            text = extract_text(msg.content)
            if text:
                for sl_match in STREAMLIT_RE.finditer(text):
                    sl_filename = Path(sl_match.group(1).strip()).name
                    if sl_filename and sl_filename.endswith('.py') and '..' not in sl_filename:
                        yield {"type": "streamlit", "content": sl_filename}
                text = CHART_RE.sub("", STREAMLIT_RE.sub("", IMAGE_RE.sub("", text))).strip()
                text = REACT_TRACE_RE.sub("", text).strip()
                text = CHART_PATH_RE.sub("", text).strip()
                text = INTERNAL_PATH_RE.sub("", text).strip()
                if text:
                    task_output_parts.append(text)
                    yield {"type": "text", "content": text}
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc.get("name") == "python_repl_tool":
                        # Code snippet dikirim sekali; output berikutnya tetap via progress/output
                        code_str = tc["args"].get("code", "")
                        if code_str:
                            yield {"type": "code", "content": code_str}
                        # Saat tool baru dimulai, reset state AutoML agar tidak bocor
                        automl_active = False
                    elif tc.get("name") == "automl_train_tool":
                        ds = tc["args"].get("dataset_name", "dataset")
                        tgt = tc["args"].get("target_column", "target")
                        pt = tc["args"].get("problem_type", "auto")
                        automl_active = True
                        yield {
                            "type": "automl_train_start",
                            "dataset": ds,
                            "target": tgt,
                            "problem_type": pt,
                        }
                    elif tc.get("name") == "web_search_tool":
                        query = tc["args"].get("query", "")
                        yield {"type": "web_search", "query": query}
                    elif tc.get("name") == "file_export_tool":
                        fname = tc["args"].get("filename", "")
                        fmt = tc["args"].get("format", "")
                        yield {"type": "file_export_start", "filename": fname, "format": fmt}

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

            for sl_match in STREAMLIT_RE.finditer(tool_output):
                sl_filename = Path(sl_match.group(1).strip()).name
                if sl_filename and sl_filename.endswith('.py') and '..' not in sl_filename:
                    yield {"type": "streamlit", "content": sl_filename}

            clean_output = CHART_RE.sub("", IMAGE_RE.sub("", STREAMLIT_RE.sub("", tool_output))).strip()
            clean_output = CHART_PATH_RE.sub("", clean_output).strip()
            if clean_output:
                if automl_active and clean_output.startswith('{"type": "automl_train"'):
                    try:
                        automl_data = json.loads(clean_output)
                        automl_active = False
                        yield {"type": "automl_train_done", **automl_data}
                    except Exception:
                        automl_active = False
                        task_output_parts.append(clean_output)
                        yield {"type": "output", "content": clean_output}
                elif clean_output.startswith("AUTO_ML_ERROR:"):
                    automl_active = False
                    yield {"type": "error", "content": clean_output}
                elif clean_output.startswith('{"type": "web_search"'):
                    try:
                        ws_data = json.loads(clean_output)
                        yield {"type": "web_search_result", **ws_data}
                        task_output_parts.append(clean_output)
                    except Exception:
                        task_output_parts.append(clean_output)
                        yield {"type": "output", "content": clean_output}
                elif clean_output.startswith('{"type": "file_export"'):
                    try:
                        fe_data = json.loads(clean_output)
                        yield {"type": "file_export_done", **fe_data}
                        task_output_parts.append(clean_output)
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
    """Run multiple task generators in parallel, buffering per-task for clean sequential output."""
    if len(generators) == 1:
        yield from generators[0]
        return

    buffers: list[list[dict]] = [[] for _ in generators]
    finished = [False] * len(generators)

    def _drain(gen, buf, idx):
        try:
            for event in gen:
                buf.append(event)
        except Exception as e:
            buf.append({"type": "error", "content": str(e)})
        finally:
            finished[idx] = True

    threads = []
    for i, gen in enumerate(generators):
        t = threading.Thread(target=_drain, args=(gen, buffers[i], i), daemon=True)
        t.start()
        threads.append(t)

    # Join dengan timeout defensif; jika thread masih hidup setelah itu,
    # tandai buffer-nya dengan error timeout dan lanjutkan.
    for i, t in enumerate(threads):
        t.join(timeout=TASK_TIMEOUT_SECONDS + 30)
        if t.is_alive() and not finished[i]:
            buffers[i].append({
                "type": "error",
                "content": f"Task {i + 1} timeout setelah {TASK_TIMEOUT_SECONDS + 30}s di fase parallel",
            })
            finished[i] = True

    for buf in buffers:
        for event in buf:
            yield event
