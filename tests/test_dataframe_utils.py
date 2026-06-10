"""Unit tests for backend.core.dataframe_utils — shared DataFrame helpers.

Tests the unified DF loading and sandbox read-code generation that replaced
duplicated patterns across datasets.py and tools.py.
"""

from __future__ import annotations

import io

import pandas as pd
import pytest

from backend.core.dataframe_utils import (
    read_df_from_bytes,
    build_sandbox_read_code,
    build_data_inject_code,
    TABULAR_EXTENSIONS,
    ALL_DATASET_EXTENSIONS,
)


# ---------------------------------------------------------------------------
# read_df_from_bytes
# ---------------------------------------------------------------------------
class TestReadDfFromBytes:
    def test_csv(self):
        data = b"a,b\n1,2\n3,4"
        df = read_df_from_bytes(data, ".csv")
        assert list(df.columns) == ["a", "b"]
        assert len(df) == 2

    def test_csv_with_nrows(self):
        data = b"a,b\n1,2\n3,4\n5,6"
        df = read_df_from_bytes(data, ".csv", nrows=1)
        assert len(df) == 1

    def test_json(self):
        data = b'[{"x": 1}, {"x": 2}]'
        df = read_df_from_bytes(data, ".json")
        assert list(df.columns) == ["x"]
        assert len(df) == 2

    def test_json_with_nrows(self):
        data = b'[{"x": 1}, {"x": 2}, {"x": 3}]'
        df = read_df_from_bytes(data, ".json", nrows=1)
        assert len(df) == 1

    @pytest.mark.skipif(
        not any(
            __import__("importlib").util.find_spec(pkg) for pkg in ("pyarrow", "fastparquet")
        ),
        reason="pyarrow or fastparquet required for parquet tests",
    )
    def test_parquet(self, tmp_path):
        df_orig = pd.DataFrame({"col": [10, 20, 30]})
        buf = io.BytesIO()
        df_orig.to_parquet(buf)
        df = read_df_from_bytes(buf.getvalue(), ".parquet")
        assert list(df.columns) == ["col"]
        assert len(df) == 3

    def test_unsupported_ext_raises(self):
        with pytest.raises(ValueError, match="tidak didukung"):
            read_df_from_bytes(b"data", ".xyz")


# ---------------------------------------------------------------------------
# build_sandbox_read_code
# ---------------------------------------------------------------------------
class TestBuildSandboxReadCode:
    def test_csv_has_encoding_fallback(self):
        code = build_sandbox_read_code("data.csv", ".csv")
        assert "for _enc in" in code
        assert "data.csv" in code

    def test_xlsx(self):
        code = build_sandbox_read_code("report.xlsx", ".xlsx")
        assert "pd.read_excel" in code
        assert "report.xlsx" in code

    def test_json(self):
        code = build_sandbox_read_code("data.json", ".json")
        assert "pd.read_json" in code

    def test_parquet(self):
        code = build_sandbox_read_code("data.parquet", ".parquet")
        assert "pd.read_parquet" in code

    def test_unknown_ext_falls_back_to_csv(self):
        code = build_sandbox_read_code("file.txt", ".txt")
        assert "for _enc in" in code


# ---------------------------------------------------------------------------
# build_data_inject_code
# ---------------------------------------------------------------------------
class TestBuildDataInjectCode:
    def test_csv_has_encoding_fallback(self):
        code = build_data_inject_code("sales.csv", ".csv")
        assert "for _enc in" in code
        assert "sales.csv" in code

    def test_xlsx_returns_assignment(self):
        code = build_data_inject_code("file.xlsx", ".xlsx")
        assert "pd.read_excel" in code
        assert "df =" in code

    def test_unsupported_returns_empty(self):
        code = build_data_inject_code("file.abc", ".abc")
        assert code == ""


# ---------------------------------------------------------------------------
# Extension sets
# ---------------------------------------------------------------------------
class TestExtensionSets:
    def test_tabular_is_subset_of_all(self):
        assert TABULAR_EXTENSIONS.issubset(ALL_DATASET_EXTENSIONS)

    def test_pkl_only_in_all(self):
        assert ".pkl" in ALL_DATASET_EXTENSIONS
        assert ".pkl" not in TABULAR_EXTENSIONS
