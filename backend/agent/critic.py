"""Critic agent: evaluates execution output and emits judgment events."""

from pathlib import Path

from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import CRITIC_PROMPT
from backend.agent.utils import extract_text, list_data_contents, parse_json_from_llm



def run_critic_agent(question: str, execution_output: str, data_folder: Path, model_name: str):
    """Critic Agent: reviews Execution Agent output and yields evaluation events.

    Yields:
        {type: agent_label, content: "Critic"}
        {type: critic, judgment, feedback, additional_tasks}
        {type: _critic_result, ...}  <- internal sentinel, filtered by caller
    """
    yield {"type": "agent_label", "content": "Critic"}

    file_list = list_data_contents(data_folder)

    # Ambil head + tail agar Critic tidak melewatkan error/grafik di akhir output
    HEAD_CHARS = 3000
    TAIL_CHARS = 2000
    if len(execution_output) <= HEAD_CHARS + TAIL_CHARS:
        truncated_output = execution_output
    else:
        truncated_output = (
            execution_output[:HEAD_CHARS]
            + "\n... [tengah output terpotong] ...\n"
            + execution_output[-TAIL_CHARS:]
        )

    critic_input = (
        f"Pertanyaan pengguna: {question}\n\n"
        f"Dataset tersedia:\n{file_list}\n\n"
        f"Output eksekusi:\n{truncated_output}"
    )

    judgment = "ok"
    feedback = ""
    additional_tasks: list[str] = []

    try:
        llm = build_llm(model=model_name, temperature=0, max_output_tokens=768)
        response = invoke_with_retry(llm, [
            ("system", CRITIC_PROMPT),
            ("human", critic_input),
        ])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        import logging; logging.getLogger(__name__).debug("CRITIC RAW RESPONSE: %s", raw[:500])
        parsed = parse_json_from_llm(raw)
        if parsed:
            # Critic prompt seharusnya mengembalikan JSON object. Jika list diterima,
            # ambil elemen pertama yang berupa dict.
            if isinstance(parsed, list) and parsed:
                parsed = next((item for item in parsed if isinstance(item, dict)), parsed[0])
            if isinstance(parsed, dict):
                j = str(parsed.get("judgment", "ok")).lower().strip()
                if j in ("ok", "refine"):
                    judgment = j
                feedback = str(parsed.get("feedback", feedback))
                raw_tasks = parsed.get("additional_tasks", [])
                if isinstance(raw_tasks, list):
                    additional_tasks = [str(t) for t in raw_tasks[:2] if t]
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Critic LLM failed", exc_info=True)
        # Informasikan kegagalan LLM ke UI agar user tahu kenapa evaluasi default digunakan
        feedback = f"Evaluator (Critic) gagal memanggil model '{model_name}': {str(e)[:100]}. Menggunakan evaluasi default 'OK'."
        judgment = "ok"

    if not feedback:
        feedback = (
            "Analisis sudah memadai dan pertanyaan pengguna telah terjawab."
            if judgment == "ok"
            else "Terdapat kekurangan pada hasil analisis yang perlu diperbaiki."
        )
        additional_tasks = [] if judgment == "ok" else additional_tasks

    yield {
        "type": "critic",
        "judgment": judgment,
        # Jika LLM gagal, feedback dibiarkan kosong agar tidak
        # menimpa atau mengganggu evaluasi lain.
        "feedback": feedback,
        "additional_tasks": additional_tasks,
    }
    yield {"type": "_critic_result", "judgment": judgment, "additional_tasks": additional_tasks}
