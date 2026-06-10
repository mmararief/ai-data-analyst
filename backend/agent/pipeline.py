"""Single-agent pipeline with multiple tools for data analysis.

Replaces the previous 4-agent pipeline (Intent → Planner → Executor → Critic)
with a single ReAct agent that has all tools available.

Events emitted:
  {"type": "text"|"code"|"output"|"progress"|"image"|"error", "content": "..."}
  {"type": "clarification", "questions": [...]}
  {"type": "done"}
"""

import json
import logging
import time
import base64
import threading
from pathlib import Path

from backend.agent.llm import build_llm, stream_with_retry
from backend.agent.prompts import (
    build_direct_llm_prompt,
    SINGLE_AGENT_SYSTEM_PROMPT,
)
from backend.agent.utils import (
    cleanup_context_files,
    extract_text,
    list_data_contents,
    load_schema_context,
    CHART_RE,
    IMAGE_RE,
    REACT_TRACE_RE,
    CHART_PATH_RE,
    INTERNAL_PATH_RE,
)

logger = logging.getLogger(__name__)



def run_agent_stream(
    data_folder: Path,
    question: str,
    history: list | None = None,
    system_prompt: str = None,
    mode: str = "full",
    approved_plan: list | None = None,
):
    """Single-agent pipeline: route → agent with tools → done.

    Uses one ReAct agent with all tools (python_repl, read_data, render_chart,
    file_export, data_profile, bash). No Intent/Planner/Critic overhead.
    """
    from backend.core.config import MODEL_CHAT
    from backend.agent.tools import create_agent
    from backend.agent.utils import list_data_files

    history = history or []
    question = question or ""

    try:
        # Interactive clarification for multiple user-uploaded datasets
        # Exclude dashboard.json, scripts, and non-dataset formats
        all_files = list_data_files(data_folder)
        files = [
            f for f in all_files
            if f.lower() != 'dashboard.json'
            and (f.lower().endswith('.csv') or f.lower().endswith('.xlsx') or f.lower().endswith('.xls') or f.lower().endswith('.json') or f.lower().endswith('.parquet') or f.lower().endswith('.pkl') or f.lower().endswith('.joblib'))
        ]

        if not history and len(files) > 1 and not question.startswith("Klarifikasi:\n"):
            # Check if any file name or its stem is mentioned in the question (case-insensitive)
            q_lower = question.lower()
            mentioned_files = []
            for f in files:
                f_lower = f.lower()
                stem = Path(f).stem.lower()
                if f_lower in q_lower or stem in q_lower:
                    mentioned_files.append(f)
            
            if not mentioned_files:
                # Dynamically generate natural clarification question and options using LLM
                try:
                    llm = build_llm(model=MODEL_CHAT, temperature=0.3, max_output_tokens=1000)
                    file_list_str = "\n".join(f"- {f}" for f in files)
                    system_prompt_clar = (
                        "Anda adalah Asisten Analis Data bahasa Indonesia untuk aplikasi asisten analisis data.\n"
                        "Tugas Anda adalah membuat 1 pertanyaan klarifikasi pilihan ganda yang sangat natural, komunikatif, dan kontekstual "
                        "berdasarkan daftar file dataset yang tersedia dan pertanyaan pengguna.\n"
                        "DILARANG keras menggunakan emoji, emotikon, atau simbol dekoratif sejenis baik dalam pertanyaan maupun pilihan opsi.\n"
                        f"Daftar file dataset yang tersedia:\n{file_list_str}\n\n"
                        f"Pertanyaan Pengguna: \"{question}\"\n\n"
                        "Format output HARUS berupa JSON valid dengan struktur berikut:\n"
                        "{\n"
                        "  \"question\": \"Pertanyaan klarifikasi yang ramah dan natural dalam bahasa Indonesia\",\n"
                        "  \"options\": [\"Pilihan Opsi 1\", \"Pilihan Opsi 2\", ...]\n"
                        "}\n"
                        "Gunakan nama file yang nyata dari daftar di atas untuk opsi. "
                        "Hanya keluarkan JSON valid tanpa markdown (jangan gunakan ```json atau ```), tanpa teks lain."
                    )
                    from langchain_core.messages import HumanMessage
                    res = llm.invoke([HumanMessage(content=system_prompt_clar)])
                    
                    import re
                    clean_res = res.content.strip()
                    clean_res = re.sub(r"^```(?:json)?\s*", "", clean_res)
                    clean_res = re.sub(r"\s*```$", "", clean_res)
                    
                    data = json.loads(clean_res)
                    clar_question = data.get("question", "Saya mendeteksi beberapa file dataset di workspace Anda. File mana yang ingin Anda analisis?")
                    options = data.get("options", ["Analisis Semua (Gabungkan)", *files])
                except Exception:
                    logger.warning("LLM clarification generation failed, using static fallback", exc_info=True)
                    clar_question = "Saya mendeteksi beberapa file dataset di workspace Anda. File mana yang ingin Anda analisis?"
                    options = ["Analisis Semua (Gabungkan)", *files]

                yield {
                    "type": "clarification",
                    "questions": [
                        {
                            "id": "select_dataset",
                            "question": clar_question,
                            "options": options,
                            "allow_multiple": True,
                        }
                    ]
                }
                yield {"type": "done"}
                return

        file_list = list_data_contents(data_folder)
        schema_context = load_schema_context(data_folder)


        prompt = SINGLE_AGENT_SYSTEM_PROMPT.format(
            file_list=file_list,
            schema_context=schema_context,
        )

        if system_prompt:
            prompt = system_prompt

        task_progress_q = None
        import queue as _queue

        task_agent_q: _queue.Queue = _queue.Queue()
        task_progress_q = _queue.Queue()

        initial_files = {}
        if data_folder.exists():
            for p in data_folder.rglob("*"):
                if p.is_file():
                    try:
                        stat = p.stat()
                        initial_files[p.relative_to(data_folder).as_posix()] = (stat.st_mtime, stat.st_size)
                    except Exception:
                        pass

        agent = create_agent(
            data_folder,
            system_prompt=prompt,
            model=MODEL_CHAT,
            progress_queue=task_progress_q,
        )

        def _run_agent(ag=agent, aq=task_agent_q, t=question, pq=task_progress_q, hist=history):
            import traceback
            try:
                active_tools = {}
                
                messages = []
                from backend.core.config import MAX_HISTORY_MESSAGES, MAX_HISTORY_CONTENT_LEN
                from backend.agent.utils import trim_content
                
                trimmed_hist = hist[-MAX_HISTORY_MESSAGES:] if hist else []
                for role, content in trimmed_hist:
                    c = trim_content(content, MAX_HISTORY_CONTENT_LEN)
                    if role == "user":
                        messages.append(("human", c))
                    else:
                        messages.append(("ai", c))
                        
                messages.append(("human", t))

                import uuid
                # Use deterministic session ID for persistence during this run
                thread_id = str(uuid.uuid5(uuid.NAMESPACE_OID, str(data_folder)))
                config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 40}

                # Check if we already have state for this thread_id
                state = ag.get_state(config)
                if not state.values.get("messages"):
                    # First time this session is running, initialize checkpointer with trimmed history + new question
                    input_messages = messages
                else:
                    # History already in checkpointer, only append the new question
                    input_messages = [("human", t)]

                for stream_mode, chunk in ag.stream(
                    {"messages": input_messages},
                    config,
                    stream_mode=["messages", "updates"]
                ):
                    if stream_mode == "messages":
                        msg_chunk, metadata = chunk
                        if metadata.get("langgraph_node") == "agent":
                            if isinstance(msg_chunk.content, str) and msg_chunk.content:
                                aq.put(("token", msg_chunk.content))
                            if hasattr(msg_chunk, "tool_call_chunks") and msg_chunk.tool_call_chunks:
                                for tc_chunk in msg_chunk.tool_call_chunks:
                                    tc_idx = tc_chunk.get("index")
                                    if "name" in tc_chunk and tc_chunk["name"]:
                                        active_tools[tc_idx] = tc_chunk["name"]
                                    
                                    args_chunk = tc_chunk.get("args")
                                    if args_chunk:
                                        t_name = active_tools.get(tc_idx, "")
                                        if t_name != "update_task_list_tool":
                                            aq.put(("code_chunk", args_chunk))
                    elif stream_mode == "updates":
                        aq.put(("chunk", chunk))
                aq.put(("done", None))
            except Exception as exc:
                aq.put(("error", f"{type(exc).__name__}: {exc}"))

        threading.Thread(target=_run_agent, daemon=True).start()

        TASK_TIMEOUT = 480
        deadline = time.monotonic() + TASK_TIMEOUT

        while True:
            if time.monotonic() > deadline:
                yield {"type": "error", "content": f"Timeout setelah {TASK_TIMEOUT}s"}
                break

            while task_progress_q and not task_progress_q.empty():
                try:
                    msg = task_progress_q.get_nowait()
                    if msg.startswith('{"type": "task_widget_update"'):
                        try:
                            yield json.loads(msg)
                        except Exception:
                            yield {"type": "progress", "content": msg}
                    else:
                        yield {"type": "progress", "content": msg}
                except Exception:
                    break

            try:
                kind, data = task_agent_q.get(timeout=0.05)
            except Exception:
                continue

            if kind == "done":
                if task_progress_q:
                    while not task_progress_q.empty():
                        try:
                            msg = task_progress_q.get_nowait()
                            if msg.startswith('{"type": "task_widget_update"'):
                                try:
                                    yield json.loads(msg)
                                except Exception:
                                    yield {"type": "progress", "content": msg}
                            else:
                                yield {"type": "progress", "content": msg}
                        except Exception:
                            break
                break

            if kind == "error":
                yield {"type": "error", "content": str(data)}
                break

            if kind == "token":
                yield {"type": "text", "content": data}
                continue

            if kind == "code_chunk":
                yield {"type": "code_chunk", "content": data}
                continue

            chunk = data
            if "agent" in chunk:
                msg = chunk["agent"]["messages"][0]
                text = extract_text(msg.content)
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        name = tc.get("name", "")
                        args = tc.get("args", {})
                        if name == "python_repl_tool":
                            code_str = args.get("code", "")
                            if code_str:
                                yield {"type": "code", "content": code_str, "tool": "python_repl_tool"}
                                yield {"type": "text", "content": "\n"}
                        elif name == "download_dataset_tool":
                            url = args.get("url", "")
                            fname = args.get("filename", "")
                            yield {"type": "code", "content": f"download_dataset_tool(url='{url}', filename='{fname}')", "tool": "download_dataset_tool"}
                        elif name == "read_data_tool":
                            fname = args.get("filename", "")
                            n_rows = args.get("n_rows", 5)
                            yield {"type": "code", "content": f"read_data_tool('{fname}', n_rows={n_rows})", "tool": "read_data_tool"}
                        elif name == "file_export_tool":
                            fname = args.get("filename", "")
                            fmt = args.get("format", "")
                            yield {"type": "file_export_start", "filename": fname, "format": fmt}
                        elif name == "data_profile_tool":
                            fname = args.get("filename", "")
                            yield {"type": "code", "content": f"data_profile_tool('{fname}')", "tool": "data_profile_tool"}
                        elif name == "render_chart_tool":
                            chart_code = args.get("code", "")
                            chart_fname = args.get("filename", "chart.png")
                            if chart_code:
                                yield {"type": "code", "content": chart_code, "tool": "render_chart_tool", "filename": chart_fname}
                                yield {"type": "text", "content": "\n"}
                            yield {"type": "chart_start", "filename": chart_fname}
                        elif name == "bash_tool":
                            cmd = args.get("command", "")
                            yield {"type": "code", "content": f"$ {cmd}", "tool": "bash_tool"}

            elif "tools" in chunk:
                for tool_msg in chunk["tools"]["messages"]:
                    tool_output = tool_msg.content
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
    
                    if not found_charts:
                        img_match = IMAGE_RE.search(tool_output)
                        if img_match:
                            clean_b64 = img_match.group(1).replace('\n', '').replace('\r', '').strip()
                            yield {"type": "image", "content": clean_b64}
    
                    clean_output = CHART_RE.sub("", IMAGE_RE.sub("", tool_output)).strip()
                    clean_output = CHART_PATH_RE.sub("", clean_output).strip()
                    clean_output = INTERNAL_PATH_RE.sub("", clean_output).strip()
    
                    if clean_output:
                        if clean_output.startswith('{"type": "file_export"'):
                            try:
                                fe_data = json.loads(clean_output)
                                yield {"type": "file_export_done", **fe_data}
                                if fe_data.get("error"):
                                    yield {"type": "output", "content": f"❌ Gagal ekspor file: {fe_data['error']}"}
                                else:
                                    yield {"type": "output", "content": f"✅ File diekspor: {fe_data.get('filename')}"}
                            except Exception:
                                yield {"type": "output", "content": clean_output}
                        elif clean_output.startswith('{"type": "chart"'):
                            try:
                                chart_data = json.loads(clean_output)
                                chart_fname = chart_data.get("filename", "")
                                chart_error = chart_data.get("error", "")
                                if chart_fname and not chart_error:
                                    local_chart = data_folder / chart_fname
                                    import os as _os
                                    for _ in range(30):
                                        try:
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
                                        yield {"type": "output", "content": f"✅ Chart berhasil dibuat: {chart_fname}"}
                                elif chart_error:
                                    yield {"type": "error", "content": f"Chart error: {chart_error[:300]}"}
                                    yield {"type": "output", "content": f"❌ Gagal membuat chart: {chart_error[:300]}"}
                            except Exception:
                                yield {"type": "output", "content": clean_output}
                        elif clean_output.startswith('{"status":'):
                            try:
                                repl_data = json.loads(clean_output)
                                inner = repl_data.get("output", "")
                                if inner:
                                    yield {"type": "output", "content": inner}
                            except Exception:
                                yield {"type": "output", "content": clean_output}
        if data_folder.exists():
            final_files = {}
            for p in data_folder.rglob("*"):
                if p.is_file():
                    try:
                        stat = p.stat()
                        final_files[p.relative_to(data_folder).as_posix()] = (stat.st_mtime, stat.st_size)
                    except Exception:
                        pass
            
            modified_or_new = []
            for rel_path, (mtime, size) in final_files.items():
                if rel_path not in initial_files:
                    modified_or_new.append(rel_path)
                else:
                    old_mtime, old_size = initial_files[rel_path]
                    if old_mtime != mtime or old_size != size:
                        modified_or_new.append(rel_path)
            
            for rel_path in modified_or_new:
                filename = Path(rel_path).name
                if filename in {"_exec_script.py", "_kernel_loop.py", "_schema.json", ".chats.json"} or filename.startswith('_chart_') or filename.startswith('_exec_') or filename.startswith('_kernel_'):
                    continue
                if rel_path.lower().endswith(('.png', '.jpg', '.jpeg', '.svg')):
                    continue
                fpath = data_folder / rel_path
                try:
                    ext = fpath.suffix.lstrip('.').lower() or "txt"
                    yield {
                        "type": "file_export_done",
                        "filename": rel_path,
                        "format": ext,
                        "size_bytes": fpath.stat().st_size
                    }
                except Exception:
                    pass

        yield {"type": "done"}

    finally:
        cleanup_context_files(data_folder)
