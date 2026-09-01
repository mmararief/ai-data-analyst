"""Shared utilities, regex constants, schema helpers, and dedup helpers."""

import json
import re
from pathlib import Path
from typing import Any

# ── Regex constants ───────────────────────────────────────────────────────────

IMAGE_RE = re.compile(r"\[\[IMAGE_START\]\](.*?)\[\[IMAGE_END\]\]", re.DOTALL)
CHART_RE = re.compile(r"\[\[CHART_FILE\]\](.*?)\[\[/CHART_FILE\]\]", re.DOTALL)
REACT_TRACE_RE = re.compile(
    r"^(Thought|Action\s*Input|Action|Observation)\s*:\s*.*$(\n|$)",
    re.MULTILINE | re.IGNORECASE,
)
CHART_PATH_RE = re.compile(r"/app/data/_chart_[a-f0-9]+\.png")
INTERNAL_PATH_RE = re.compile(
    r"`?/app/data/(?:"
    r"_ctx_[^\s`]*|"           # shared context pickle files
    r"_chart_[^\s`]*|"         # chart images
    r"_exec_script\.py|"       # internal exec script
    r"_schema\.json|"          # schema memory file
    r"models/[^\s`]*"          # model artifacts (joblib/metadata)
    r")`?"
)


# ── Text helpers ──────────────────────────────────────────────────────────────

def extract_text(content) -> str:
    if isinstance(content, list):
        return " ".join(
            b.get("text", "") for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return content or ""


def trim_content(text: str, max_len: int) -> str:
    """Truncate long history content to save tokens."""
    if len(text) <= max_len:
        return text
    half = max_len // 2
    return text[:half] + "\n... [dipotong] ...\n" + text[-half:]


# ── File / schema helpers ─────────────────────────────────────────────────────

def list_data_contents(data_folder: Path) -> str:
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


def list_data_files(data_folder: Path) -> list[str]:
    """Return sorted list of user-visible data file names (no _ or . prefixed)."""
    if not data_folder.exists():
        return []
    return [
        item.name for item in sorted(data_folder.iterdir())
        if item.is_file() and not item.name.startswith('_') and not item.name.startswith('.')
    ]


def load_schema_payload(data_folder: Path) -> dict | None:
    schema_path = data_folder / "_schema.json"
    if not schema_path.exists():
        return None
    try:
        payload = json.loads(schema_path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("datasets"), list):
            return payload
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "Failed to load schema from %s", schema_path, exc_info=True
        )
        return None
    return None


def load_schema_context(data_folder: Path) -> str:
    payload = load_schema_payload(data_folder)
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


def _format_number_id(n: int) -> str:
    """Format integer with Indonesian thousands separator (1.234.567)."""
    return f"{n:,}".replace(",", ".")


def answer_simple_task_from_schema(data_folder: Path, question: str) -> str | None:
    payload = load_schema_payload(data_folder)
    if not payload:
        return None

    datasets = payload.get("datasets", [])
    if not datasets:
        return None

    q = (question or "").lower()

    item = None
    if len(datasets) == 1:
        item = datasets[0]
    else:
        for ds in datasets:
            ds_name = (ds.get("file") or "").lower()
            if ds_name and ds_name in q:
                item = ds
                break
            stem = Path(ds_name).stem.lower()
            if stem and stem in q:
                item = ds
                break
        if item is None:
            return None

    file_name = item.get("file", "dataset")
    rows = item.get("rows")
    columns = item.get("columns", []) or []
    types = item.get("types", {}) or {}

    if any(keyword in q for keyword in ["jumlah baris", "berapa baris"]):
        if rows is not None:
            return f"Jumlah baris pada {file_name} adalah {_format_number_id(rows)}."
        return None
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
        if rows is not None:
            rows_str = _format_number_id(rows)
        else:
            rows_str = "?"
        return (
            f"Info dataset {file_name}: jumlah baris {rows_str}, jumlah kolom {len(columns)}. "
            + (f"Tipe data kolom: {type_summary}." if type_summary else "")
        )
    return None


# ── Dedup helpers ─────────────────────────────────────────────────────────────

def parse_json_from_llm(raw: str) -> Any | None:
    """Extract and parse the first JSON payload (object or array) from an LLM response string.

    Returns a dict, list, or None if parsing fails.
    """
    if not raw:
        return None

    # Try array first (for planner-style outputs), then object.
    array_match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except (json.JSONDecodeError, ValueError):
            pass

    obj_match = re.search(r"\{.*?\}", raw, re.DOTALL)
    if obj_match:
        try:
            return json.loads(obj_match.group(0))
        except (json.JSONDecodeError, ValueError):
            pass
    return None


def cleanup_context_files(data_folder: Path):
    """Remove _ctx_*.pkl temporary shared context files."""
    for f in data_folder.glob("_ctx_*.pkl"):
        try:
            f.unlink()
        except Exception:
            pass
