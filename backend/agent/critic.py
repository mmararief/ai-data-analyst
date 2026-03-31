"""Critic agent: evaluates execution output and emits judgment events."""

from pathlib import Path

from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import CRITIC_PROMPT
from backend.agent.utils import extract_text, list_data_contents, parse_json_from_llm
from backend.core.automl import CLUSTERING


def automl_critic_event(problem_type: str, best_metrics: dict, model_class: str) -> dict:
    """Generate a metric-based Critic evaluation for AutoML results (no extra LLM call)."""
    if not best_metrics or not model_class:
        return {
            "type": "critic",
            "judgment": "ok",
            "feedback": "Model berhasil dilatih oleh pipeline AutoML.",
            "additional_tasks": [],
        }

    pt = (problem_type or "").lower()

    if pt == CLUSTERING:
        silhouette = best_metrics.get("silhouette")
        if silhouette is not None:
            try:
                sv = float(silhouette)
            except (TypeError, ValueError):
                sv = None
            if sv is not None and sv < 0.25:
                return {
                    "type": "critic",
                    "judgment": "refine",
                    "feedback": (
                        f"Silhouette score clustering cukup rendah ({sv:.2f}). "
                        "Cluster mungkin kurang terpisah \u2014 pertimbangkan seleksi fitur lebih ketat."
                    ),
                    "additional_tasks": [
                        "Visualisasikan distribusi fitur utama antar cluster dengan boxplot untuk deteksi overlap",
                        "Analisis korelasi fitur dan hapus fitur yang sangat berkorelasi satu sama lain",
                    ],
                }
        sil_str = f"{silhouette:.2f}" if silhouette is not None else "?"
        return {
            "type": "critic",
            "judgment": "ok",
            "feedback": (
                f"Clustering dengan {model_class} berhasil (silhouette={sil_str}). "
                "Segmentasi sudah dapat digunakan untuk analisis lanjutan."
            ),
            "additional_tasks": [],
        }

    if any(pt.startswith(prefix) for prefix in ("classification", "binary", "multiclass")):
        accuracy = best_metrics.get("accuracy")
        f1 = best_metrics.get("f1_weighted") or best_metrics.get("f1")
        main_val = accuracy if accuracy is not None else f1
        if main_val is not None:
            try:
                v = float(main_val)
            except (TypeError, ValueError):
                v = None
            if v is not None and v < 0.60:
                return {
                    "type": "critic",
                    "judgment": "refine",
                    "feedback": (
                        f"Performa model {model_class} masih dapat ditingkatkan "
                        f"(accuracy={v:.2f}). Pertimbangkan memeriksa distribusi kelas dan kualitas fitur."
                    ),
                    "additional_tasks": [
                        "Analisis distribusi kelas target dan terapkan teknik resampling jika ada class imbalance",
                        "Periksa feature importance dan hapus fitur noise yang membebani model",
                    ],
                }

    if pt == "regression":
        r2 = best_metrics.get("r2") or best_metrics.get("R\u00b2") or best_metrics.get("r\u00b2")
        if r2 is not None:
            try:
                r2v = float(r2)
            except (TypeError, ValueError):
                r2v = None
            if r2v is not None and r2v < 0.30:
                return {
                    "type": "critic",
                    "judgment": "refine",
                    "feedback": (
                        f"Model {model_class} memiliki R\u00b2={r2v:.2f} yang rendah. "
                        "Kemungkinan ada outlier ekstrem atau hubungan non-linear yang perlu ditangani."
                    ),
                    "additional_tasks": [
                        "Visualisasi distribusi target dan fitur numerik utama untuk deteksi outlier ekstrem",
                        "Analisis residual plot untuk memahami pola error model",
                    ],
                }

    return {
        "type": "critic",
        "judgment": "ok",
        "feedback": (
            f"Model {model_class} berhasil dilatih dengan pipeline AutoML yang mencakup "
            "cleaning, feature engineering, dan hyperparameter tuning secara otomatis."
        ),
        "additional_tasks": [],
    }


def run_critic_agent(question: str, execution_output: str, data_folder: Path, model_name: str):
    """Critic Agent: reviews Execution Agent output and yields evaluation events.

    Yields:
        {type: agent_label, content: "Critic"}
        {type: critic, judgment, feedback, additional_tasks}
        {type: _critic_result, ...}  <- internal sentinel, filtered by caller
    """
    yield {"type": "agent_label", "content": "Critic"}

    file_list = list_data_contents(data_folder)
    truncated_output = execution_output[:3000]
    if len(execution_output) > 3000:
        truncated_output += "\n... [output eksekusi terpotong untuk ringkasan]"

    critic_input = (
        f"Pertanyaan pengguna: {question}\n\n"
        f"Dataset tersedia:\n{file_list}\n\n"
        f"Output eksekusi:\n{truncated_output}"
    )

    judgment = "ok"
    feedback = ""
    additional_tasks: list[str] = []

    try:
        llm = build_llm(model=model_name, temperature=0, max_output_tokens=512)
        response = invoke_with_retry(llm, [
            ("system", CRITIC_PROMPT),
            ("human", critic_input),
        ])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
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

    if judgment == "ok" and not feedback:
        feedback = "Analisis sudah memadai berdasarkan output eksekusi."
        additional_tasks = []

    yield {
        "type": "critic",
        "judgment": judgment,
        # Jika LLM gagal, feedback dibiarkan kosong agar tidak
        # menimpa atau mengganggu evaluasi lain (mis. AutoML critic).
        "feedback": feedback,
        "additional_tasks": additional_tasks,
    }
    yield {"type": "_critic_result", "judgment": judgment, "additional_tasks": additional_tasks}
