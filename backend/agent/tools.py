"""Agent creation with tool definitions (python_repl, file_export, data_profile)."""

import json
import logging
import queue
import re
import ipaddress
import socket
from pathlib import Path
from urllib.parse import urlparse

from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

from backend.agent.llm import build_llm
from backend.agent.prompts import build_system_prompt
from backend.core.dataframe_utils import build_sandbox_read_code, build_data_inject_code, _DATA_INJECT_READERS
from sandbox import run_ai_code_securely, stream_ai_code_securely

logger = logging.getLogger(__name__)


def _assert_url_safe(url: str) -> None:
    """SSRF guard: reject non-http(s) schemes and hosts that resolve to
    private/loopback/link-local/reserved IPs (incl. cloud metadata endpoints).

    Raises ValueError when the URL is not safe to fetch from the backend host.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Skema URL tidak diizinkan: '{parsed.scheme or '(kosong)'}'. Hanya http/https.")
    host = parsed.hostname
    if not host:
        raise ValueError("URL tidak memiliki host yang valid.")
    try:
        addr_infos = socket.getaddrinfo(host, None)
    except Exception as exc:
        raise ValueError(f"Tidak bisa me-resolve host '{host}': {exc}")
    for info in addr_infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            raise ValueError(f"Akses ke alamat internal/privat diblokir ({ip_str}).")


# ── Profile code template (no f-string — use str.replace for placeholders) ──
_PROFILE_CODE_TEMPLATE = r'''
import pandas as pd
import json
import os

READ_CODE_PLACEHOLDER

n_rows, n_cols = df.shape
missing = df.isnull().sum()
missing_pct = (missing / n_rows * 100).round(2)
dupe_count = int(df.duplicated().sum())
dtypes = df.dtypes.astype(str).to_dict()

num_df = df.select_dtypes(include='number')
cat_df = df.select_dtypes(include=['object', 'category'])

desc_num = num_df.describe().round(4).to_dict() if not num_df.empty else {}
desc_cat = cat_df.describe(include='all').to_dict() if not cat_df.empty else {}

# Korelasi
corr_rows_html = ""
if num_df.shape[1] >= 2:
    corr = num_df.corr().round(3)
    cols = corr.columns.tolist()
    pairs = []
    for i in range(len(cols)):
        for j in range(i+1, len(cols)):
            r = corr.iloc[i, j]
            if abs(r) >= 0.3:
                pairs.append((cols[i], cols[j], float(r)))
    pairs.sort(key=lambda x: abs(x[2]), reverse=True)
    for p in pairs[:20]:
        color = '#16a34a' if p[2] > 0 else '#dc2626'
        corr_rows_html += (
            "<tr><td>" + str(p[0]) + "</td><td>" + str(p[1]) + "</td>"
            "<td style='color:" + color + "'>" + str(round(p[2], 3)) + "</td></tr>"
        )

# Missing values rows
missing_rows_html = ""
for col in df.columns:
    m = int(missing[col])
    pct = float(missing_pct[col])
    bar_width = min(pct, 100)
    bar = (
        "<div style='height:6px;background:#e2e8f0;border-radius:3px;'>"
        "<div style='width:" + str(bar_width) + "%;height:100%;background:#f59e0b;border-radius:3px;'></div></div>"
    )
    missing_rows_html += (
        "<tr><td>" + str(col) + "</td><td>" + str(dtypes[col]) + "</td>"
        "<td>" + str(m) + " (" + str(pct) + "%)</td><td style='min-width:120px'>" + bar + "</td></tr>"
    )

# Numeric stats rows
num_stat_rows_html = ""
for col, stats in desc_num.items():
    cells = "".join(
        "<td>" + str(round(stats.get(k, 0), 4) if isinstance(stats.get(k), (float, int)) else stats.get(k, "—")) + "</td>"
        for k in ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']
    )
    num_stat_rows_html += "<tr><td>" + str(col) + "</td>" + cells + "</tr>"

# Categorical rows
cat_rows_html = ""
for col in cat_df.columns:
    top = df[col].value_counts().head(5)
    vals = ", ".join(str(v) + " (" + str(c) + ")" for v, c in top.items())
    nuniq = int(df[col].nunique())
    cat_rows_html += (
        "<tr><td>" + str(col) + "</td><td>" + str(nuniq) + "</td><td>" + str(vals) + "</td></tr>"
    )

# Warnings
warn_html = ""
if missing.sum() > 0:
    warn_html += (
        "<div class='warn'>WARNING_ICON Dataset memiliki " + str(int(missing.sum())) +
        " nilai kosong di " + str(int((missing > 0).sum())) + " kolom.</div>"
    )
if dupe_count > 0:
    warn_html += (
        "<div class='warn'>WARNING_ICON Ditemukan " + str(dupe_count) + " baris duplikat.</div>"
    )

# Stat cards
def stat_card(label, value, color="#0ea5e9"):
    return (
        "<div class='card'><div class='card-val' style='color:" + color + "'>" +
        str(value) + "</div><div class='card-label'>" + label + "</div></div>"
)

cards_html = (
    stat_card("Total Baris", "{:,}".format(n_rows)) +
    stat_card("Total Kolom", n_cols) +
    stat_card("Missing Values", int(missing.sum()), "#f59e0b" if missing.sum() > 0 else "#16a34a") +
    stat_card("Duplikat", dupe_count, "#f59e0b" if dupe_count > 0 else "#16a34a") +
    stat_card("Kolom Numerik", num_df.shape[1], "#6366f1") +
    stat_card("Kolom Kategori", cat_df.shape[1], "#8b5cf6")
)

corr_section = corr_rows_html if corr_rows_html else "<p>Tidak ada korelasi signifikan (|r| \u2265 0.3).</p>"
corr_table = (
    "<table class='tbl'><thead><tr><th>Kolom A</th><th>Kolom B</th><th>Korelasi</th></tr></thead>"
    "<tbody>" + corr_section + "</tbody></table>"
    if corr_rows_html else corr_section
)

num_section = ""
if num_stat_rows_html:
    num_section = (
        "<h2>Statistik Deskriptif (Numerik)</h2>"
        "<div class='section' style='overflow-x:auto'>"
        "<table class='tbl'><thead><tr>"
        "<th>Kolom</th><th>Count</th><th>Mean</th><th>Std</th>"
        "<th>Min</th><th>25%</th><th>50%</th><th>75%</th><th>Max</th>"
        "</tr></thead><tbody>" + num_stat_rows_html + "</tbody></table></div>"
    )

cat_section = ""
if cat_rows_html:
    cat_section = (
        "<h2>Ringkasan Kolom Kategorikal</h2>"
        "<div class='section'><table class='tbl'><thead><tr>"
        "<th>Kolom</th><th>Unique</th><th>Top 5 Nilai</th>"
        "</tr></thead><tbody>" + cat_rows_html + "</tbody></table></div>"
    )

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;color:#1e293b;padding:2rem}
h1{font-size:1.6rem;font-weight:700;margin-bottom:.25rem;color:#0f172a}
.sub{color:#64748b;font-size:.9rem;margin-bottom:1.5rem}
.cards{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.5rem;min-width:120px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card-val{font-size:1.6rem;font-weight:700}
.card-label{font-size:.75rem;color:#64748b;margin-top:.2rem;text-transform:uppercase;letter-spacing:.05em}
h2{font-size:1.1rem;font-weight:600;margin:1.5rem 0 .75rem;color:#0f172a;border-left:3px solid #0ea5e9;padding-left:.6rem}
.tbl{width:100%;border-collapse:collapse;font-size:.85rem;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.tbl th{background:#f1f5f9;padding:.5rem .75rem;text-align:left;font-weight:600;color:#475569}
.tbl td{padding:.45rem .75rem;border-top:1px solid #f1f5f9}
.tbl tr:hover td{background:#f8fafc}
.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:.6rem 1rem;border-radius:8px;margin-bottom:.75rem;font-size:.85rem}
.section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:1.25rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.footer{margin-top:2rem;text-align:center;color:#94a3b8;font-size:.75rem}
"""

