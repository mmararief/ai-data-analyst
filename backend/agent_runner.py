import warnings
import json
import re
import base64 as _base64
import queue
import threading
from collections import defaultdict
warnings.filterwarnings("ignore", category=DeprecationWarning)

from pathlib import Path
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sandbox import run_ai_code_securely, stream_ai_code_securely


def _list_data_contents(data_folder: Path) -> str:
    """List files and folders in data_folder for the system prompt."""
    if not data_folder.exists():
        return "- (belum ada file)"
    lines = []
    for item in sorted(data_folder.iterdir()):
        if item.name.startswith('_chart_') or item.name == '.chats.json':
            continue
        if item.is_dir():
            sub_count = sum(1 for _ in item.rglob('*') if _.is_file())
            lines.append(f"- /app/data/{item.name}/  (folder, {sub_count} file)")
        else:
            lines.append(f"- /app/data/{item.name}")
    return "\n".join(lines) or "- (belum ada file)"


def build_system_prompt(data_folder: Path) -> str:
    file_list = _list_data_contents(data_folder)
    return f"""
Kamu adalah Analisai, AI Data Analyst & ML Engineer ahli yang dibuat oleh Muhammad Ammar Arief. Bantu pengguna menganalisis data dan membangun model ML.

Dataset di '/app/data/':
{file_list}

=== ATURAN INTERAKSI ===
- Jika pengguna bertanya siapa kamu atau siapa pembuatmu, jawab bahwa kamu adalah Analisai dan dibuat oleh Muhammad Ammar Arief
- WAJIB tulis penjelasan teks SEBELUM menjalankan kode (jelaskan rencana singkat)
- Sapa pengguna HANYA SEKALI di awal sesi. Jangan ulangi salam/sapaan
- DILARANG mengakhiri respons dengan kalimat seperti "Ada lagi yang ingin Anda ketahui?", "Silakan tanyakan", "Semoga membantu", atau kalimat basa-basi penutup serupa
- DILARANG mengulang data, tabel, atau output yang sudah ditampilkan sebelumnya dalam percakapan yang sama
- DILARANG mengulangi konten yang sudah dijelaskan di bagian sebelumnya dalam respons yang sama
- Langsung ke intinya. Setiap respons harus mengandung informasi BARU
- Gunakan bahasa Indonesia

=== ALUR KERJA (ikuti berurutan saat diminta analisis/ML) ===
1. EDA: shape, tipe kolom, 5 baris pertama, missing values, duplikat, statistik deskriptif, distribusi, korelasi → ringkasan temuan
2. PREPROCESSING: tangani missing values, encode kategorikal, scaling, split train/test → ringkasan perubahan
3. TRAINING: pilih algoritma sesuai masalah (klasifikasi/regresi/clustering), latih model → info model & parameter
4. EVALUASI: metrik sesuai tipe (accuracy/F1/RMSE/R²/silhouette), visualisasi → interpretasi performa & saran

=== ATURAN GRAFIK ===
Jangan pakai plt.show(). Gunakan:
import matplotlib.pyplot as plt
import uuid as _uuid
_chart_path = f"/app/data/_chart_{{_uuid.uuid4().hex}}.png"
plt.savefig(_chart_path, format='png', bbox_inches='tight', dpi=100)
plt.close()
print(f"[[CHART_FILE]]{{_chart_path}}[[/CHART_FILE]]")

=== ATURAN STREAMLIT ===
Jika diminta dashboard/UI Streamlit:
1. Tulis kode Streamlit lengkap, simpan ke .py di /app/data/
2. Print: "[[STREAMLIT_APP]]nama_file.py[[/STREAMLIT_APP]]"
3. Dalam kode Streamlit, gunakan path '/app/data/' untuk akses file
4. Jangan jalankan streamlit — sistem otomatis menjalankannya
5. PENTING: Di kode Streamlit, SELALU baca dari file data ASLI (CSV/Excel), JANGAN dari file .pkl intermediate
   Contoh BENAR: pd.read_csv('/app/data/nama_file.csv')
   Contoh SALAH: pd.read_pickle('/app/data/_ctx_clean.pkl')

=== SHARED CONTEXT ===
Untuk efisiensi, simpan hasil intermediate. WAJIB gunakan pola aman berikut:
import os, pandas as pd
_ctx = '/app/data/_ctx_raw.pkl'
if os.path.exists(_ctx):
    df = pd.read_pickle(_ctx)
else:
    df = pd.read_csv('/app/data/data.csv')
    df.to_pickle(_ctx)
- JANGAN panggil pd.read_pickle tanpa os.path.exists() terlebih dahulu
- Jika pkl belum ada, fallback ke file asli lalu simpan pkl

=== ATURAN UMUM ===
- Eksekusi kode bertahap per tahap
- Library tersedia: pandas, scikit-learn, xgboost, lightgbm, seaborn, matplotlib, statsmodels, scipy
- Jika error, analisis dan perbaiki otomatis
"""



