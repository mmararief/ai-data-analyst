"""Request classification and routing logic."""

import logging
import re

from backend.agent.constants import MODEL_BUILD_KEYWORDS
from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import CLASSIFIER_PROMPT
from backend.agent.utils import extract_text


SIMPLE_TASK_KEYWORDS = [
    "jumlah baris",
    "berapa baris",
    "berapa kolom",
    "kolom apa saja",
    "5 baris pertama",
    "head",
    "show head",
    "tampilkan head",
    "missing value",
    "shape",
    "dataset shape",
    "info dataset",
    "dataset info",
]

_EXPLAIN_PATTERNS = re.compile(
    r"\b(apa\s+itu|jelaskan|definisi|pengertian|artinya|apa\s+yang\s+dimaksud|"
    r"perbedaan\s+antara|kapan\s+digunakan|contoh\s+dari|teori|konsep)\b",
    re.IGNORECASE,
)

# Knowledge questions about these topics should route to data_task (for web search)
_DATA_KNOWLEDGE_KEYWORDS = {
    "benchmark", "akurasi", "accuracy", "f1", "rmse", "r2", "auc",
    "imbalanced", "overfit", "underfit", "regularisasi", "hyperparameter",
    "cross-validation", "gradient", "time series", "feature engineering",
    "lightgbm", "xgboost", "random forest", "neural network", "deep learning",
    "machine learning", "clustering", "regresi", "klasifikasi", "preprocessing",
    "normalisasi", "standardisasi", "encoding", "embedding", "dataset",
    "scikit", "sklearn", "pandas", "tensorflow", "pytorch", "keras",
}

_USE_EXISTING_MODEL_PATTERNS = [
    "gunakan model", "pakai model", "prediksi dengan model",
    "prediksi menggunakan model", "load model", "muat model",
]


def heuristic_route(question: str) -> str:
    """Fallback route when classifier LLM is unavailable."""
    q = (question or "").strip().lower()
    if not q:
        return "smalltalk"

    greetings = {
        "halo", "hai", "hi", "hello", "pagi", "siang", "sore", "malam",
        "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
    }
    casual = {
        "makasih", "terima kasih", "thanks", "thx", "ok", "oke", "sip",
        "siap", "mantap", "bagus", "baik", "halo bang", "halo kak",
    }
    analytic_keywords = {
        "analisis", "dataset", "data", "csv", "excel", "prediksi", "model",
        "regresi", "klasifikasi", "clustering", "visualisasi", "grafik", "chart",
        "dashboard", "streamlit", "eda", "missing value", "outlier", "training",
        "akurasi", "insight", "ringkasan", "kolom", "fitur", "preprocessing",
    }

    if q in greetings:
        return "smalltalk"
    if q in casual:
        return "smalltalk"
    if _EXPLAIN_PATTERNS.search(q):
        # Jika pertanyaan penjelasan mengandung keyword data/ML, route ke data_task
        # agar bisa dijawab dengan web_search_tool
        if any(keyword in q for keyword in _DATA_KNOWLEDGE_KEYWORDS):
            return "data_task"
        return "smalltalk"
    if len(q.split()) <= 3 and not any(keyword in q for keyword in analytic_keywords):
        return "smalltalk"
    return "data_task"


def classify_request_type(question: str, model: str | None = None) -> str:
    """Route user input with a lightweight classifier LLM."""
    from backend.core.config import MODEL_CHAT

    model_name = model or MODEL_CHAT
    user_input = (question or "").strip()
    if not user_input:
        return "smalltalk"

    try:
        llm = build_llm(model=model_name, temperature=0, max_output_tokens=16)
        response = invoke_with_retry(llm, [
            ("system", CLASSIFIER_PROMPT),
            ("human", user_input),
        ])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        label = (raw or "").strip().lower()
        if "smalltalk" in label:
            return "smalltalk"
        if "data_task" in label:
            return "data_task"
    except Exception:
        logging.getLogger(__name__).debug(
            "Classifier LLM failed, falling back to heuristic", exc_info=True
        )

    return heuristic_route(user_input)


def is_simple_data_task(question: str) -> bool:
    q = (question or "").lower()
    return any(keyword in q for keyword in SIMPLE_TASK_KEYWORDS)


def looks_like_model_build_request(question: str) -> bool:
    q = (question or "").strip().lower()
    if not q:
        return False
    if any(keyword in q for keyword in _USE_EXISTING_MODEL_PATTERNS):
        return False
    if _EXPLAIN_PATTERNS.search(q):
        return False
    return any(keyword in q for keyword in MODEL_BUILD_KEYWORDS)
