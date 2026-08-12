"""Shared utilities for loading DataFrames by file extension.

Consolidates the duplicated ext→reader dispatch that previously existed in
datasets.py (_load_dataset_df, _infer_schema, preview_file) and the sandbox
read-code generation that was duplicated across tools.py (read_data_tool,
data_profile_tool, render_chart_tool).
"""

import io
from pathlib import Path

import pandas as pd


# ── Supported extensions ─────────────────────────────────────────────────────

TABULAR_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet"}
ALL_DATASET_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet", ".pkl"}


# ── In-process DataFrame loading (from bytes) ───────────────────────────────

def read_df_from_bytes(data: bytes, ext: str, *, nrows: int | None = None) -> pd.DataFrame:
    """Read a DataFrame from raw bytes, dispatching by file extension.

    Parameters
    ----------
    data : bytes
        Raw file content.
    ext : str
        Lowercase extension **including the dot** (e.g. ``".csv"``).
    nrows : int | None
        Optional row limit (only effective for CSV / Excel).

    Returns
    -------
    pd.DataFrame

    Raises
    ------
    ValueError
        If *ext* is not a recognised tabular format.
    """
    buf = io.BytesIO(data)
    if ext == ".csv":
        return pd.read_csv(buf, nrows=nrows)
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(buf, nrows=nrows)
    if ext == ".json":
        df = pd.read_json(buf)
        return df.head(nrows) if nrows is not None else df
    if ext == ".parquet":
        df = pd.read_parquet(buf)
        return df.head(nrows) if nrows is not None else df
    if ext == ".pkl":
        return pd.read_pickle(buf)
    raise ValueError(f"Format tidak didukung: {ext}")


# ── Sandbox read-code generation ─────────────────────────────────────────────
#
# Several agent tools execute Python inside a Docker sandbox.  They all need
# the same ext→"pd.read_xxx('/app/data/<file>')" snippet, with CSV getting a
# multi-encoding fallback.  The helpers below generate that snippet once.

_CSV_ENCODING_FALLBACK_TEMPLATE = (
    "for _enc in ('utf-8', 'latin-1', 'cp1252', 'utf-8-sig'):\n"
    "    try:\n"
    "        df = pd.read_csv('/app/data/{name}', encoding=_enc)\n"
    "        break\n"
    "    except Exception:\n"
    "        df = None\n"
    "if df is None: raise ValueError('Encoding tidak dikenali')\n"
)

_SANDBOX_READERS: dict[str, str] = {
    ".csv":     _CSV_ENCODING_FALLBACK_TEMPLATE,
    ".xlsx":    "df = pd.read_excel('/app/data/{name}')",
    ".xls":     "df = pd.read_excel('/app/data/{name}')",
    ".json":    "df = pd.read_json('/app/data/{name}')",
    ".parquet": "df = pd.read_parquet('/app/data/{name}')",
}

_DATA_INJECT_READERS: dict[str, str] = {
    ".csv":     "pd.read_csv('/app/data/{name}', encoding='utf-8')",
    ".xlsx":    "pd.read_excel('/app/data/{name}')",
    ".xls":     "pd.read_excel('/app/data/{name}')",
    ".json":    "pd.read_json('/app/data/{name}')",
    ".parquet": "pd.read_parquet('/app/data/{name}')",
}


def build_sandbox_read_code(filename: str, ext: str) -> str:
    """Return a Python code snippet that loads ``/app/data/<filename>`` into ``df``.

    For CSV files this includes a multi-encoding fallback loop.  Falls back to
    CSV-style reading for unrecognised extensions.
    """
    name = Path(filename).name
    template = _SANDBOX_READERS.get(ext, _SANDBOX_READERS[".csv"])
    return template.format(name=name)


def build_data_inject_code(filename: str, ext: str) -> str:
    """Return a one-liner ``pd.read_xxx(...)`` expression for auto-injection.

    Used by ``render_chart_tool`` when the agent forgot to load data. Unlike
    :func:`build_sandbox_read_code` this returns only the *expression* (no
    ``df =`` assignment) suitable for embedding in an ``if 'df' not in
    globals()`` guard.

    For CSV files this returns a full encoding-fallback block instead.
    """
    name = Path(filename).name
    if ext == ".csv":
        return (
            f"    _df_loaded = False\n"
            f"    for _enc in ('utf-8', 'latin-1', 'cp1252', 'utf-8-sig'):\n"
            f"        try:\n"
            f"            df = pd.read_csv('/app/data/{name}', encoding=_enc)\n"
            f"            _df_loaded = True\n"
            f"            break\n"
            f"        except Exception:\n"
            f"            pass\n"
            f"    if not _df_loaded:\n"
            f"        raise ValueError('Tidak bisa membaca {name}')\n"
        )
    expr = _DATA_INJECT_READERS.get(ext)
    if expr is None:
        return ""
    return f"    df = {expr.format(name=name)}\n"