def create_agent(data_folder: Path, system_prompt: str = None, model: str = None,
                  progress_queue: queue.Queue = None):
    from backend.core.config import GOOGLE_API_KEY, MODEL_CHAT
    import os
    os.environ.setdefault("GOOGLE_API_KEY", GOOGLE_API_KEY)

    folder_str = str(data_folder)
    prompt = system_prompt if system_prompt is not None else build_system_prompt(data_folder)
    model = model or MODEL_CHAT

    @tool
    def python_repl_tool(code: str) -> str:
        """Eksekusi kode Python/Pandas di sandbox Docker yang terisolasi."""
        if progress_queue is not None:
            accumulated = []
            for line in stream_ai_code_securely(code, data_folder_path=folder_str):
                accumulated.append(line)
                if line.rstrip():
                    progress_queue.put(line.rstrip())
            return "".join(accumulated)
        return run_ai_code_securely(code, data_folder_path=folder_str)

    llm = ChatGoogleGenerativeAI(model=model, temperature=0, max_output_tokens=8192)
    return create_react_agent(llm, tools=[python_repl_tool], prompt=prompt)


def extract_text(content) -> str:
    if isinstance(content, list):
        return " ".join(
            b.get("text", "") for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return content or ""


IMAGE_RE = re.compile(r"\[\[IMAGE_START\]\](.*?)\[\[IMAGE_END\]\]", re.DOTALL)
CHART_RE = re.compile(r"\[\[CHART_FILE\]\](.*?)\[\[/CHART_FILE\]\]", re.DOTALL)
STREAMLIT_RE = re.compile(r"\[\[STREAMLIT_APP\]\](.*?)\[\[/STREAMLIT_APP\]\]", re.DOTALL)


def _trim_content(text: str, max_len: int) -> str:
    """Potong konten history yang terlalu panjang supaya hemat token."""
    if len(text) <= max_len:
        return text
    half = max_len // 2
    return text[:half] + "\n... [dipotong] ...\n" + text[-half:]


CLASSIFIER_PROMPT = """
Tentukan apakah pertanyaan berikut adalah:

1. smalltalk -> sapaan atau percakapan umum
2. data_task -> permintaan analisis data atau machine learning

Jawab hanya: smalltalk atau data_task
"""


SIMPLE_TASK_KEYWORDS = [
    "jumlah baris",
    "berapa baris",
    "berapa kolom",
    "kolom apa saja",
    "5 baris pertama",
    "head",
    "missing value",
    "shape",
    "info dataset",
]


def _heuristic_route(question: str) -> str:
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
    if len(q.split()) <= 3 and not any(keyword in q for keyword in analytic_keywords):
        return "smalltalk"
    return "data_task"


def _classify_request_type(question: str, model: str | None = None) -> str:
    """Route user input with a lightweight classifier LLM."""
    from backend.core.config import GOOGLE_API_KEY, MODEL_CHAT
    import os

    os.environ.setdefault("GOOGLE_API_KEY", GOOGLE_API_KEY)
    model_name = model or MODEL_CHAT
    user_input = (question or "").strip()
    if not user_input:
        return "smalltalk"

    try:
        llm = ChatGoogleGenerativeAI(model=model_name, temperature=0, max_output_tokens=16)
        response = llm.invoke([
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
        pass

    return _heuristic_route(user_input)


def _is_simple_data_task(question: str) -> bool:
    q = (question or "").lower()
    return any(keyword in q for keyword in SIMPLE_TASK_KEYWORDS)


def _load_schema_payload(data_folder: Path) -> dict | None:
    schema_path = data_folder / "_schema.json"
    if not schema_path.exists():
        return None
    try:
        payload = json.loads(schema_path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("datasets"), list):
            return payload
    except Exception:
        return None
    return None


def _load_schema_context(data_folder: Path) -> str:
    payload = _load_schema_payload(data_folder)
    if not payload:
        return ""

    datasets = payload.get("datasets", [])
    if not datasets:
        return ""

    lines = ["\n=== DATASET SCHEMA MEMORY ==="]
    lines.append("Gunakan schema ini sebagai konteks awal agar tidak selalu perlu membaca dataset dari nol.")
    for item in datasets:
        file_name = item.get("file", "unknown")
        rows = item.get("rows", "?")
        columns = item.get("columns", [])
        types = item.get("types", {})
        lines.append(f"- File: /app/data/{file_name}")
        lines.append(f"  rows={rows}, columns={len(columns)}")
        if columns:
            lines.append("  nama_kolom=" + ", ".join(map(str, columns)))
        if types:
            type_summary = ", ".join(f"{col}:{dtype}" for col, dtype in list(types.items())[:20])
            lines.append(f"  tipe={type_summary}")
    lines.append("Tetap baca file bila perlu validasi nilai aktual, tetapi hindari preview berulang yang tidak perlu.")
    return "\n".join(lines)


def _answer_simple_task_from_schema(data_folder: Path, question: str) -> str | None:
    payload = _load_schema_payload(data_folder)
    if not payload:
        return None

    datasets = payload.get("datasets", [])
    if not datasets:
        return None

    item = datasets[0]
    q = (question or "").lower()
    file_name = item.get("file", "dataset")
    rows = item.get("rows")
    columns = item.get("columns", []) or []
    types = item.get("types", {}) or {}

    if any(keyword in q for keyword in ["jumlah baris", "berapa baris"]):
        return f"Jumlah baris pada {file_name} adalah {rows:,}.".replace(",", ".") if rows is not None else None
    if any(keyword in q for keyword in ["berapa kolom", "jumlah kolom"]):
        return f"Jumlah kolom pada {file_name} adalah {len(columns)}."
    if any(keyword in q for keyword in ["kolom apa saja", "nama kolom"]):
        if columns:
            return f"Kolom pada {file_name}: {', '.join(map(str, columns))}."
        return None
    if "shape" in q:
        if rows is not None:
            return f"Shape {file_name} adalah ({rows}, {len(columns)})."
        return None
    if "info dataset" in q:
        type_summary = ", ".join(f"{col}: {dtype}" for col, dtype in types.items())
        return (
            f"Info dataset {file_name}: jumlah baris {rows:,}, jumlah kolom {len(columns)}. ".replace(",", ".")
            + (f"Tipe data kolom: {type_summary}." if type_summary else "")
        )
    return None


def _run_direct_llm(question: str, history: list | None = None, model: str = None):
    """Single lightweight LLM reply without planner/executor/insight orchestration."""
    from backend.core.config import GOOGLE_API_KEY, MODEL_CHAT, MAX_HISTORY_MESSAGES, MAX_HISTORY_CONTENT_LEN
    import os

    os.environ.setdefault("GOOGLE_API_KEY", GOOGLE_API_KEY)
    history = history or []
    model_name = model or MODEL_CHAT

    trimmed = history[-MAX_HISTORY_MESSAGES:]
    history_text = ""
    if trimmed:
        lines = []
        for role, content in trimmed:
            speaker = "User" if role == "user" else "AI"
            lines.append(f"{speaker}: {_trim_content(content, MAX_HISTORY_CONTENT_LEN)}")
        history_text = "\n\nRiwayat percakapan:\n" + "\n".join(lines)

    system = (
        "Kamu adalah Analisai, AI Data Analyst yang ramah dan singkat, dibuat oleh Muhammad Ammar Arief. "
        "Untuk small talk atau pertanyaan percakapan sederhana, jawab langsung tanpa membuat plan, "
        "tanpa menyebut agent, dan tanpa langkah analisis. "
        "Jika pengguna bertanya siapa kamu atau siapa pembuatmu, jawab bahwa kamu adalah Analisai dan dibuat oleh Muhammad Ammar Arief. "
        "Jika pengguna belum meminta analisis data, arahkan secara singkat bahwa kamu siap membantu analisis data. "
        "Gunakan bahasa Indonesia dan jangan bertele-tele."
    )
    human = f"Pesan pengguna: {question}{history_text}"

    llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.4, max_output_tokens=512)
    response = llm.invoke([("system", system), ("human", human)])
    text = response.content if isinstance(response.content, str) else extract_text(response.content)
    if text:
        yield {"type": "text", "content": text}
    yield {"type": "done"}


def _run_simple_data_task(data_folder: Path, question: str, model: str, file_list: str, schema_context: str):
    """Run a simple data task with only the execution agent, without planner/insight."""
    yield {"type": "agent_label", "content": "Execution"}

    schema_answer = _answer_simple_task_from_schema(data_folder, question)
    if schema_answer:
        yield {"type": "text", "content": schema_answer}
        yield {"type": "done"}
        return

    chart_rule = (
        "\n=== ATURAN GRAFIK ===\n"
        "Jangan pakai plt.show(). Gunakan:\n"
        "import matplotlib.pyplot as plt\n"
        "import uuid as _uuid\n"
        "_chart_path = f\"/app/data/_chart_{_uuid.uuid4().hex}.png\"\n"
        "plt.savefig(_chart_path, format='png', bbox_inches='tight', dpi=100)\n"
        "plt.close()\n"
        "print(f\"[[CHART_FILE]]{_chart_path}[[/CHART_FILE]]\")\n"
    )
    simple_prompt = (
        "Kamu adalah Execution Agent untuk tugas data sederhana.\n\n"
        f"Dataset di '/app/data/':\n{file_list}\n"
        f"{schema_context}\n\n"
        "Aturan:\n"
        "- Kerjakan langsung tanpa membuat plan\n"
        "- Fokus pada permintaan sederhana seperti shape, jumlah baris, jumlah kolom, head, missing values, atau info dataset\n"
        "- Jika schema memory sudah cukup, gunakan itu. Baca dataset hanya jika memang perlu\n"
        "- Berikan jawaban singkat dan langsung\n"
        "- Gunakan bahasa Indonesia\n"
        + chart_rule
        + CONTEXT_RULE
    )

    collected_output = []
    for event in _execute_task(data_folder, question, 0, 1, simple_prompt, model, "execution"):
        if event["type"] == "_task_output":
            collected_output.append(event["content"])
            continue
        yield event

    _cleanup_context_files(data_folder)
    yield {"type": "done"}


CONTEXT_RULE = (
    "\n=== SHARED CONTEXT ===\n"
    "Untuk efisiensi, simpan hasil intermediate agar task berikutnya tidak perlu load ulang data.\n"
    "WAJIB gunakan pola berikut — JANGAN langsung pd.read_pickle tanpa cek os.path.exists:\n"
    "import os, pandas as pd\n"
    "_ctx = '/app/data/_ctx_raw.pkl'\n"
    "if os.path.exists(_ctx):\n"
    "    df = pd.read_pickle(_ctx)\n"
    "else:\n"
    "    df = pd.read_csv('/app/data/data.csv')\n"
    "    df.to_pickle(_ctx)\n"
    "- Ganti nama sesuai konteks: _ctx_raw.pkl, _ctx_clean.pkl, _ctx_train.pkl\n"
    "- Jika file pkl tidak ada, SELALU fallback ke membaca file asli (CSV/Excel/dll)\n"
)


def _execute_task(data_folder, task, task_index, total_tasks, agent_prompt,
                  model_name, agent_type="execution"):
    """Generator that yields SSE events for executing a single task."""
    yield {"type": "task_start", "content": task, "index": task_index,
           "total": total_tasks, "agent": agent_type}

    task_progress_q: queue.Queue = queue.Queue()
    task_agent_q: queue.Queue = queue.Queue()
    exec_agent = create_agent(data_folder, agent_prompt, model=model_name,
                              progress_queue=task_progress_q)

    def _run(ag=exec_agent, aq=task_agent_q, t=task):
        try:
            for chunk in ag.stream({"messages": [("human", t)]}, {"recursion_limit": 40}):
                aq.put(("chunk", chunk))
            aq.put(("done", None))
        except Exception as exc:
            aq.put(("error", str(exc)))

    threading.Thread(target=_run, daemon=True).start()

    task_output_parts: list[str] = []
    pending_code = None
    while True:
        while not task_progress_q.empty():
            yield {"type": "progress", "content": task_progress_q.get_nowait()}

        try:
            kind, data = task_agent_q.get(timeout=0.05)
        except queue.Empty:
            continue

        if kind == "done":
            while not task_progress_q.empty():
                yield {"type": "progress", "content": task_progress_q.get_nowait()}
            break
        if kind == "error":
            yield {"type": "error", "content": f"Task {task_index + 1} error: {data}"}
            break

        chunk = data
        if "agent" in chunk:
            msg = chunk["agent"]["messages"][0]
            text = extract_text(msg.content)
            if text:
                text = CHART_RE.sub("", STREAMLIT_RE.sub("", IMAGE_RE.sub("", text))).strip()
                if text:
                    task_output_parts.append(text)
                    yield {"type": "text", "content": text}
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc.get("name") == "python_repl_tool":
                        pending_code = tc["args"].get("code", "")
                        yield {"type": "code", "content": pending_code}

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
                        img_b64 = _base64.b64encode(_f.read()).decode()
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
                    found_charts.append("base64")

            for sl_match in STREAMLIT_RE.finditer(tool_output):
                sl_filename = sl_match.group(1).strip()
                sl_file = data_folder / sl_filename
                if sl_file.exists() and sl_file.suffix == '.py':
                    yield {"type": "streamlit", "content": sl_filename}

            clean_output = CHART_RE.sub("", IMAGE_RE.sub("", STREAMLIT_RE.sub("", tool_output))).strip()
            if clean_output:
                task_output_parts.append(clean_output)
                yield {"type": "output", "content": clean_output}
            pending_code = None

    yield {"type": "_task_output", "content": "\n".join(task_output_parts),
           "task": task, "index": task_index}


def _run_phase_parallel(generators):
    """Run multiple task generators in parallel, yielding interleaved events."""
    if len(generators) == 1:
        yield from generators[0]
        return

    merged_q: queue.Queue = queue.Queue()
    active = len(generators)

    def _drain(gen, q):
        try:
            for event in gen:
                q.put(event)
        except Exception as e:
            q.put({"type": "error", "content": str(e)})
        finally:
            q.put(None)

    for gen in generators:
        threading.Thread(target=_drain, args=(gen, merged_q), daemon=True).start()

    done = 0
    while done < active:
        try:
            event = merged_q.get(timeout=0.1)
        except queue.Empty:
            continue
        if event is None:
            done += 1
            continue
        yield event


def _cleanup_context_files(data_folder: Path):
    """Remove _ctx_*.pkl temporary shared context files."""
    for f in data_folder.glob("_ctx_*.pkl"):
        try:
            f.unlink()
        except Exception:
            pass


def run_agent_stream(data_folder: Path, question: str, history: list | None = None, system_prompt: str = None):
    """
    Normal Mode: 3-agent pipeline (Planner → Executor → Insight), all use MODEL_CHAT.

    1. Planner Agent   — understands the question, creates a short task list (MODEL_CHAT)
    2. Execution Agent — runs each task with python_repl_tool (MODEL_CHAT)
    3. Insight Agent   — interprets results, produces final insights (MODEL_CHAT)

    Events emitted:
      {"type": "agent_label", "content": "Planner|Execution|Insight / Report"}
      {"type": "plan",        "content": [{"task": "...", "agent": "execution"}, ...]}
      {"type": "task_start",  "content": "...", "index": i, "total": n, "agent": "execution"}
      {"type": "text"|"code"|"output"|"progress"|"image"|"streamlit"|"error", "content": "..."}
      {"type": "insight",     "content": "..."}
      {"type": "done"}
    """
    import json as _json
    from backend.core.config import GOOGLE_API_KEY, MODEL_CHAT, MAX_HISTORY_MESSAGES, MAX_HISTORY_CONTENT_LEN
    import os
    os.environ.setdefault("GOOGLE_API_KEY", GOOGLE_API_KEY)

    request_type = _classify_request_type(question, model=MODEL_CHAT)
    if request_type == "smalltalk":
        yield from _run_direct_llm(question, history=history, model=MODEL_CHAT)
        return

    history = history or []
    file_list = _list_data_contents(data_folder)
    schema_context = _load_schema_context(data_folder)

    if _is_simple_data_task(question):
        yield from _run_simple_data_task(data_folder, question, MODEL_CHAT, file_list, schema_context)
        return

    # Build history context for planner
    trimmed = history[-MAX_HISTORY_MESSAGES:]
    history_text = ""
    if trimmed:
        lines = []
        for role, content in trimmed:
            lines.append(f"{'User' if role == 'user' else 'AI'}: {_trim_content(content, MAX_HISTORY_CONTENT_LEN)}")
        history_text = "\n\nRiwayat percakapan sebelumnya:\n" + "\n".join(lines)

    # ── Step 1: Planner Agent (MODEL_CHAT) ────────────────────────────────────
    yield {"type": "agent_label", "content": "Planner"}

    planner_system = (
        "Kamu adalah Planner Agent analisis data. Tugasmu:\n"
        "1. Memahami pertanyaan pengguna\n"
        "2. Membuat daftar tugas eksekusi yang konkret dan berurutan\n"
        "3. Menentukan fase eksekusi (task dengan fase sama bisa paralel)\n\n"
        f"Dataset tersedia di '/app/data/':\n{file_list}\n\n"
        f"{schema_context}\n\n"
        "Kemampuan Execution Agent:\n"
        "- Analisis data, statistik, visualisasi, machine learning\n"
        "- Membuat dashboard/aplikasi Streamlit interaktif (.py) di /app/data/\n"
        "- Preprocessing, feature engineering, model training/evaluation\n\n"
        "Aturan output:\n"
        "- Keluarkan HANYA JSON array, tidak ada teks lain\n"
        '- Setiap item: {"task": "...", "agent": "execution", "phase": 0}\n'
        "- Minimal 2, maksimal 5 tugas\n"
        "- phase: integer mulai 0. Task dengan phase sama dijalankan PARALEL\n"
        "- Task yang bergantung pada hasil task lain harus di phase lebih tinggi\n"
        "- Jika pengguna meminta Streamlit/dashboard/UI, tambahkan task khusus pembuatan file .py\n"
        'Contoh: [{"task": "Muat dataset", "agent": "execution", "phase": 0}, '
        '{"task": "Statistik deskriptif", "agent": "execution", "phase": 1}, '
        '{"task": "Distribusi & korelasi", "agent": "execution", "phase": 1}]'
    )

    plan = [{"task": question, "agent": "execution", "phase": 0}]  # fallback
    try:
        llm_planner = ChatGoogleGenerativeAI(model=MODEL_CHAT, temperature=0, max_output_tokens=1024)
        planner_input = question + history_text
        response = llm_planner.invoke([("system", planner_system), ("human", planner_input)])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        json_match = re.search(r'\[.*?\]', raw, re.DOTALL)
        if json_match:
            parsed = _json.loads(json_match.group(0))
            if isinstance(parsed, list) and parsed:
                plan = [
                    {"task": str(item.get("task", item)), "agent": "execution",
                     "phase": item.get("phase", idx)}
                    if isinstance(item, dict) else {"task": str(item), "agent": "execution", "phase": idx}
                    for idx, item in enumerate(parsed)
                ]
    except Exception:
        pass

    yield {"type": "plan", "content": plan}

    # ── Step 2: Execution Agent (MODEL_CHAT) ──────────────────────────────────
    yield {"type": "agent_label", "content": "Execution"}

    chart_rule = (
        "\n=== ATURAN GRAFIK ===\n"
        "Jangan pakai plt.show(). Gunakan:\n"
        "import matplotlib.pyplot as plt\n"
        "import uuid as _uuid\n"
        "_chart_path = f\"/app/data/_chart_{_uuid.uuid4().hex}.png\"\n"
        "plt.savefig(_chart_path, format='png', bbox_inches='tight', dpi=100)\n"
        "plt.close()\n"
        "print(f\"[[CHART_FILE]]{_chart_path}[[/CHART_FILE]]\")\n"
    )
    streamlit_rule = (
        "\n=== ATURAN STREAMLIT ===\n"
        "Jika pengguna meminta dashboard/UI Streamlit:\n"
        "1. Tulis kode Streamlit lengkap dan simpan ke file .py di /app/data/\n"
        "2. Print marker ini persis: [[STREAMLIT_APP]]nama_file.py[[/STREAMLIT_APP]]\n"
        "3. Gunakan path '/app/data/' untuk membaca dataset\n"
        "4. Jangan jalankan streamlit secara manual\n\n"
        "Best Practices Streamlit:\n"
        "- Gunakan st.cache_data untuk caching data loading\n"
        "- Gunakan st.tabs() atau st.columns() untuk layout yang rapi\n"
        "- Gunakan plotly.express untuk chart interaktif (hover, zoom, pan)\n"
        "- Tambahkan st.sidebar untuk filter/parameter\n"
        "- Gunakan st.metric() untuk menampilkan KPI/metrik utama\n"
        "- Tambahkan st.dataframe() dengan height parameter untuk tabel scrollable\n"
        "- PENTING: SELALU baca dari file data ASLI (CSV/Excel), JANGAN dari file .pkl\n"
        "  File pkl intermediate mungkin tidak tersedia di container Streamlit\n"
        "Contoh struktur:\n"
        "import streamlit as st\n"
        "import pandas as pd\n"
        "import plotly.express as px\n\n"
        "@st.cache_data\n"
        "def load_data():\n"
        "    return pd.read_csv('/app/data/data.csv')\n\n"
        "df = load_data()\n"
        "st.title('Dashboard Title')\n"
        "tab1, tab2 = st.tabs(['Overview', 'Analysis'])\n"
        "with tab1:\n"
        "    col1, col2 = st.columns(2)\n"
        "    col1.metric('Total', len(df))\n"
        "    fig = px.scatter(df, x='col1', y='col2')\n"
        "    st.plotly_chart(fig, use_container_width=True)\n"
    )
    executor_base = (
        "Kamu adalah Execution Agent. Eksekusi tugas berikut menggunakan python_repl_tool.\n\n"
        f"Dataset di '/app/data/':\n{file_list}\n\n"
        f"{schema_context}\n\n"
        "Aturan:\n"
        "- Langsung eksekusi menggunakan python_repl_tool\n"
        "- Jika error, perbaiki otomatis\n"
        "- Berikan ringkasan singkat hasil setelah eksekusi\n"
        "- Gunakan bahasa Indonesia\n"
        + chart_rule
        + streamlit_rule
        + CONTEXT_RULE
    )

    # Group tasks by phase for parallel execution
    phases = defaultdict(list)
    for i, task_item in enumerate(plan):
        phase = task_item.get("phase", i)
        phases[phase].append((i, task_item))

    collected_outputs: list[str] = []
    for phase_num in sorted(phases.keys()):
        phase_tasks = phases[phase_num]
        generators = []
        for i, task_item in phase_tasks:
            task = task_item["task"]
            prompt = executor_base + f"\nTugas saat ini [{i+1}/{len(plan)}]: {task}\n"
            generators.append(_execute_task(data_folder, task, i, len(plan),
                                           prompt, MODEL_CHAT, "execution"))

        for event in _run_phase_parallel(generators):
            if event["type"] == "_task_output":
                collected_outputs.append(f"[Tugas {event['index']+1}: {event['task']}]\n{event['content']}")
                continue
            yield event

    _cleanup_context_files(data_folder)

    # ── Step 3: Insight/Report Agent (MODEL_CHAT) ─────────────────────────────
    yield {"type": "agent_label", "content": "Insight / Report"}

    insight_context = "\n\n".join(collected_outputs) if collected_outputs else "(Tidak ada output)"
    insight_system = (
        "Kamu adalah Insight/Report Agent. Tugasmu menginterpretasi hasil analisis data "
        "dan membuat ringkasan insight yang informatif dan actionable.\n\n"
        "Aturan:\n"
        "- Berikan interpretasi yang jelas, konkret, dan bermakna\n"
        "- Tulis insight dalam poin-poin terstruktur\n"
        "- Fokus pada temuan penting, pola, dan implikasi\n"
        "- Hindari mengulang data mentah — fokus pada makna\n"
        "- Gunakan bahasa Indonesia\n"
        "- DILARANG mengakhiri dengan basa-basi seperti 'Semoga membantu'\n"
    )
    insight_human = (
        f"Pertanyaan awal pengguna: {question}\n\n"
        f"Hasil dari setiap tahap analisis:\n{insight_context[:6000]}\n\n"
        "Berikan insight dan kesimpulan berdasarkan hasil di atas."
    )
    try:
        llm_insight = ChatGoogleGenerativeAI(model=MODEL_CHAT, temperature=0.2, max_output_tokens=2048)
        ins_response = llm_insight.invoke([("system", insight_system), ("human", insight_human)])
        ins_text = ins_response.content if isinstance(ins_response.content, str) else extract_text(ins_response.content)
        if ins_text:
            yield {"type": "insight", "content": ins_text}
    except Exception as exc:
        yield {"type": "error", "content": f"Insight Agent error: {str(exc)}"}

    yield {"type": "done"}


def run_pro_stream(data_folder: Path, question: str, history: list | None = None):
    """
    Pro Mode: 4-agent pipeline.

    1. Planner Agent     (MODEL_DEEP)  — understands the question, creates a structured task plan
    2. Data Retrieval Agent (MODEL_CHAT) — loads files, reads CSV/data, initial data overview
    3. Analysis/Code Agent  (MODEL_CHAT) — generates Python code, runs analysis & visualizations
    4. Insight/Report Agent (MODEL_DEEP) — interprets all results, produces final insights

    Events emitted:
      {"type": "agent_label", "content": "Planner|Data Retrieval|Analysis / Code|Insight / Report"}
      {"type": "plan",        "content": [{"task": "...", "agent": "retrieval|analysis"}, ...]}
      {"type": "task_start",  "content": "...", "index": i, "total": n, "agent": "retrieval|analysis"}
      {"type": "text"|"code"|"output"|"progress"|"image"|"streamlit"|"error", "content": "..."}
      {"type": "insight",     "content": "..."}
      {"type": "done"}
    """
    import json as _json
    from backend.core.config import GOOGLE_API_KEY, MODEL_CHAT, MODEL_DEEP
    import os
    os.environ.setdefault("GOOGLE_API_KEY", GOOGLE_API_KEY)

    request_type = _classify_request_type(question, model=MODEL_CHAT)
    if request_type == "smalltalk":
        yield from _run_direct_llm(question, history=history, model=MODEL_CHAT)
        return

    history = history or []
    file_list = _list_data_contents(data_folder)
    schema_context = _load_schema_context(data_folder)

    if _is_simple_data_task(question):
        yield from _run_simple_data_task(data_folder, question, MODEL_CHAT, file_list, schema_context)
        return

    # ── Step 1: Planner Agent (MODEL_DEEP) ───────────────────────────────────
    yield {"type": "agent_label", "content": "Planner"}

    planner_system = (
        "Kamu adalah Planner Agent analisis data. Tugasmu:\n"
        "1. Memahami pertanyaan pengguna\n"
        "2. Membuat daftar tugas eksekusi yang konkret dan berurutan\n"
        "3. Menentukan agent yang tepat untuk setiap tugas\n"
        "4. Menentukan fase eksekusi (task dengan fase sama bisa paralel)\n\n"
        f"Dataset tersedia di '/app/data/':\n{file_list}\n\n"
        f"{schema_context}\n\n"
        "Agent yang tersedia:\n"
        "- 'retrieval': memuat file, membaca CSV/data, melihat isi/struktur data, preview\n"
        "- 'analysis': analisis statistik, visualisasi, ML, preprocessing, generate Python,\n"
        "  dan membuat dashboard/aplikasi Streamlit interaktif (.py) ke /app/data/\n\n"
        "Aturan output:\n"
        "- Keluarkan HANYA JSON array, tidak ada teks lain\n"
        '- Setiap item: {"task": "...", "agent": "retrieval|analysis", "phase": 0}\n'
        "- Minimal 2, maksimal 6 tugas\n"
        "- phase: integer mulai 0. Task dengan phase sama dijalankan PARALEL\n"
        "- Tugas retrieval harus mendahului (phase lebih kecil) tugas analysis yang bergantung padanya\n"
        "- Jika pengguna meminta Streamlit/dashboard/UI, buat task khusus 'analysis' untuk membuat file .py\n"
        'Contoh: [{"task": "Muat dataset dan tampilkan info", "agent": "retrieval", "phase": 0}, '
        '{"task": "Statistik deskriptif", "agent": "analysis", "phase": 1}, '
        '{"task": "Visualisasi distribusi", "agent": "analysis", "phase": 1}, '
        '{"task": "Buat dashboard Streamlit", "agent": "analysis", "phase": 2}]'
    )

    plan = [{"task": question, "agent": "analysis", "phase": 0}]  # fallback
    try:
        llm_planner = ChatGoogleGenerativeAI(model=MODEL_DEEP, temperature=0, max_output_tokens=1024)
        response = llm_planner.invoke([("system", planner_system), ("human", question)])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        json_match = re.search(r'\[.*?\]', raw, re.DOTALL)
        if json_match:
            parsed = _json.loads(json_match.group(0))
            if isinstance(parsed, list) and parsed:
                plan = [
                    {"task": str(item.get("task", item)), "agent": item.get("agent", "analysis"),
                     "phase": item.get("phase", idx)}
                    if isinstance(item, dict) else {"task": str(item), "agent": "analysis", "phase": idx}
                    for idx, item in enumerate(parsed)
                ]
    except Exception:
        pass

    yield {"type": "plan", "content": plan}

    # ── Shared rules for code-executing agents ────────────────────────────────
    chart_rule = (
        "\n=== ATURAN GRAFIK ===\n"
        "Jangan pakai plt.show(). Gunakan:\n"
        "import matplotlib.pyplot as plt\n"
        "import uuid as _uuid\n"
        "_chart_path = f\"/app/data/_chart_{_uuid.uuid4().hex}.png\"\n"
        "plt.savefig(_chart_path, format='png', bbox_inches='tight', dpi=100)\n"
        "plt.close()\n"
        "print(f\"[[CHART_FILE]]{_chart_path}[[/CHART_FILE]]\")\n"
    )
    streamlit_rule = (
        "\n=== ATURAN STREAMLIT ===\n"
        "Jika pengguna meminta dashboard/UI Streamlit:\n"
        "1. Tulis kode Streamlit lengkap dan simpan ke file .py di /app/data/\n"
        "2. Print marker ini persis: [[STREAMLIT_APP]]nama_file.py[[/STREAMLIT_APP]]\n"
        "3. Gunakan path '/app/data/' untuk membaca dataset\n"
        "4. Jangan jalankan streamlit secara manual\n\n"
        "Best Practices Streamlit:\n"
        "- Gunakan st.cache_data untuk caching data loading\n"
        "- Gunakan st.tabs() atau st.columns() untuk layout yang rapi\n"
        "- Gunakan plotly.express untuk chart interaktif (hover, zoom, pan)\n"
        "- Tambahkan st.sidebar untuk filter/parameter\n"
        "- Gunakan st.metric() untuk menampilkan KPI/metrik utama\n"
        "- Tambahkan st.dataframe() dengan height parameter untuk tabel scrollable\n"
        "- PENTING: SELALU baca dari file data ASLI (CSV/Excel), JANGAN dari file .pkl\n"
        "  File pkl intermediate mungkin tidak tersedia di container Streamlit\n"
        "Contoh struktur:\n"
        "import streamlit as st\n"
        "import pandas as pd\n"
        "import plotly.express as px\n\n"
        "@st.cache_data\n"
        "def load_data():\n"
        "    return pd.read_csv('/app/data/data.csv')\n\n"
        "df = load_data()\n"
        "st.title('Dashboard Title')\n"
        "tab1, tab2 = st.tabs(['Overview', 'Analysis'])\n"
        "with tab1:\n"
        "    col1, col2 = st.columns(2)\n"
        "    col1.metric('Total', len(df))\n"
        "    fig = px.scatter(df, x='col1', y='col2')\n"
        "    st.plotly_chart(fig, use_container_width=True)\n"
    )

    # ── Agent system prompts ──────────────────────────────────────────────────
    retrieval_base = (
        "Kamu adalah Data Retrieval Agent. Fokusmu adalah memuat dan membaca data.\n\n"
        f"Dataset di '/app/data/':\n{file_list}\n\n"
        f"{schema_context}\n\n"
        "Aturan:\n"
        "- Gunakan pandas untuk membaca CSV, Excel, JSON, Parquet\n"
        "- Tampilkan shape, tipe kolom, beberapa baris pertama, info missing values\n"
        "- Jika error, perbaiki otomatis\n"
        "- Berikan ringkasan singkat setelah eksekusi\n"
        "- Gunakan bahasa Indonesia\n"
        + streamlit_rule
        + CONTEXT_RULE
    )
    analysis_base = (
        "Kamu adalah Analysis/Code Agent. Fokusmu adalah menganalisis data dan membangun model.\n\n"
        f"Dataset di '/app/data/':\n{file_list}\n\n"
        f"{schema_context}\n\n"
        "Aturan:\n"
        "- Generate dan eksekusi Python untuk analisis statistik, visualisasi, atau ML\n"
        "- Jika error, perbaiki otomatis\n"
        "- Berikan ringkasan singkat hasil setelah eksekusi\n"
        "- Gunakan bahasa Indonesia\n"
        + chart_rule
        + streamlit_rule
        + CONTEXT_RULE
    )
    _AGENT_PROMPTS = {"retrieval": retrieval_base, "analysis": analysis_base}
    _AGENT_LABEL_NAMES = {"retrieval": "Data Retrieval", "analysis": "Analysis / Code"}

    # ── Step 2 & 3: Execute tasks via the appropriate agent ───────────────────
    collected_outputs: list[str] = []
    current_agent_type: str | None = None

    # Group tasks by phase for parallel execution
    phases = defaultdict(list)
    for i, task_item in enumerate(plan):
        phase = task_item.get("phase", i)
        phases[phase].append((i, task_item))

    for phase_num in sorted(phases.keys()):
        phase_tasks = phases[phase_num]

        # Emit agent labels for new agent types in this phase
        for _, task_item in phase_tasks:
            agent_type = task_item.get("agent", "analysis")
            if agent_type not in ("retrieval", "analysis"):
                agent_type = "analysis"
            if agent_type != current_agent_type:
                current_agent_type = agent_type
                yield {"type": "agent_label", "content": _AGENT_LABEL_NAMES[agent_type]}

        generators = []
        for i, task_item in phase_tasks:
            task = task_item["task"]
            agent_type = task_item.get("agent", "analysis")
            if agent_type not in ("retrieval", "analysis"):
                agent_type = "analysis"
            prompt = _AGENT_PROMPTS[agent_type] + f"\nTugas saat ini [{i+1}/{len(plan)}]: {task}\n"
            generators.append(_execute_task(data_folder, task, i, len(plan),
                                           prompt, MODEL_CHAT, agent_type))

        for event in _run_phase_parallel(generators):
            if event["type"] == "_task_output":
                collected_outputs.append(f"[Tugas {event['index']+1}: {event['task']}]\n{event['content']}")
                continue
            yield event

    _cleanup_context_files(data_folder)

    # ── Step 4: Insight/Report Agent (MODEL_DEEP) ─────────────────────────────
    yield {"type": "agent_label", "content": "Insight / Report"}

    insight_context = "\n\n".join(collected_outputs) if collected_outputs else "(Tidak ada output)"
    insight_system = (
        "Kamu adalah Insight/Report Agent. Tugasmu menginterpretasi hasil analisis data "
        "dan membuat ringkasan insight yang informatif dan actionable.\n\n"
        "Aturan:\n"
        "- Berikan interpretasi yang jelas, konkret, dan bermakna\n"
        "- Tulis insight dalam poin-poin terstruktur\n"
        "- Fokus pada temuan penting, pola, dan implikasi\n"
        "- Hindari mengulang data mentah — fokus pada makna\n"
        "- Gunakan bahasa Indonesia\n"
        "- DILARANG mengakhiri dengan basa-basi seperti 'Semoga membantu'\n"
    )
    insight_human = (
        f"Pertanyaan awal pengguna: {question}\n\n"
        f"Hasil dari setiap tahap analisis:\n{insight_context[:6000]}\n\n"
        "Berikan insight dan kesimpulan berdasarkan hasil di atas."
    )
    try:
        llm_insight = ChatGoogleGenerativeAI(model=MODEL_DEEP, temperature=0.2, max_output_tokens=2048)
        ins_response = llm_insight.invoke([("system", insight_system), ("human", insight_human)])
        ins_text = ins_response.content if isinstance(ins_response.content, str) else extract_text(ins_response.content)
        if ins_text:
            yield {"type": "insight", "content": ins_text}
    except Exception as exc:
        yield {"type": "error", "content": f"Insight Agent error: {str(exc)}"}

    yield {"type": "done"}
