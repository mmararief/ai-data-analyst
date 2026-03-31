"""Handlers for simple data tasks and direct LLM replies (smalltalk)."""

from pathlib import Path

from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import (
    CHART_RULE,
    CONTEXT_RULE,
    OUTPUT_DISCIPLINE_RULE,
    DIRECT_LLM_PROMPT,
)
from backend.agent.utils import (
    answer_simple_task_from_schema,
    build_history_context,
    extract_text,
    trim_content,
)


def run_direct_llm(question: str, history: list | None = None, model: str = None):
    """Single lightweight LLM reply without planner/executor/insight orchestration."""
    from backend.core.config import MODEL_CHAT, MAX_HISTORY_MESSAGES, MAX_HISTORY_CONTENT_LEN

    history = history or []
    model_name = model or MODEL_CHAT

    trimmed = history[-MAX_HISTORY_MESSAGES:]
    history_text = ""
    if trimmed:
        # Reuse shared history formatting helper for consistency
        history_text = build_history_context(trimmed)
        # Trim ulang agar tidak terlalu panjang untuk smalltalk
        history_text = trim_content(history_text, MAX_HISTORY_CONTENT_LEN * MAX_HISTORY_MESSAGES)

    system = DIRECT_LLM_PROMPT
    human = f"Pesan pengguna: {question}\n\n{history_text}" if history_text else f"Pesan pengguna: {question}"

    try:
        llm = build_llm(model=model_name, temperature=0.4, max_output_tokens=512)
        response = invoke_with_retry(llm, [("system", system), ("human", human)])
        text = response.content if isinstance(response.content, str) else extract_text(response.content)
        if text:
            yield {"type": "text", "content": text}
    except Exception as exc:
        yield {"type": "error", "content": str(exc)}
    yield {"type": "done"}


def run_simple_data_task(
    data_folder: Path,
    question: str,
    model: str,
    file_list: str,
    schema_context: str,
    history: list | None = None,
):
    """Run a simple data task with only the execution agent, without planner/insight."""
    from backend.agent.executor import execute_task

    yield {"type": "agent_label", "content": "Execution"}

    schema_answer = answer_simple_task_from_schema(data_folder, question)
    if schema_answer:
        yield {"type": "text", "content": schema_answer}
        yield {"type": "done"}
        return

    history_text = build_history_context(history)
    simple_prompt = (
        "Kamu adalah Execution Agent untuk tugas data sederhana.\n\n"
        f"Dataset di '/app/data/':\n{file_list}\n"
        f"{schema_context}\n\n"
        "Aturan:\n"
        "- Kerjakan langsung tanpa membuat plan\n"
        "- Fokus pada permintaan sederhana seperti shape, jumlah baris, jumlah kolom, head, missing values, atau info dataset\n"
        "- Jika schema memory sudah cukup, gunakan itu. Baca dataset hanya jika memang perlu\n"
        "- Berikan jawaban singkat dan langsung\n"
        + CHART_RULE
        + CONTEXT_RULE
        + OUTPUT_DISCIPLINE_RULE
        + history_text
    )

    for event in execute_task(data_folder, question, 0, 1, simple_prompt, model, "execution"):
        if event["type"] == "_task_output":
            continue
        if event["type"] == "task_start":
            # Untuk simple task, task_start kurang berguna di UI; bisa di-skip
            continue
        yield event

    yield {"type": "done"}
