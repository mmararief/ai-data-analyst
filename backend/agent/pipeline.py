"""Main 3-agent pipeline: Planner -> Executor -> Critic."""

import json
import re
from collections import defaultdict
from pathlib import Path

from backend.agent.automl_pipeline import run_analysis_first_automl
from backend.agent.classifier import (
    classify_request_type,
    is_simple_data_task,
    looks_like_model_build_request,
)
from backend.agent.critic import run_critic_agent
from backend.agent.executor import execute_task, run_phase_parallel
from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import (
    CHART_RULE,
    CONTEXT_RULE,
    OUTPUT_DISCIPLINE_RULE,
    STREAMLIT_RULE,
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
):
    """
    3-agent pipeline: Planner -> Executor -> Critic.

    Each role uses its own model (configurable via env vars):
      MODEL_PLANNER  -- reasoning/planning  (default: MODEL_CHAT)
      MODEL_EXECUTOR -- code execution       (default: MODEL_CHAT)
      MODEL_CRITIC   -- evaluation/feedback  (default: MODEL_CHAT)

    Events emitted:
      {"type": "agent_label", "content": "Planner|Execution|Critic"}
      {"type": "plan",        "content": [{"task": "...", "agent": "execution"}, ...]}
      {"type": "task_start",  "content": "...", "index": i, "total": n, "agent": "..."}
      {"type": "text"|"code"|"output"|"progress"|"image"|"streamlit"|"error", "content": "..."}
      {"type": "critic",      "judgment": "ok"|"refine", "feedback": "...", "additional_tasks": [...]}
      {"type": "done"}
    """
    from backend.core.config import MODEL_CHAT, MODEL_PLANNER, MODEL_EXECUTOR, MODEL_CRITIC

    history = history or []

    try:
        request_type = classify_request_type(question, model=MODEL_CHAT)
        if request_type == "smalltalk":
            yield from run_direct_llm(question, history=history, model=MODEL_CHAT)
            return

        file_list = list_data_contents(data_folder)
        schema_context = load_schema_context(data_folder)

        # Pastikan simple data task tidak terseret ke AutoML hanya karena ada kata kunci model build
        if is_simple_data_task(question):
            yield from run_simple_data_task(
                data_folder, question, MODEL_EXECUTOR, file_list, schema_context, history=history,
            )
            return

        if looks_like_model_build_request(question):
            yield from run_analysis_first_automl(data_folder, question, MODEL_PLANNER)
            return

        history_text = build_history_context(history)

        # -- Step 1: Planner Agent (MODEL_PLANNER) --
        yield {"type": "agent_label", "content": "Planner"}

        planner_system = PLANNER_SYSTEM_PROMPT.format(
            file_list=file_list,
            schema_context=schema_context,
        )

        plan = [{"task": question, "agent": "execution", "phase": 0}]
        try:
            llm_planner = build_llm(model=MODEL_PLANNER, temperature=0, max_output_tokens=1024)
            planner_input = question + history_text
            response = invoke_with_retry(llm_planner, [("system", planner_system), ("human", planner_input)])
            raw = response.content if isinstance(response.content, str) else extract_text(response.content)
            json_match = re.search(r"\[.*?\]", raw, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                if isinstance(parsed, list) and parsed:
                    plan = [
                        {
                            "task": str(item.get("task", item)),
                            "agent": "execution",
                            "phase": item.get("phase", idx),
                        }
                        if isinstance(item, dict)
                        else {"task": str(item), "agent": "execution", "phase": idx}
                        for idx, item in enumerate(parsed)
                    ]
        except Exception:
            pass

        yield {"type": "plan", "content": plan}

        # -- Step 2: Execution Agent (MODEL_EXECUTOR) --
        yield {"type": "agent_label", "content": "Execution"}

        executor_base = (
            "Kamu adalah Execution Agent. Eksekusi tugas berikut.\n\n"
            f"Dataset di '/app/data/':\n{file_list}\n\n"
            f"{schema_context}\n\n"
            "Aturan:\n"
            "- WAJIB gunakan automl_train_tool untuk training/membuat/melatih model ML. DILARANG membuat pipeline ML manual\n"
            "- automl_train_tool sudah otomatis: cleaning, feature engineering, training 5 model (RF, GBM, XGB, LGBM, Linear), hyperparameter tuning\n"
            "- Untuk UNSUPERVISED / CLUSTERING: gunakan automl_train_tool dengan problem_type='clustering'. Target column isi string kosong ''. Jumlah cluster otomatis ditentukan.\n"
            "- WAJIB gunakan automl_predict_tool untuk prediksi memakai model tersimpan\n"
            "- Gunakan automl_list_models_tool jika perlu melihat model yang tersedia\n"
            "- Gunakan python_repl_tool HANYA untuk analisis/EDA/visualisasi tanpa training model\n"
            "- DILARANG membuat preprocessing manual (LabelEncoder, StandardScaler, train_test_split) untuk training model\n"
            "- Gunakan web_search_tool untuk pertanyaan konsep/teori/best practice/benchmark/referensi terbaru. JANGAN untuk analisis data lokal\n"
            "- Gunakan file_export_tool untuk mengekspor hasil analisis ke file (ipynb/csv/md/html/txt)\n"
            "- Untuk file .sql/.db: gunakan python_repl_tool dengan sqlite3 atau sqlalchemy\n"
            "- Jika error, perbaiki otomatis\n"
            "- Berikan ringkasan singkat hasil setelah eksekusi\n"
            + CHART_RULE
            + STREAMLIT_RULE
            + CONTEXT_RULE
            + OUTPUT_DISCIPLINE_RULE
            + history_text
        )

        phases = defaultdict(list)
        for i, task_item in enumerate(plan):
            phase = task_item.get("phase", i)
            phases[phase].append((i, task_item))

        collected_outputs: list[str] = []
        MAX_CONTEXT_CHARS = 4000

        for phase_num in sorted(phases.keys()):
            phase_tasks = phases[phase_num]
            generators = []

            prior_context = ""
            if collected_outputs:
                ctx_block = "\n---\n".join(collected_outputs[-3:])
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
