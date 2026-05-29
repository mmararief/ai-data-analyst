"""Main 3-agent pipeline: Planner -> Executor -> Critic."""

import json
import re
from collections import defaultdict
from pathlib import Path

from backend.agent.classifier import (
    classify_request_type,
    is_simple_data_task,
)
from backend.agent.critic import run_critic_agent
from backend.agent.executor import execute_task, run_phase_parallel
from backend.agent.intent import run_intent_agent
from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import (
    CHART_RULE,
    CONTEXT_RULE,
    OUTPUT_DISCIPLINE_RULE,
    PLANNER_SYSTEM_PROMPT,
)
from backend.agent.simple_handler import run_direct_llm, run_simple_data_task
from backend.agent.utils import (
    build_history_context,
    cleanup_context_files,
    extract_text,
    list_data_contents,
    load_schema_context,
    parse_json_from_llm,
)


def run_agent_stream(
    data_folder: Path,
    question: str,
    history: list | None = None,
    system_prompt: str = None,
    mode: str = "full",
    approved_plan: list | None = None,
):
    """
    4-agent pipeline: Intent -> Planner -> Executor -> Critic.

    Each role uses its own model (configurable via env vars):
      MODEL_INTENT   -- intent comprehension & clarification (default: MODEL_CHAT)
      MODEL_PLANNER  -- reasoning/planning  (default: MODEL_CHAT)
      MODEL_EXECUTOR -- code execution       (default: MODEL_CHAT)
      MODEL_CRITIC   -- evaluation/feedback  (default: MODEL_CHAT)

    Events emitted:
      {"type": "agent_label", "content": "Intent|Planner|Execution|Critic"}
      {"type": "plan",        "content": [{"task": "...", "agent": "execution"}, ...]}
      {"type": "task_start",  "content": "...", "index": i, "total": n, "agent": "..."}
      {"type": "text"|"code"|"output"|"progress"|"image"|"error", "content": "..."}
      {"type": "clarification", "questions": [{id, question, options, allow_multiple}, ...]}
      {"type": "critic",      "judgment": "ok"|"refine", "feedback": "...", "additional_tasks": [...]}
      {"type": "done"}
    """
    from backend.core.config import (
        MODEL_CHAT, MODEL_INTENT, MODEL_PLANNER, MODEL_EXECUTOR, MODEL_CRITIC,
    )

    history = history or []

    try:
        file_list = list_data_contents(data_folder)
        schema_context = load_schema_context(data_folder)

        if mode in ["full", "plan_only"]:
            request_type = classify_request_type(question, model=MODEL_CHAT, history=history)
            if request_type == "smalltalk":
                yield from run_direct_llm(question, history=history, model=MODEL_CHAT, file_list=file_list)
                return

        # Pastikan simple data task langsung dijawab tanpa full pipeline (hanya jika full mode)
        # Jangan intercept di sini jika sedang dalam konteks follow-up data task
        from backend.agent.classifier import _has_pending_data_context
        if mode == "full" and is_simple_data_task(question) and not _has_pending_data_context(history):
            yield from run_simple_data_task(
                data_folder, question, MODEL_EXECUTOR, file_list, schema_context, history=history
            )
            return

        history_text = build_history_context(history)

        # -- Step 0: Intent Agent (MODEL_INTENT) --
        # Skip the Intent layer when an approved plan is supplied — the user has
        # already passed the clarification stage and we should go straight to
        # execution. Also skip in pure execute_only mode for the same reason.
        effective_question = question
        skip_intent = bool(approved_plan) or mode == "execute_only"

        if not skip_intent and mode in ["full", "plan_only"]:
            yield {"type": "agent_label", "content": "Intent"}
            intent_result = run_intent_agent(
                question=question,
                file_list=file_list,
                schema_context=schema_context,
                model=MODEL_INTENT,
                history=history,
            )

            # If the Intent Agent decided we need to ask the user, emit
            # clarification and STOP the pipeline here. The frontend will
            # collect the answers and re-submit a refined query.
            if intent_result.get("needs_clarification") and intent_result.get("clarification_questions"):
                yield {
                    "type": "clarification",
                    "questions": intent_result["clarification_questions"],
                    "intent": intent_result.get("intent"),
                    "reasoning": intent_result.get("reasoning", ""),
                }
                yield {"type": "done", "status": "waiting_clarification"}
                return

            if intent_result.get("intent") not in ["eda", "viz"]:
                yield from run_direct_llm(question, history=history, model=MODEL_CHAT, file_list=file_list)
                return

            # No clarification needed — use rewritten query if Intent Agent
            # produced a more specific version of the user's request.
            rewritten = intent_result.get("rewritten_query")
            if rewritten:
                effective_question = rewritten
                
            # Berikan basa-basi / salam sebelum Planner memikirkan rencana (agar pengguna tidak bingung menunggu)
            opening = intent_result.get("opening_message")
            if opening and isinstance(opening, str) and opening.strip():
                yield {"type": "text", "content": opening.strip()}

        if approved_plan and mode in ["execute_only", "full"]:
            plan = approved_plan
        else:
            # -- Step 1: Planner Agent (MODEL_PLANNER) --
            yield {"type": "agent_label", "content": "Planner"}

            planner_system = PLANNER_SYSTEM_PROMPT.format(
                file_list=file_list,
                schema_context=schema_context,
            )

            plan = [{"task": effective_question, "agent": "execution", "phase": 0}]
            try:
                llm_planner = build_llm(model=MODEL_PLANNER, temperature=0, max_output_tokens=1024)
                planner_input = effective_question + history_text
                response = invoke_with_retry(llm_planner, [("system", planner_system), ("human", planner_input)])
                raw = response.content if isinstance(response.content, str) else extract_text(response.content)
                json_match = re.search(r"\{.*\}", raw, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    if isinstance(parsed, dict):
                        plan_data = parsed.get("plan", [])
                        if isinstance(plan_data, list) and plan_data:
                            plan = [
                                {
                                    "task": str(item.get("task", item)),
                                    "agent": "execution",
                                    "phase": idx,  # Always sequential — prevents interleaved text output
                                }
                                if isinstance(item, dict)
                                else {"task": str(item), "agent": "execution", "phase": idx}
                                for idx, item in enumerate(plan_data)
                            ]
            except Exception:
                pass

            yield {"type": "plan", "content": plan}

            if mode == "plan_only":
                yield {"type": "done", "status": "waiting_approval"}
                return

        # -- Step 2: Execution Agent (MODEL_EXECUTOR) --
        yield {"type": "agent_label", "content": "Execution"}

        executor_base = (
            "Kamu adalah Execution Agent. Eksekusi tugas berikut.\n\n"
            f"Dataset di '/app/data/':\n{file_list}\n\n"
            f"{schema_context}\n\n"
            "Aturan:\n"
            "- Gunakan read_data_tool untuk inspect struktur dataset sebelum analisis (shape, kolom, tipe, preview)\n"
            "- Gunakan render_chart_tool untuk SEMUA visualisasi, grafik, dan chart — JANGAN gunakan python_repl_tool untuk membuat chart\n"
            "- Gunakan python_repl_tool untuk analisis data, EDA, preprocessing, dan operasi data lainnya\n"
            "- Gunakan file_export_tool untuk mengekspor hasil analisis ke file (ipynb/csv/xlsx/json/md/html/txt/py)\n"
            "- Gunakan data_profile_tool untuk membuat laporan profiling HTML otomatis dari dataset\n"
            "- Untuk file .sql/.db: gunakan python_repl_tool dengan sqlite3 atau sqlalchemy\n"
            "- Jika error, perbaiki otomatis\n"
            "- Berikan ringkasan singkat hasil setelah eksekusi\n"
            "\nKRITIS — WAJIB DIIKUTI:\n"
            "- JANGAN PERNAH mengarang atau memfabrikasi output analisis. Semua angka, metrik, dan hasil HARUS berasal dari eksekusi tool nyata.\n"
            "- SELALU panggil python_repl_tool atau render_chart_tool untuk mengeksekusi kode. JANGAN tulis kode lalu langsung tulis hasil seolah sudah dieksekusi.\n"
            "- SELALU gunakan path file lengkap '/app/data/nama_file.csv' — JANGAN gunakan nama file relatif seperti 'trip.csv' atau 'data.csv'.\n"
            "- Setiap render_chart_tool HARUS memuat ulang data dari file (variabel tidak persisten antar tool call).\n"
            + CHART_RULE
            + CONTEXT_RULE
            + OUTPUT_DISCIPLINE_RULE
            + history_text
        )

        phases = defaultdict(list)
        for i, task_item in enumerate(plan):
            phase = task_item.get("phase", i)
            phases[phase].append((i, task_item))

        collected_outputs: list[str] = []
        MAX_CONTEXT_CHARS = 6000

        for phase_num in sorted(phases.keys()):
            phase_tasks = phases[phase_num]
            generators = []

            prior_context = ""
            if collected_outputs:
                ctx_block = "\n---\n".join(collected_outputs[-5:])
                if len(ctx_block) > MAX_CONTEXT_CHARS:
                    ctx_block = ctx_block[-MAX_CONTEXT_CHARS:]
                prior_context = (
                    "\n=== HASIL TASK SEBELUMNYA ===\n"
                    "Gunakan konteks ini untuk melanjutkan analisis tanpa mengulang pekerjaan.\n"
                    + ctx_block
                    + "\n=== AKHIR KONTEKS ===\n"
                )

            for i, task_item in phase_tasks:
                task = task_item["task"]
                prompt = executor_base + prior_context + f"\nTugas saat ini [{i+1}/{len(plan)}]: {task}\n"
                generators.append(
                    execute_task(data_folder, task, i, len(plan), prompt, MODEL_EXECUTOR, "execution")
                )

            for event in run_phase_parallel(generators):
                if event["type"] == "_task_output":
                    collected_outputs.append(
                        f"[Tugas {event['index']+1}: {event['task']}]\n{event['content']}"
                    )
                    continue
                yield event

        # -- Step 3 & 4: Critic + optional single-pass refinement --
        critic_judgment = "ok"
        critic_additional_tasks: list[str] = []
        for event in run_critic_agent(
            question, "\n".join(collected_outputs), data_folder, MODEL_CRITIC
        ):
            if event.get("type") == "_critic_result":
                critic_judgment = event.get("judgment", "ok")
                critic_additional_tasks = event.get("additional_tasks", []) or []
                continue
            yield event

        # Opsi A: refinement satu putaran saja (one-shot), tanpa re-evaluasi ulang.
        if critic_judgment == "refine" and critic_additional_tasks:
            yield {"type": "agent_label", "content": "Execution"}
            refine_context = ""
            if collected_outputs:
                ctx_block = "\n---\n".join(collected_outputs[-3:])
                if len(ctx_block) > MAX_CONTEXT_CHARS:
                    ctx_block = ctx_block[-MAX_CONTEXT_CHARS:]
                refine_context = (
                    "\n=== HASIL TASK SEBELUMNYA ===\n"
                    + ctx_block
                    + "\n=== AKHIR KONTEKS ===\n"
                )

            for i, task in enumerate(critic_additional_tasks):
                refine_prompt = (
                    executor_base
                    + refine_context
                    + f"\nTugas perbaikan [{i+1}/{len(critic_additional_tasks)}]: {task}\n"
                    "Konteks: Perbaikan berdasarkan rekomendasi Critic Agent. "
                    "Fokus pada perbaikan spesifik yang diminta.\n"
                )
                for event in execute_task(
                    data_folder,
                    task,
                    i,
                    len(critic_additional_tasks),
                    refine_prompt,
                    MODEL_EXECUTOR,
                    "execution",
                ):
                    if event["type"] == "_task_output":
                        collected_outputs.append(
                            f"[Refine {event['index']+1}: {event['task']}]\n{event['content']}"
                        )
                        continue
                    yield event

        yield {"type": "done"}

    finally:
        cleanup_context_files(data_folder)
