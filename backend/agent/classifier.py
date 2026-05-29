"""Request classification and routing logic."""

import logging
import re

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

# Knowledge questions about these topics route to data_task
_DATA_KNOWLEDGE_KEYWORDS = {
    "time series", "feature engineering", "preprocessing",
    "normalisasi", "standardisasi", "encoding", "dataset",
    "pandas", "data cleaning", "imputasi", "missing value",
    "outlier", "korelasi", "distribusi", "visualisasi",
}


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
        "analisis", "dataset", "data", "csv", "excel",
        "visualisasi", "grafik", "chart",
        "eda", "missing value", "outlier",
        "insight", "ringkasan", "kolom", "fitur", "preprocessing",
    }

    if q in greetings:
        return "smalltalk"
    if q in casual:
        return "smalltalk"
    if _EXPLAIN_PATTERNS.search(q):
        if any(keyword in q for keyword in _DATA_KNOWLEDGE_KEYWORDS):
            return "data_task"
        return "smalltalk"
    if len(q.split()) <= 3 and not any(keyword in q for keyword in analytic_keywords):
        return "smalltalk"
    return "data_task"


def _build_history_snippet(history: list | None, max_turns: int = 3) -> str:
    """Return the last N turns as a compact string for classifier context."""
    if not history:
        return ""
    recent = history[-max_turns:]
    lines = []
    for role, content in recent:
        speaker = "User" if role == "user" else "AI"
        # Truncate long assistant messages to keep prompt light
        snippet = content[:300].replace("\n", " ") if role != "user" else content[:200]
        lines.append(f"{speaker}: {snippet}")
    return "\nRiwayat terakhir:\n" + "\n".join(lines)


def _has_pending_data_context(history: list | None) -> bool:
    """Return True if recent history shows an ongoing data task conversation.

    Detects patterns like:
    - AI asked the user to confirm a column / target
    - AI offered to do more work ("mau saya tambahkan", "apakah ingin")
    - AI is mid-analysis and asking for user direction
    """
    if not history:
        return False
    # Look at the last AI message
    for role, content in reversed(history):
        if role in ("assistant", "ai"):
            c = content.lower()
            if any(phrase in c for phrase in [
                # Confirmation / column selection
                "mohon konfirmasi", "kolom mana", "pilih kolom", "ingin anda gunakan",
                "sebagai target", "target klasifikasi", "konfirmasi", "dataset mana",
                "file mana", "mana yang ingin", "gunakan kolom",
                # Offering more work
                "mau saya tambahkan", "mau saya buatkan", "mau saya buat",
                "apakah ingin", "apakah anda ingin", "ingin saya tambahkan",
                "ingin saya buatkan", "ingin dilanjutkan", "ingin eksplorasi",
                "ingin visualisasi", "mau ditambahkan", "mau dibuatkan",
                "perlu saya tambahkan", "perlu ditambahkan", "lanjutkan analisis",
                "eksplorasi lebih lanjut", "breakdown lebih", "analisis lebih lanjut",
                "visualisasi lebih", "mau saya lanjutkan", "lanjut ke",
            ]):
                return True
            break  # Only check the most recent AI message
    return False


def classify_request_type(
    question: str,
    model: str | None = None,
    history: list | None = None,
) -> str:
    """Route user input with a lightweight classifier LLM.

    Accepts optional conversation history so that short follow-up messages
    like "iya", "iya tolong buatkan", "lanjutkan" are correctly routed as
    data_task when the previous AI turn asked the user a follow-up question
    about the dataset (anaphora resolution).
    """
    from backend.core.config import MODEL_CHAT

    model_name = model or MODEL_CHAT
    user_input = (question or "").strip()
    if not user_input:
        return "smalltalk"

    # --- Context-aware fast path: if AI was waiting for user confirmation
    #     about a data task, short affirmative/follow-up replies are data_task.
    if _has_pending_data_context(history):
        q_lower = user_input.lower()
        affirmatives = {
            "iya", "ya", "yep", "yes", "ok", "oke", "siap", "lanjut", "mau",
            "lanjutkan", "tolong", "kerjakan", "buatkan", "jalankan", "boleh",
            "bisa", "silakan", "coba", "tambahkan", "tambah", "buat", "coba buat",
            "iya tolong", "iya lanjutkan", "iya kerjakan", "iya buatkan",
            "iya jalankan", "iya mau", "ya mau", "ya dong", "iya dong",
            "tolong kerjakan", "tolong buatkan", "tolong jalankan",
            "tolong tambahkan", "ya tambahkan", "iya tambahkan",
        }
        if q_lower in affirmatives or len(user_input.split()) <= 6:
            # Short reply in a data context → treat as data_task continuation
            return "data_task"

    # --- Fast heuristic path (zero LLM latency) ---
    heuristic = heuristic_route(user_input)

    # If heuristic is confident it's smalltalk, skip LLM entirely
    q_lower = user_input.lower()
    is_obvious_smalltalk = (
        len(user_input.split()) <= 4
        and not any(kw in q_lower for kw in {"data", "dataset", "analisis", "csv", "kolom", "grafik", "chart", "visualisasi"})
    )
    if heuristic == "smalltalk" and is_obvious_smalltalk and not _has_pending_data_context(history):
        return "smalltalk"

    # --- LLM classifier for ambiguous cases (inject recent history for context) ---
    history_snippet = _build_history_snippet(history)
    try:
        llm = build_llm(model=model_name, temperature=0, max_output_tokens=16)
        human_content = user_input + (f"\n\n{history_snippet}" if history_snippet else "")
        response = invoke_with_retry(llm, [
            ("system", CLASSIFIER_PROMPT),
            ("human", human_content),
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

    return heuristic


def is_simple_data_task(question: str) -> bool:
    q = (question or "").lower()
    return any(keyword in q for keyword in SIMPLE_TASK_KEYWORDS)