html = (
    "<!DOCTYPE html><html lang='id'><head>"
    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>Profiling \u2014 FILENAME_PLACEHOLDER</title>"
    "<style>" + CSS + "</style></head><body>"
    "<h1>Profiling Report: FILENAME_PLACEHOLDER</h1>"
    "<div class='sub'>Dibuat oleh Analisai &bull; " + "{:,}".format(n_rows) + " baris &bull; " + str(n_cols) + " kolom</div>"
    "<div class='cards'>" + cards_html + "</div>"
    + warn_html +
    "<h2>Missing Values &amp; Tipe Data</h2>"
    "<div class='section'><table class='tbl'><thead><tr>"
    "<th>Kolom</th><th>Tipe</th><th>Missing</th><th>Bar</th>"
    "</tr></thead><tbody>" + missing_rows_html + "</tbody></table></div>"
    + num_section + cat_section +
    "<h2>Korelasi Antar Kolom Numerik</h2>"
    "<div class='section'>" + corr_table + "</div>"
    "<div class='footer'>Dihasilkan oleh Analisai Data Analyst Agent</div>"
    "</body></html>"
)

out_path = "OUTPUT_PATH_PLACEHOLDER"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)
print("PROFILE_DONE:" + out_path)
'''


def create_agent(
    data_folder: Path,
    system_prompt: str = None,
    model: str = None,
    progress_queue: queue.Queue = None,
):
    from backend.core.config import MODEL_CHAT

    folder_str = str(data_folder)
    prompt = system_prompt if system_prompt is not None else build_system_prompt(data_folder)
    model = model or MODEL_CHAT

    def _push(msg: str) -> None:
        if progress_queue is not None:
            try:
                progress_queue.put(msg)
            except Exception:
                pass

    @tool
    def python_repl_tool(code: str) -> str:
        """Eksekusi kode Python/Pandas/SQL di sandbox terisolasi. Gunakan untuk kalkulasi, transformasi data, query, atau operasi file yang tidak dicakup tool lain."""
        code = "import warnings\nwarnings.filterwarnings('ignore')\n" + code
        status_box: list = []
        if progress_queue is not None:
            accumulated = []
            for line in stream_ai_code_securely(code, data_folder_path=folder_str, status_out=status_box):
                accumulated.append(line)
                if line.rstrip():
                    _push(line.rstrip())
            output = "".join(accumulated)
        else:
            output = run_ai_code_securely(code, data_folder_path=folder_str, status_out=status_box)

        status = status_box[0] if status_box else "success"
        if status == "error":
            return json.dumps({"status": "error", "output": output[:1000]}, ensure_ascii=False)
        return json.dumps({"status": "success", "output": output[:3000]}, ensure_ascii=False)

    @tool
    def update_task_list_tool(tasks: list[str], completed_indices: list[int]) -> str:
        """Gunakan tool ini untuk membuat atau mengupdate To-Do List yang tampil di Widget UI khusus pengguna. 
        Panggil tool ini setiap kali merencanakan tugas baru atau menyelesaikan tugas.
        - tasks: daftar semua tugas (contoh: ["Inspeksi Data", "Visualisasi Histogram"])
        - completed_indices: daftar indeks (0-based) dari tugas yang sudah selesai (contoh: [0] jika tugas pertama selesai)
        """
        import json
        _push(json.dumps({
            "type": "task_widget_update",
            "tasks": tasks,
            "completed": completed_indices
        }))
        return "Widget To-Do List berhasil diupdate."

    # ── File Export Tool ───────────────────────────────────────────────
    @tool
    def file_export_tool(content: str, filename: str, format: str = "md") -> str:
        """Simpan konten teks ke file (ipynb, csv, xlsx, json, md, html, txt, py). Gunakan untuk mengekspor hasil analisis, notebook, atau laporan — BUKAN untuk visualisasi chart (gunakan render_chart_tool) atau profiling dataset (gunakan data_profile_tool). Semua file hasil ekspor disimpan di subfolder 'exports/'."""

        fmt = re.sub(r"[^a-z0-9]", "", format.lower().strip().lstrip("."))
        fname = re.sub(r"[^A-Za-z0-9_\-]", "_", Path(filename).stem) or "export"

        exports_folder = data_folder / "exports"
        exports_folder.mkdir(exist_ok=True)

        # Write content to a temporary file in the sandbox folder
        import uuid
        temp_id = str(uuid.uuid4())
        temp_input_path = data_folder / f"temp_input_{temp_id}.txt"
        with open(temp_input_path, "w", encoding="utf-8") as f:
            f.write(content)

        # Execute export logic inside sandbox
        script_code = f"""
import os
import json
import re

data_dir = '/app/data/exports'
os.makedirs(data_dir, exist_ok=True)
fmt = '{fmt}'
fname = '{fname}'
temp_input = '/app/data/temp_input_{temp_id}.txt'

with open(temp_input, 'r', encoding='utf-8') as f:
    content = f.read()

out_path = os.path.join(data_dir, f"{{fname}}.{{fmt}}")

if fmt == "ipynb":
    try:
        parsed_content = json.loads(content)
        if isinstance(parsed_content, dict) and "cells" in parsed_content:
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(parsed_content, f, ensure_ascii=False, indent=2)
            print(f"DONE:{{out_path}}")
            exit(0)
    except Exception:
        pass

    cells = []
    code_block_re = re.compile(r"```(?:python)?\\n(.*?)```", re.DOTALL)
    parts = code_block_re.split(content)
    for i, part in enumerate(parts):
        text = part.strip()
        if not text:
            continue
        if i % 2 == 1:
            cells.append({{
                "cell_type": "code",
                "execution_count": None,
                "metadata": {{}},
                "outputs": [],
                "source": [ln + "\\n" for ln in text.split("\\n")],
            }})
        else:
            cells.append({{
                "cell_type": "markdown",
                "metadata": {{}},
                "source": [ln + "\\n" for ln in text.split("\\n")],
            }})

    notebook = {{
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {{
            "kernelspec": {{"display_name": "Python 3", "language": "python", "name": "python3"}},
            "language_info": {{"name": "python", "version": "3.10.0"}},
        }},
        "cells": cells or [{{"cell_type": "markdown", "metadata": {{}}, "source": [content]}}],
    }}
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(notebook, f, ensure_ascii=False, indent=2)

elif fmt == "xlsx":
    try:
        import io
        import pandas as pd
        try:
            df = pd.read_csv(io.StringIO(content))
        except Exception:
            lines = [line.split(",") for line in content.strip().splitlines()]
            if len(lines) > 1:
                df = pd.DataFrame(lines[1:], columns=lines[0])
            else:
                df = pd.DataFrame({{"content": content.splitlines()}})
        df.to_excel(out_path, index=False, engine="openpyxl")
    except Exception as exc:
        print(f"ERROR:{{exc}}")
        exit(1)

elif fmt == "json":
    try:
        parsed = json.loads(content)
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(parsed, f, ensure_ascii=False, indent=2)
    except json.JSONDecodeError:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(content)

elif fmt in ("csv", "md", "html", "txt", "py"):
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print(f"UNSUPPORTED:{{fmt}}")
    exit(1)

print(f"DONE:{{out_path}}")
"""
        output = run_ai_code_securely(script_code, data_folder_path=folder_str, bypass_validation=True)

        # Cleanup temp file
        if temp_input_path.exists():
            temp_input_path.unlink()

        if "UNSUPPORTED:" in output:
            return json.dumps({
                "type": "file_export",
                "error": f"Format '{fmt}' tidak didukung. Gunakan: ipynb, csv, xlsx, json, md, html, txt, py",
            }, ensure_ascii=False)
        elif "error" in output.lower():
            return json.dumps({
                "type": "file_export",
                "error": f"Gagal mengekspor file: {output}",
            }, ensure_ascii=False)

        out_path = exports_folder / f"{fname}.{fmt}"

        _push(f"📄 File diekspor: exports/{out_path.name}")
        return json.dumps({
            "type": "file_export",
            "filename": f"exports/{out_path.name}",
            "format": fmt,
            "size_bytes": out_path.stat().st_size if out_path.exists() else 0,
        }, ensure_ascii=False)


    # ── Read Data Tool ─────────────────────────────────────────────────
    @tool
    def read_data_tool(filename: str, n_rows: int = 5) -> str:
        """Baca preview dataset: tampilkan kolom, tipe data, dan n baris pertama. Gunakan sebelum analisis untuk memahami struktur data tanpa harus menulis kode Pandas sendiri."""

        _push(f"🔎 Membaca preview: {filename}")
        clean_name = Path(filename).name
        ext = Path(clean_name).suffix.lower()

        read_snippet = build_sandbox_read_code(clean_name, ext)

        code = (
            "import pandas as pd, json\n"
            + read_snippet +
            f"result = {{\n"
            f"    'shape': list(df.shape),\n"
            f"    'columns': df.dtypes.astype(str).to_dict(),\n"
            f"    'preview': df.head({n_rows}).to_dict(orient='records'),\n"
            f"    'missing': df.isnull().sum().to_dict()\n"
            f"}}\n"
            f"print(json.dumps(result, default=str))\n"
        )

        status_box: list = []
        output = run_ai_code_securely(code, data_folder_path=folder_str, status_out=status_box)
        if (status_box[0] if status_box else "success") == "error":
            return json.dumps({"status": "error", "output": output[:800]}, ensure_ascii=False)
        return output

    # ── Bash / Shell Tool ─────────────────────────────────────────────
    @tool
    def bash_tool(command: str, workdir: str = "/app/data") -> str:
        """Jalankan command shell di sandbox. Gunakan untuk: cek file (ls), pindah/rename file (mv), salin (cp), hapus (rm), inspect folder, atau operasi sistem cepat lainnya. JANGAN gunakan untuk analisis data — itu tugas python_repl_tool."""
        import uuid
        _safe_cmds = {"ls", "dir", "pwd", "whoami", "echo", "cat", "head", "tail", "wc", "stat", "du", "df", "mv", "cp", "mkdir", "file", "sort", "uniq", "cut", "find"}
        cmd_clean = command.strip().split()
        base = cmd_clean[0] if cmd_clean else ""
        if base not in _safe_cmds:
            _push(f"⚠️ Perintah '{base}' tidak diizinkan — gunakan python_repl_tool untuk operasi kompleks")
            return json.dumps({"status": "error", "output": f"Perintah '{base}' tidak diizinkan. Gunakan python_repl_tool untuk operasi yang membutuhkan {base}."}, ensure_ascii=False)

        from sandbox import run_bash_in_sandbox
        output = run_bash_in_sandbox(command, folder_str)
        return json.dumps({"status": "success", "output": output[:2000]}, ensure_ascii=False)

    # ── Render Chart Tool ──────────────────────────────────────────────
    @tool
    def render_chart_tool(code: str, filename: str = "chart.png") -> str:
        """Eksekusi kode matplotlib/seaborn dan simpan hasilnya sebagai PNG.
        Gunakan saat user meminta visualisasi, grafik, atau chart — JANGAN gunakan python_repl_tool untuk membuat chart.
        PENTING: State Python bersifat PERSISTEN. Variabel (seperti df) yang dimuat sebelumnya masih ada di memori."""

        # Ensure .png extension
        clean_filename = Path(filename).name
        if not clean_filename.lower().endswith('.png'):
            clean_filename += '.png'

        _push(f"📈 Membuat chart: {clean_filename}")

        # ── Guard: one call must produce exactly ONE chart ──────────────────
        # Multiple figures or multiple savefig calls means the agent batched
        # several charts; the tool can only save one file (and all savefig
        # calls would collide on the same filename), so ask it to split.
        _fig_count = len(re.findall(r"plt\.subplots\s*\(|plt\.figure\s*\(", code))
        _savefig_count = len(re.findall(r"plt\.savefig\s*\(", code))
        if _fig_count > 1 or _savefig_count > 1:
            _push("⚠️ Terdeteksi beberapa chart dalam satu panggilan")
            return json.dumps({
                "type": "chart",
                "error": (
                    "Satu panggilan render_chart_tool hanya boleh menghasilkan SATU chart, "
                    "tetapi terdeteksi beberapa figure/chart. Pisahkan menjadi beberapa "
                    "panggilan render_chart_tool terpisah — satu panggilan untuk satu chart."
                ),
            }, ensure_ascii=False)

        # ── Auto-inject data loading if the agent forgot to include it ──────
        # Check if the code already contains any file-reading call
        _has_data_load = any(kw in code for kw in [
            "pd.read_csv", "pd.read_excel", "pd.read_json", "pd.read_parquet",
            "read_csv", "read_excel", "read_json", "read_parquet",
            "open(", "sqlite3",
        ])

        data_inject = ""
        if not _has_data_load:
            _skip_prefixes = ("_chart_", "_ctx_", "_exec_")
            for _f in sorted(data_folder.iterdir()):
                if _f.name.startswith(_skip_prefixes) or not _f.is_file():
                    continue
                _ext = _f.suffix.lower()
                if _ext in _DATA_INJECT_READERS:
                    inject_body = build_data_inject_code(_f.name, _ext)
                    if inject_body:
                        data_inject = (
                            f"# Auto-injected: load data file\n"
                            f"if 'df' not in globals():\n"
                            + inject_body + "\n"
                        )
                        _push(f"⚡ Auto-inject data loading: {_f.name}")
                    break

        # ── Clean agent code: strip plt.show(), redirect plt.savefig(), strip plt.close() ──
        import re as _re
        clean_code = code.replace("plt.show()", "# plt.show() stripped")
        # Redirect any plt.savefig(...) to the correct output path
        clean_code = _re.sub(
            r"plt\.savefig\s*\([^)]*\)",
            f"plt.savefig('/app/data/{clean_filename}', dpi=150, bbox_inches='tight')",
            clean_code
        )
        # Strip plt.close() so the figure is still available for auto-save fallback
        clean_code = _re.sub(r"plt\.close\s*\([^)]*\)", "# plt.close() stripped", clean_code)

        # Build save code that handles both matplotlib and seaborn grid objects
        # KEY: Check if file already exists BEFORE auto-save to avoid overwriting
        #      a valid chart that the agent already saved + closed.
        save_code = (
            "import warnings\n"
            "warnings.filterwarnings('ignore')\n"
            "import matplotlib\n"
            "matplotlib.use('Agg')\n"
            "import matplotlib.pyplot as plt\n"
            "import seaborn as sns\n"
            "import numpy as np\n"
            "import pandas as pd\n"
            "import os as _os\n"
            "\n"
            + data_inject
            + clean_code +
            "\n"
            "# --- Auto-save chart (only if agent didn't already save it) ---\n"
            "import gc as _gc\n"
            f"_out_path = '/app/data/{clean_filename}'\n"
            "\n"
            "# If the file already exists (agent saved it), skip auto-save\n"
            "if _os.path.exists(_out_path) and _os.path.getsize(_out_path) > 1000:\n"
            "    print('CHART_ALREADY_SAVED')\n"
            "else:\n"
            "    _saved = False\n"
            "    # Check for seaborn grid objects (PairGrid, FacetGrid, JointGrid, etc.)\n"
            "    for _var_name in reversed(list(dir())):\n"
            "        if _var_name.startswith('_'): continue\n"
            "        try:\n"
            "            _obj = eval(_var_name)\n"
            "        except Exception:\n"
            "            continue\n"
            "        if hasattr(_obj, 'savefig') and hasattr(_obj, 'fig'):\n"
            "            _obj.savefig(_out_path, dpi=150, bbox_inches='tight')\n"
            "            _saved = True\n"
            "            break\n"
            "    if not _saved:\n"
            "        try:\n"
            "            plt.tight_layout()\n"
            "        except Exception:\n"
            "            pass\n"
            "        plt.savefig(_out_path, dpi=150, bbox_inches='tight')\n"
            "\n"
            "plt.close('all')\n"
            "_gc.collect()\n"
            f"print('CHART_DONE:{clean_filename}')\n"
        )

        output = run_ai_code_securely(save_code, data_folder_path=folder_str)
        out_path = data_folder / clean_filename

        # Retry file check — Docker volume sync can take a moment
        import time as _time
        import os as _os
        for _ in range(30):
            try:
                # Force refresh directory cache on Windows
                _os.listdir(str(data_folder))
            except Exception:
                pass
            if out_path.exists() and out_path.stat().st_size > 0:
                break
            _time.sleep(0.5)

        if out_path.exists() and out_path.stat().st_size > 0:
            file_size = out_path.stat().st_size
            # DON'T embed base64 here — it would blow up the LLM context window!
            # DON'T delete the file — executor will read it from disk.
            _push(f"✅ Chart siap: {clean_filename} ({file_size:,} bytes)")
            return json.dumps({
                "type": "chart",
                "filename": clean_filename,
                "size_bytes": file_size,
            }, ensure_ascii=False)
        return json.dumps({"type": "chart", "error": f"Chart gagal dibuat karena kode error. Perbaiki kode lalu panggil ulang. Detail: {output[-500:].strip()}"}, ensure_ascii=False)

    # ── Data Profile Tool ──────────────────────────────────────────────
    @tool
    def data_profile_tool(filename: str) -> str:
        """Buat laporan profiling HTML lengkap untuk dataset: statistik deskriptif, korelasi, missing values, dan tipe data. Gunakan saat user meminta 'profiling', 'laporan data', atau 'ringkasan lengkap dataset'."""
        # Parameter filename: nama file dataset (contoh: 'data.csv') — tanpa path.

        _push(f"📊 Membuat profiling report untuk: {filename}")

        clean_name = Path(filename).name
        target_file = data_folder / clean_name

        if not target_file.exists():
            return json.dumps({
                "type": "file_export",
                "error": f"File '{clean_name}' tidak ditemukan di folder data.",
            }, ensure_ascii=False)

        ext = target_file.suffix.lower()
        if ext not in (".csv", ".xlsx", ".xls", ".json", ".parquet"):
            return json.dumps({
                "type": "file_export",
                "error": f"Format '{ext}' tidak didukung untuk profiling. Gunakan CSV, Excel, JSON, atau Parquet.",
            }, ensure_ascii=False)

        stem = target_file.stem
        out_html_name = f"{stem}_profile.html"
        out_html_path = data_folder / out_html_name

        read_code = build_sandbox_read_code(clean_name, ext)

        # Inject variables into the template (no f-string conflicts)
        profile_code = (
            _PROFILE_CODE_TEMPLATE
            .replace("READ_CODE_PLACEHOLDER", read_code)
            .replace("FILENAME_PLACEHOLDER", clean_name)
            .replace("OUTPUT_PATH_PLACEHOLDER", f"/app/data/{out_html_name}")
            .replace("WARNING_ICON", "⚠️")
        )

        try:
            output_parts = []
            for line in stream_ai_code_securely(profile_code, data_folder_path=folder_str, bypass_validation=True):
                output_parts.append(line)
                if line.rstrip():
                    _push(line.rstrip())
            output = "".join(output_parts)
            if out_html_path.exists():
                _push(f"✅ Profiling report selesai: {out_html_name}")
                return json.dumps({
                    "type": "file_export",
                    "filename": out_html_name,
                    "format": "html",
                    "size_bytes": out_html_path.stat().st_size,
                }, ensure_ascii=False)
            else:
                return json.dumps({
                    "type": "file_export",
                    "error": f"Profiling gagal. Output sandbox: {output[:600]}",
                }, ensure_ascii=False)
        except Exception as exc:
            logger.warning("data_profile_tool failed: %s", exc)
            return json.dumps({
                "type": "file_export",
                "error": f"Profiling error: {type(exc).__name__}: {str(exc)}",
            }, ensure_ascii=False)

    @tool
    def download_dataset_tool(url: str, filename: str = None) -> str:
        """Mengunduh berkas dataset (seperti CSV, XLSX, JSON, dll.) dari internet (URL publik, Google Sheets, Kaggle, dll.) ke folder data proyek.
        Masukkan direct download URL publik, link Google Sheets, atau Kaggle dataset URL / handle (contoh: mohammadtalib786/retail-sales-dataset)."""
        import requests as _requests
        
        # Check if URL is a Kaggle dataset URL or handle
        is_kaggle = False
        kaggle_handle = ""
        
        if "kaggle.com/datasets/" in url:
            import re as _re
            match = _re.search(r'kaggle\.com/datasets/([^/]+/[^/]+)', url)
            if match:
                kaggle_handle = match.group(1)
                is_kaggle = True
        elif "kaggle.com/" in url:
            import re as _re
            match = _re.search(r'kaggle\.com/([^/]+/[^/]+)', url)
            if match:
                kaggle_handle = match.group(1)
                is_kaggle = True
        elif "/" in url and not url.startswith("http://") and not url.startswith("https://"):
            import re as _re
            if _re.match(r'^[^/]+/[^/]+$', url.strip()):
                kaggle_handle = url.strip()
                is_kaggle = True
                
        if is_kaggle:
            _push(f"📦 Mengunduh dataset Kaggle '{kaggle_handle}' via kagglehub...")
        else:
            _push(f"📥 Mengunduh dataset dari: {url}")
            
        try:
            if is_kaggle:
                import kagglehub as _kagglehub
                import shutil as _shutil
                
                downloaded_dir = _kagglehub.dataset_download(kaggle_handle)
                downloaded_path = Path(downloaded_dir)
                
                copied_files = []
                for item in downloaded_path.iterdir():
                    if item.is_file():
                        dest_name = item.name
                        if dest_name in {"_exec_script.py", "_kernel_loop.py", "_schema.json", ".chats.json", "dashboard.json"}:
                            dest_name = "downloaded_" + dest_name
                            
                        dest_path = data_folder / dest_name
                        _shutil.copy2(item, dest_path)
                        copied_files.append(dest_name)
                    elif item.is_dir():
                        dest_path = data_folder / item.name
                        if dest_path.exists():
                            _shutil.rmtree(dest_path)
                        _shutil.copytree(item, dest_path)
                        copied_files.append(item.name + "/")
                
                if not copied_files:
                    raise ValueError("Tidak ada file ditemukan di dataset Kaggle yang diunduh.")
                
                file_size = sum((data_folder / f).stat().st_size for f in copied_files if (data_folder / f).is_file())
                
                _push(f"✅ Kaggle download selesai. File diimpor: {', '.join(copied_files)}")
                return json.dumps({
                    "status": "success",
                    "output": f"Dataset Kaggle '{kaggle_handle}' berhasil diunduh dan diimpor: {', '.join(copied_files)} ({file_size:,} bytes)."
                }, ensure_ascii=False)

            # Auto-convert Google Sheets link
            if "docs.google.com/spreadsheets" in url:
                import re as _re
                match = _re.search(r'(docs\.google\.com/spreadsheets/d/[^/]+)', url)
                if match:
                    url = "https://" + match.group(1) + "/export?format=csv"
                    _push("⚡ Mendeteksi link Google Sheets, mengonversi ke link ekspor CSV...")
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }

            # SSRF guard: validate the target before connecting
            _assert_url_safe(url)

            response = _requests.get(url, headers=headers, stream=True, timeout=30)
            response.raise_for_status()

            # Re-validate the final URL after any redirects before reading the body
            _assert_url_safe(response.url)
            
            if not filename:
                cd = response.headers.get("Content-Disposition", "")
                if "filename=" in cd:
                    import re as _re
                    fnames = _re.findall(r'filename=["\']?([^"\';]+)["\']?', cd)
                    if fnames:
                        filename = fnames[0]
                
                if not filename:
                    from urllib.parse import urlparse as _urlparse
                    parsed = _urlparse(url)
                    filename = Path(parsed.path).name
                
                if not filename or filename == "export" or len(filename) < 3:
                    if "format=csv" in url or "csv" in response.headers.get("Content-Type", ""):
                        filename = "downloaded_dataset.csv"
                    elif "xlsx" in response.headers.get("Content-Type", ""):
                        filename = "downloaded_dataset.xlsx"
                    else:
                        filename = "downloaded_dataset.csv"
            
            filename = Path(filename).name
            if filename in {"_exec_script.py", "_kernel_loop.py", "_schema.json", ".chats.json", "dashboard.json"}:
                filename = "downloaded_" + filename

            # Enforce a maximum download size to protect host disk
            from backend.core.config import MAX_UPLOAD_MB
            max_bytes = MAX_UPLOAD_MB * 1024 * 1024
            try:
                declared = int(response.headers.get("Content-Length", "0"))
            except ValueError:
                declared = 0
            if declared and declared > max_bytes:
                _push(f"❌ File terlalu besar ({declared / 1024 / 1024:.1f} MB > {MAX_UPLOAD_MB} MB)")
                return json.dumps({
                    "status": "error",
                    "output": f"File terlalu besar ({declared / 1024 / 1024:.1f} MB). Batas maksimum {MAX_UPLOAD_MB} MB.",
                }, ensure_ascii=False)

            out_path = data_folder / filename
            downloaded = 0
            too_big = False
            with open(out_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if not chunk:
                        continue
                    downloaded += len(chunk)
                    if downloaded > max_bytes:
                        too_big = True
                        break
                    f.write(chunk)

            if too_big:
                try:
                    out_path.unlink()
                except Exception:
                    pass
                _push(f"❌ Unduhan dibatalkan: melebihi batas {MAX_UPLOAD_MB} MB")
                return json.dumps({
                    "status": "error",
                    "output": f"Unduhan dibatalkan: file melebihi batas {MAX_UPLOAD_MB} MB.",
                }, ensure_ascii=False)

            file_size = out_path.stat().st_size
            _push(f"✅ Unduhan selesai: {filename} ({file_size:,} bytes)")
            
            return json.dumps({
                "status": "success",
                "output": f"Dataset berhasil diunduh dan disimpan sebagai: {filename} ({file_size:,} bytes)."
            }, ensure_ascii=False)
            
        except Exception as e:
            _push(f"❌ Gagal mengunduh: {str(e)}")
            return json.dumps({
                "status": "error",
                "output": f"Gagal mengunduh dataset: {str(e)}"
            }, ensure_ascii=False)

    llm = build_llm(model=model, temperature=0, max_output_tokens=8192)

    # Build tool list
    tool_list = [update_task_list_tool, read_data_tool, python_repl_tool, render_chart_tool, file_export_tool, data_profile_tool, bash_tool, download_dataset_tool]

    kwargs = {
        "checkpointer": MemorySaver(),
    }
    import inspect
    sig = inspect.signature(create_react_agent)
    if "prompt" in sig.parameters:
        kwargs["prompt"] = prompt
    else:
        kwargs["messages_modifier"] = prompt

    return create_react_agent(
        llm,
        tools=tool_list,
        **kwargs
    )
