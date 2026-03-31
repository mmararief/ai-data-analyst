import json
import logging
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin, clone
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, precision_score
from sklearn.metrics import r2_score, recall_score, roc_auc_score
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from sklearn.model_selection import KFold, RandomizedSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, OrdinalEncoder, StandardScaler

try:
    from xgboost import XGBClassifier, XGBRegressor
    _HAS_XGB = True
except ImportError:
    _HAS_XGB = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    _HAS_LGBM = True
except ImportError:
    _HAS_LGBM = False

log = logging.getLogger(__name__)


SUPPORTED_DATASET_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet", ".pkl"}
CLASSIFICATION = "classification"
REGRESSION = "regression"
CLUSTERING = "clustering"
MISSING_TOKENS = {"", "na", "n/a", "null", "none", "nan", "?", "-"}

HIGH_CARDINALITY_THRESHOLD = 50
NEAR_ID_UNIQUE_RATIO = 0.95
HIGH_MISSING_DROP_RATIO = 0.70
SKEWNESS_THRESHOLD = 1.0
OUTLIER_IQR_MULTIPLIER = 1.5


class AutoMLError(ValueError):
    pass


@dataclass
class FeatureEngineeringReport:
    datetime_features_created: list[str] = field(default_factory=list)
    text_features_created: dict[str, list[str]] = field(default_factory=dict)
    id_columns_dropped: list[str] = field(default_factory=list)
    high_cardinality_columns: dict[str, str] = field(default_factory=dict)
    skew_transformed_columns: list[str] = field(default_factory=list)
    outlier_clipped_columns: list[str] = field(default_factory=list)
    high_missing_columns_dropped: list[str] = field(default_factory=list)
    low_variance_columns_dropped: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "datetime_features_created": self.datetime_features_created,
            "text_features_created": self.text_features_created,
            "id_columns_dropped": self.id_columns_dropped,
            "high_cardinality_columns": self.high_cardinality_columns,
            "skew_transformed_columns": self.skew_transformed_columns,
            "outlier_clipped_columns": self.outlier_clipped_columns,
            "high_missing_columns_dropped": self.high_missing_columns_dropped,
            "low_variance_columns_dropped": self.low_variance_columns_dropped,
        }


@dataclass
class TrainingArtifacts:
    model_path: Path
    metadata_path: Path
    metadata: dict[str, Any]


@dataclass
class PredictionArtifacts:
    output_path: Path
    metadata: dict[str, Any]


def load_dataframe(file_path: Path) -> pd.DataFrame:
    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_DATASET_EXTENSIONS:
        raise AutoMLError(f"Format dataset tidak didukung: {ext}")
    if ext == ".csv":
        df = pd.read_csv(file_path)
    elif ext in {".xlsx", ".xls"}:
        df = pd.read_excel(file_path)
    elif ext == ".json":
        df = pd.read_json(file_path)
    elif ext == ".parquet":
        df = pd.read_parquet(file_path)
    else:
        df = pd.read_pickle(file_path)

    if not isinstance(df, pd.DataFrame):
        raise AutoMLError("File tidak menghasilkan DataFrame yang valid")
    if df.empty:
        raise AutoMLError("Dataset kosong dan tidak bisa dilatih")
    return df


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = [str(column).strip() for column in df.columns]
    if len(set(normalized)) != len(normalized):
        raise AutoMLError("Nama kolom duplikat setelah normalisasi. Periksa header dataset")
    df = df.copy()
    df.columns = normalized
    return df


def _resolve_target_column(df: pd.DataFrame, target_column: str) -> str:
    target_column = str(target_column).strip()
    if target_column in df.columns:
        return target_column
    lowered = {str(column).strip().lower(): column for column in df.columns}
    if target_column.lower() in lowered:
        return str(lowered[target_column.lower()])
    simplified = {
        str(column).strip().lower().replace("_", "").replace(" ", "").rstrip("s"): column
        for column in df.columns
    }
    normalized_target = target_column.lower().replace("_", "").replace(" ", "").rstrip("s")
    if normalized_target in simplified:
        return str(simplified[normalized_target])
    raise AutoMLError(f"Kolom target '{target_column}' tidak ditemukan")


def _numeric_quality_summary(df: pd.DataFrame, target_column: str) -> dict[str, Any]:
    numeric_df = df.select_dtypes(include=["number"]).copy()
    if numeric_df.empty:
        return {
            "numeric_columns": [],
            "outlier_columns": {},
            "skewed_columns": {},
            "top_correlations_to_target": {},
        }

    outlier_columns: dict[str, int] = {}
    skewed_columns: dict[str, float] = {}

    for column in numeric_df.columns:
        series = numeric_df[column].dropna()
        if series.empty:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr > 0:
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_count = int(((series < lower) | (series > upper)).sum())
            if outlier_count > 0:
                outlier_columns[column] = outlier_count
        skewness = float(series.skew()) if len(series) > 2 else 0.0
        if abs(skewness) >= 1.0:
            skewed_columns[column] = round(skewness, 4)

    top_correlations: dict[str, float] = {}
    if target_column in numeric_df.columns and len(numeric_df.columns) > 1:
        correlations = numeric_df.corr(numeric_only=True)[target_column].drop(labels=[target_column], errors="ignore")
        correlations = correlations.dropna().sort_values(key=lambda values: values.abs(), ascending=False).head(5)
        top_correlations = {column: round(float(value), 4) for column, value in correlations.items()}

    return {
        "numeric_columns": numeric_df.columns.tolist(),
        "outlier_columns": outlier_columns,
        "skewed_columns": skewed_columns,
        "top_correlations_to_target": top_correlations,
    }


def _data_quality_warnings(df: pd.DataFrame, target_column: str) -> list[str]:
    warnings: list[str] = []
    total_rows = max(len(df), 1)

    missing_ratio = df.isna().mean()
    high_missing_columns = [column for column, ratio in missing_ratio.items() if column != target_column and ratio >= 0.3]
    if high_missing_columns:
        warnings.append(f"Kolom dengan missing value tinggi: {', '.join(high_missing_columns[:5])}")

    target_unique_ratio = df[target_column].nunique(dropna=False) / total_rows
    if pd.api.types.is_numeric_dtype(df[target_column]) and target_unique_ratio < 0.05:
        warnings.append("Target numerik memiliki jumlah nilai unik rendah; cek kembali apakah task seharusnya klasifikasi")

    duplicated_rows = int(df.duplicated().sum())
    if duplicated_rows > 0:
        warnings.append(f"Dataset memiliki {duplicated_rows} baris duplikat sebelum cleaning")

    if total_rows < 100:
        warnings.append("Ukuran dataset relatif kecil sehingga hasil model bisa kurang stabil")

    return warnings


def profile_dataset(df: pd.DataFrame, target_column: str) -> dict[str, Any]:
    missing_by_column = {
        column: int(value)
        for column, value in df.isna().sum().items()
        if int(value) > 0
    }
    dtype_summary = {column: str(dtype) for column, dtype in df.dtypes.items()}
    target_series = df[target_column]
    target_distribution = target_series.dropna().astype(str).value_counts().head(10).to_dict()
    numeric_quality = _numeric_quality_summary(df, target_column)
    warnings = _data_quality_warnings(df, target_column)
    return {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "column_names": df.columns.tolist(),
        "dtype_summary": dtype_summary,
        "missing_by_column": missing_by_column,
        "duplicate_rows": int(df.duplicated().sum()),
        "target_column": target_column,
        "target_missing": int(target_series.isna().sum()),
        "target_unique_values": int(target_series.nunique(dropna=False)),
        "target_distribution_top": target_distribution,
        "numeric_quality": numeric_quality,
        "data_quality_warnings": warnings,
    }


def _clean_dataframe_core(df: pd.DataFrame, target_column: str | None = None) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    FIX #3: Refactored shared cleaning logic used by both supervised and unsupervised paths.
    Previously clean_dataset and clean_dataset_unsupervised were near-identical copies
    that could silently de-sync. Now both call this single function.
    """
    cleaned = _normalize_columns(df)
    object_columns = cleaned.select_dtypes(include=["object", "string"]).columns.tolist()

    for column in object_columns:
        cleaned[column] = cleaned[column].map(lambda value: value.strip() if isinstance(value, str) else value)
        cleaned[column] = cleaned[column].replace(list(MISSING_TOKENS), np.nan)

    for column in object_columns:
        sample = cleaned[column].dropna().head(200)
        if sample.empty:
            continue
        stripped = sample.astype(str).str.replace(r'[\$€£¥,\s]', '', regex=True)
        coerced = pd.to_numeric(stripped, errors='coerce')
        if coerced.notna().sum() / max(len(sample), 1) >= 0.8:
            mask = cleaned[column].notna()
            cleaned.loc[mask, column] = (
                cleaned.loc[mask, column]
                .astype(str)
                .str.replace(r'[\$€£¥,\s]', '', regex=True)
            )
            cleaned[column] = pd.to_numeric(cleaned[column], errors='coerce')

    duplicate_rows_removed = int(cleaned.duplicated().sum())
    if duplicate_rows_removed:
        cleaned = cleaned.drop_duplicates().copy()

    all_missing_columns = [
        column for column in cleaned.columns
        if (target_column is None or column != target_column) and cleaned[column].isna().all()
    ]
    if all_missing_columns:
        cleaned = cleaned.drop(columns=all_missing_columns)

    high_missing_columns = [
        column for column in cleaned.columns
        if (target_column is None or column != target_column)
        and cleaned[column].isna().mean() >= HIGH_MISSING_DROP_RATIO
    ]
    if high_missing_columns:
        cleaned = cleaned.drop(columns=high_missing_columns)

    constant_columns = [
        column for column in cleaned.columns
        if (target_column is None or column != target_column)
        and cleaned[column].nunique(dropna=True) <= 1
    ]
    if constant_columns:
        cleaned = cleaned.drop(columns=constant_columns)

    summary = {
        "duplicate_rows_removed": duplicate_rows_removed,
        "all_missing_columns_removed": all_missing_columns,
        "high_missing_columns_dropped": high_missing_columns,
        "constant_columns_removed": constant_columns,
        "rows_after_cleaning": int(len(cleaned)),
        "columns_after_cleaning": int(len(cleaned.columns)),
    }
    return cleaned, summary


def clean_dataset(df: pd.DataFrame, target_column: str) -> tuple[pd.DataFrame, dict[str, Any]]:
    cleaned, summary = _clean_dataframe_core(df, target_column=target_column)
    resolved_target = _resolve_target_column(cleaned, target_column)

    target_missing_removed = int(cleaned[resolved_target].isna().sum())
    cleaned = cleaned.dropna(subset=[resolved_target]).copy()

    summary["target_missing_rows_removed"] = target_missing_removed
    summary["resolved_target_column"] = resolved_target
    return cleaned, summary


def clean_dataset_unsupervised(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Variant of clean_dataset that doesn't require a target column (for clustering)."""
    return _clean_dataframe_core(df, target_column=None)


def infer_problem_type(target: pd.Series, requested: str = "auto") -> str:
    if requested in {CLASSIFICATION, REGRESSION}:
        return requested

    if requested != "auto":
        raise AutoMLError("problem_type harus auto, classification, atau regression")

    non_null = target.dropna()
    if non_null.empty:
        raise AutoMLError("Kolom target hanya berisi nilai kosong")

    unique_count = int(non_null.nunique())
    unique_ratio = unique_count / max(len(non_null), 1)

    if pd.api.types.is_bool_dtype(non_null):
        return CLASSIFICATION

    if pd.api.types.is_object_dtype(non_null) or pd.api.types.is_categorical_dtype(non_null):
        coerced = pd.to_numeric(non_null, errors='coerce')
        numeric_ratio = coerced.notna().sum() / max(len(non_null), 1)
        if numeric_ratio >= 0.8:
            if coerced.dropna().nunique() > 20:
                return REGRESSION
            return CLASSIFICATION
        return CLASSIFICATION

    if pd.api.types.is_float_dtype(non_null) and unique_count > 10:
        return REGRESSION

    if pd.api.types.is_integer_dtype(non_null) and unique_count <= 20 and unique_ratio <= 0.05:
        return CLASSIFICATION

    if unique_count > 20:
        return REGRESSION

    return CLASSIFICATION


def _make_one_hot_encoder() -> OneHotEncoder:
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def _is_id_like(series: pd.Series, column_name: str) -> bool:
    if series.dropna().empty:
        return False
    id_patterns = re.compile(r"(^id$|_id$|^index$|^key$|^pk$|^uuid$|^guid$)", re.IGNORECASE)
    if id_patterns.search(column_name):
        return True
    non_null = series.dropna()
    unique_ratio = non_null.nunique() / max(len(non_null), 1)
    if unique_ratio >= NEAR_ID_UNIQUE_RATIO and len(non_null) >= 20:
        if pd.api.types.is_integer_dtype(non_null) or pd.api.types.is_object_dtype(non_null):
            return True
    return False


def _is_text_like(series: pd.Series) -> bool:
    if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
        return False
    non_null = series.dropna()
    if non_null.empty:
        return False
    sample = non_null.astype(str).head(200)
    if sample.empty:
        return False
    avg_len = float(sample.str.len().mean())
    spaced_ratio = float((sample.str.contains(r"\s", regex=True)).mean())
    return avg_len >= 20 and spaced_ratio >= 0.6


def _extract_datetime_features(df: pd.DataFrame, target_column: str) -> tuple[pd.DataFrame, list[str]]:
    created_features: list[str] = []
    result = df.copy()
    for column in df.columns:
        if column == target_column:
            continue
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            series = df[column]
        else:
            if not pd.api.types.is_object_dtype(df[column]):
                continue
            sample = df[column].dropna().head(50)
            if sample.empty:
                continue
            try:
                parsed = pd.to_datetime(sample, infer_datetime_format=True, errors="coerce")
                if parsed.notna().mean() < 0.8:
                    continue
                series = pd.to_datetime(df[column], infer_datetime_format=True, errors="coerce")
            except Exception:
                continue

        prefix = column
        result[f"{prefix}_year"] = series.dt.year
        result[f"{prefix}_month"] = series.dt.month
        result[f"{prefix}_day"] = series.dt.day
        result[f"{prefix}_dayofweek"] = series.dt.dayofweek
        created_features.extend([f"{prefix}_year", f"{prefix}_month", f"{prefix}_day", f"{prefix}_dayofweek"])
        result = result.drop(columns=[column])

    return result, created_features


def _clip_outliers(df: pd.DataFrame, numeric_columns: list[str], target_column: str) -> tuple[pd.DataFrame, list[str]]:
    clipped_columns: list[str] = []
    result = df.copy()
    for column in numeric_columns:
        if column == target_column:
            continue
        series = result[column].dropna()
        if series.empty or len(series) < 10:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr <= 0:
            continue
        lower = q1 - OUTLIER_IQR_MULTIPLIER * iqr
        upper = q3 + OUTLIER_IQR_MULTIPLIER * iqr
        outlier_count = int(((series < lower) | (series > upper)).sum())
        if outlier_count > 0:
            result[column] = result[column].clip(lower=lower, upper=upper)
            clipped_columns.append(column)
    return result, clipped_columns


def _transform_skewed(df: pd.DataFrame, numeric_columns: list[str], target_column: str) -> tuple[pd.DataFrame, list[str]]:
    transformed: list[str] = []
    result = df.copy()
    for column in numeric_columns:
        if column == target_column:
            continue
        series = result[column].dropna()
        if series.empty or len(series) < 10:
            continue
        skewness = float(series.skew())
        if abs(skewness) >= SKEWNESS_THRESHOLD:
            min_val = series.min()
            if min_val >= 0:
                result[column] = np.log1p(result[column])
                transformed.append(column)
    return result, transformed


def engineer_features(
    df: pd.DataFrame,
    target_column: str,
) -> tuple[pd.DataFrame, FeatureEngineeringReport]:
    report = FeatureEngineeringReport()
    result = df.copy()

    result, dt_features = _extract_datetime_features(result, target_column)
    report.datetime_features_created = dt_features

    text_feature_map: dict[str, list[str]] = {}
    text_columns = [
        column for column in result.columns
        if column != target_column and _is_text_like(result[column])
    ]
    for column in text_columns:
        series = result[column].fillna("").astype(str)
        generated = [
            f"{column}_char_count",
            f"{column}_word_count",
            f"{column}_avg_word_len",
            f"{column}_uppercase_ratio",
            f"{column}_digit_ratio",
            f"{column}_punct_ratio",
        ]
        char_count = series.str.len()
        word_count = series.str.split().str.len().fillna(0)
        alnum_count = series.str.count(r"[A-Za-z0-9]")

        result[generated[0]] = char_count.astype(float)
        result[generated[1]] = word_count.astype(float)
        result[generated[2]] = (char_count / word_count.replace(0, np.nan)).fillna(0.0).astype(float)
        result[generated[3]] = (series.str.count(r"[A-Z]") / char_count.replace(0, np.nan)).fillna(0.0).astype(float)
        result[generated[4]] = (series.str.count(r"\d") / char_count.replace(0, np.nan)).fillna(0.0).astype(float)
        result[generated[5]] = (
            (char_count - alnum_count - series.str.count(r"\s")) / char_count.replace(0, np.nan)
        ).fillna(0.0).astype(float)

        text_feature_map[column] = generated
        result = result.drop(columns=[column])
    report.text_features_created = text_feature_map

    id_columns = []
    for column in result.columns:
        if column == target_column:
            continue
        if _is_text_like(result[column]):
            continue
        if _is_id_like(result[column], column):
            id_columns.append(column)
    if id_columns:
        result = result.drop(columns=id_columns)
        report.id_columns_dropped = id_columns

    cat_columns = result.select_dtypes(include=["object", "string", "category"]).columns.tolist()
    high_card_actions: dict[str, str] = {}
    for column in cat_columns:
        if column == target_column:
            continue
        if _is_text_like(result[column]):
            continue
        n_unique = result[column].nunique(dropna=True)
        if n_unique > HIGH_CARDINALITY_THRESHOLD:
            freq_map = result[column].value_counts(normalize=True, dropna=False)
            result[f"{column}_freq"] = result[column].map(freq_map).fillna(0.0)
            result = result.drop(columns=[column])
            high_card_actions[column] = f"frequency_encoded_as_{column}_freq (n_unique={n_unique})"
    report.high_cardinality_columns = high_card_actions

    numeric_cols = result.select_dtypes(include=["number"]).columns.tolist()
    low_var_cols = []
    for column in numeric_cols:
        if column == target_column:
            continue
        non_null = result[column].dropna()
        if non_null.empty:
            continue
        if non_null.nunique() <= 1:
            low_var_cols.append(column)
    if low_var_cols:
        result = result.drop(columns=low_var_cols)
        report.low_variance_columns_dropped = low_var_cols

    numeric_cols = result.select_dtypes(include=["number"]).columns.tolist()
    result, clipped = _clip_outliers(result, numeric_cols, target_column)
    report.outlier_clipped_columns = clipped

    numeric_cols = result.select_dtypes(include=["number"]).columns.tolist()
    result, skew_transformed = _transform_skewed(result, numeric_cols, target_column)
    report.skew_transformed_columns = skew_transformed

    return result, report


def build_preprocessor(features: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str]]:
    numeric_columns = features.select_dtypes(include=["number", "bool"]).columns.tolist()
    categorical_columns = [col for col in features.columns.tolist() if col not in numeric_columns]

    transformers = []
    if numeric_columns:
        transformers.append((
            "numeric",
            Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]),
            numeric_columns,
        ))
    if categorical_columns:
        low_card = [c for c in categorical_columns if features[c].nunique(dropna=True) <= 15]
        med_card = [c for c in categorical_columns if features[c].nunique(dropna=True) > 15]

        if low_card:
            transformers.append((
                "cat_low",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("encoder", _make_one_hot_encoder()),
                ]),
                low_card,
            ))
        if med_card:
            transformers.append((
                "cat_med",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
                ]),
                med_card,
            ))

    if not transformers:
        raise AutoMLError("Dataset tidak memiliki fitur yang bisa dipakai untuk training")

    return ColumnTransformer(transformers=transformers), numeric_columns, categorical_columns


def build_candidate_models(problem_type: str, random_state: int) -> dict[str, Any]:
    if problem_type == CLASSIFICATION:
        candidates = {
            "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced"),
            "random_forest": RandomForestClassifier(
                n_estimators=250,
                random_state=random_state,
                class_weight="balanced",
                n_jobs=-1,
            ),
            "gradient_boosting": GradientBoostingClassifier(random_state=random_state),
        }
        if _HAS_XGB:
            candidates["xgboost"] = XGBClassifier(
                n_estimators=250,
                random_state=random_state,
                use_label_encoder=False,
                eval_metric="logloss",
                verbosity=0,
                n_jobs=-1,
            )
        if _HAS_LGBM:
            candidates["lightgbm"] = LGBMClassifier(
                n_estimators=250,
                random_state=random_state,
                class_weight="balanced",
                verbose=-1,
                n_jobs=-1,
            )
        return candidates

    candidates = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(
            n_estimators=250,
            random_state=random_state,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingRegressor(random_state=random_state),
    }
    if _HAS_XGB:
        candidates["xgboost"] = XGBRegressor(
            n_estimators=250,
            random_state=random_state,
            verbosity=0,
            n_jobs=-1,
        )
    if _HAS_LGBM:
        candidates["lightgbm"] = LGBMRegressor(
            n_estimators=250,
            random_state=random_state,
            verbose=-1,
            n_jobs=-1,
        )
    return candidates


def _get_tuning_param_grid(model_key: str, problem_type: str) -> dict[str, list] | None:
    """Return a parameter grid for RandomizedSearchCV tuning of the best model."""
    if model_key == "random_forest":
        return {
            "model__n_estimators": [100, 250, 500],
            "model__max_depth": [None, 10, 20, 30],
            "model__min_samples_split": [2, 5, 10],
            "model__min_samples_leaf": [1, 2, 4],
        }
    if model_key == "gradient_boosting":
        return {
            "model__n_estimators": [100, 250, 500],
            "model__max_depth": [3, 5, 7, 10],
            "model__learning_rate": [0.01, 0.05, 0.1, 0.2],
        }
    if model_key == "xgboost":
        return {
            "model__n_estimators": [100, 250, 500],
            "model__max_depth": [3, 5, 7, 10],
            "model__learning_rate": [0.01, 0.05, 0.1, 0.2],
        }
    # FIX #4: Added num_leaves to LightGBM tuning — more impactful than max_depth for LGBM
    if model_key == "lightgbm":
        return {
            "model__n_estimators": [100, 250, 500],
            "model__num_leaves": [31, 63, 127],
            "model__max_depth": [3, 5, 7, 10],
            "model__learning_rate": [0.01, 0.05, 0.1, 0.2],
        }
    if model_key == "logistic_regression":
        return {
            "model__C": [0.01, 0.1, 1.0, 10.0],
        }
    return None


def _classification_cv(y_train: pd.Series, random_state: int):
    class_counts = y_train.value_counts(dropna=False)
    min_class_count = int(class_counts.min()) if not class_counts.empty else 0
    if min_class_count >= 2:
        splits = min(5, min_class_count)
        return StratifiedKFold(n_splits=splits, shuffle=True, random_state=random_state)
    return KFold(n_splits=min(3, max(len(y_train), 2)), shuffle=True, random_state=random_state)


def build_cv_strategy(problem_type: str, y_train: pd.Series, random_state: int):
    if len(y_train) < 4:
        raise AutoMLError("Dataset terlalu kecil untuk validasi model otomatis")
    if problem_type == CLASSIFICATION:
        return _classification_cv(y_train, random_state)
    return KFold(n_splits=min(5, len(y_train)), shuffle=True, random_state=random_state)


def _classification_metrics(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float | None]:
    predicted = model.predict(x_test)
    metrics: dict[str, float | None] = {
        "accuracy": round(float(accuracy_score(y_test, predicted)), 6),
        "f1_weighted": round(float(f1_score(y_test, predicted, average="weighted", zero_division=0)), 6),
        "precision_weighted": round(float(precision_score(y_test, predicted, average="weighted", zero_division=0)), 6),
        "recall_weighted": round(float(recall_score(y_test, predicted, average="weighted", zero_division=0)), 6),
        "roc_auc": None,
    }
    if y_test.nunique() == 2 and hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(x_test)
        if probabilities.shape[1] == 2:
            metrics["roc_auc"] = round(float(roc_auc_score(y_test, probabilities[:, 1])), 6)
    return metrics


def _regression_metrics(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float]:
    predicted = model.predict(x_test)
    rmse = math.sqrt(mean_squared_error(y_test, predicted))
    return {
        "rmse": round(float(rmse), 6),
        "mae": round(float(mean_absolute_error(y_test, predicted)), 6),
        "r2": round(float(r2_score(y_test, predicted)), 6),
    }


def evaluate_model(model: Pipeline, problem_type: str, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float | None]:
    if problem_type == CLASSIFICATION:
        return _classification_metrics(model, x_test, y_test)
    return _regression_metrics(model, x_test, y_test)


def _primary_metric(problem_type: str) -> tuple[str, str]:
    if problem_type == CLASSIFICATION:
        return "f1_weighted", "f1_weighted"
    return "rmse", "neg_root_mean_squared_error"


def _sanitize_model_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.strip().lower()).strip("-")
    return cleaned or "automl-model"


def _split_dataset(
    features: pd.DataFrame,
    target: pd.Series,
    problem_type: str,
    test_size: float,
    random_state: int,
):
    stratify = None
    if problem_type == CLASSIFICATION and target.nunique(dropna=False) > 1:
        class_counts = target.value_counts(dropna=False)
        if not class_counts.empty and int(class_counts.min()) >= 2:
            stratify = target
    return train_test_split(
        features,
        target,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )


def engineer_features_unsupervised(df: pd.DataFrame) -> tuple[pd.DataFrame, FeatureEngineeringReport]:
    """Feature engineering without a target column (for clustering)."""
    PLACEHOLDER = "__clustering_no_target__"
    result = df.copy()
    report = FeatureEngineeringReport()

    result, dt_features = _extract_datetime_features(result, PLACEHOLDER)
    report.datetime_features_created = dt_features

    text_feature_map: dict[str, list[str]] = {}
    text_columns = [c for c in result.columns if _is_text_like(result[c])]
    for column in text_columns:
        series = result[column].fillna("").astype(str)
        generated = [
            f"{column}_char_count", f"{column}_word_count", f"{column}_avg_word_len",
            f"{column}_uppercase_ratio", f"{column}_digit_ratio", f"{column}_punct_ratio",
        ]
        char_count = series.str.len()
        word_count = series.str.split().str.len().fillna(0)
        alnum_count = series.str.count(r"[A-Za-z0-9]")
        result[generated[0]] = char_count.astype(float)
        result[generated[1]] = word_count.astype(float)
        result[generated[2]] = (char_count / word_count.replace(0, np.nan)).fillna(0.0).astype(float)
        result[generated[3]] = (series.str.count(r"[A-Z]") / char_count.replace(0, np.nan)).fillna(0.0).astype(float)
        result[generated[4]] = (series.str.count(r"\d") / char_count.replace(0, np.nan)).fillna(0.0).astype(float)
        result[generated[5]] = (
            (char_count - alnum_count - series.str.count(r"\s")) / char_count.replace(0, np.nan)
        ).fillna(0.0).astype(float)
        text_feature_map[column] = generated
        result = result.drop(columns=[column])
    report.text_features_created = text_feature_map

    id_columns = [c for c in result.columns if not _is_text_like(result[c]) and _is_id_like(result[c], c)]
    if id_columns:
        result = result.drop(columns=id_columns)
        report.id_columns_dropped = id_columns

    cat_columns = result.select_dtypes(include=["object", "string", "category"]).columns.tolist()
    high_card_actions: dict[str, str] = {}
    for column in cat_columns:
        if _is_text_like(result[column]):
            continue
        n_unique = result[column].nunique(dropna=True)
        if n_unique > HIGH_CARDINALITY_THRESHOLD:
            freq_map = result[column].value_counts(normalize=True, dropna=False)
            result[f"{column}_freq"] = result[column].map(freq_map).fillna(0.0)
            result = result.drop(columns=[column])
            high_card_actions[column] = f"frequency_encoded (n_unique={n_unique})"
    report.high_cardinality_columns = high_card_actions

    numeric_cols = result.select_dtypes(include=["number"]).columns.tolist()
    low_var_cols = [c for c in numeric_cols if result[c].dropna().nunique() <= 1]
    if low_var_cols:
        result = result.drop(columns=low_var_cols)
        report.low_variance_columns_dropped = low_var_cols

    numeric_cols = result.select_dtypes(include=["number"]).columns.tolist()
    result, clipped = _clip_outliers(result, numeric_cols, PLACEHOLDER)
    report.outlier_clipped_columns = clipped

    numeric_cols = result.select_dtypes(include=["number"]).columns.tolist()
    result, skew_transformed = _transform_skewed(result, numeric_cols, PLACEHOLDER)
    report.skew_transformed_columns = skew_transformed

    return result, report


def build_candidate_clusterers(n_clusters: int, random_state: int) -> dict[str, Any]:
    candidates = {
        "kmeans": KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10),
        "agglomerative": AgglomerativeClustering(n_clusters=n_clusters),
    }
    return candidates


def _evaluate_clustering(labels: np.ndarray, x_scaled: np.ndarray) -> dict[str, float | None]:
    n_labels = len(set(labels)) - (1 if -1 in labels else 0)
    if n_labels < 2:
        return {"silhouette": None, "davies_bouldin": None, "calinski_harabasz": None, "n_clusters_found": int(n_labels)}
    try:
        sil = round(float(silhouette_score(x_scaled, labels, sample_size=min(5000, len(labels)))), 6)
    except Exception:
        sil = None
    try:
        db = round(float(davies_bouldin_score(x_scaled, labels)), 6)
    except Exception:
        db = None
    try:
        ch = round(float(calinski_harabasz_score(x_scaled, labels)), 6)
    except Exception:
        ch = None
    return {"silhouette": sil, "davies_bouldin": db, "calinski_harabasz": ch, "n_clusters_found": int(n_labels)}


def _auto_select_k(preprocessed: np.ndarray, k_min: int = 2, k_max: int = 10, random_state: int = 42) -> int:
    """Elbow method + silhouette to suggest best k for KMeans."""
    best_k = k_min
    best_sil = -1.0
    for k in range(k_min, min(k_max + 1, preprocessed.shape[0])):
        try:
            km = KMeans(n_clusters=k, random_state=random_state, n_init=10)
            labels = km.fit_predict(preprocessed)
            sil = float(silhouette_score(preprocessed, labels, sample_size=min(3000, len(labels))))
            if sil > best_sil:
                best_sil = sil
                best_k = k
        except Exception:
            continue
    return best_k


def train_clustering(
    *,
    data_folder: Path,
    dataset_name: str,
    n_clusters: int = 0,
    model_name: str | None = None,
    random_state: int = 42,
    progress_callback: Callable[[str], None] | None = None,
) -> TrainingArtifacts:
    def _progress(msg: str) -> None:
        if progress_callback:
            try:
                progress_callback(msg)
            except Exception:
                pass

    dataset_path = data_folder / dataset_name
    if not dataset_path.exists() or not dataset_path.is_file():
        raise AutoMLError("Dataset tidak ditemukan")

    _progress(f"📂 Memuat dataset {dataset_name}...")
    raw_df = load_dataframe(dataset_path)

    _progress(f"🔄 Membersihkan data ({len(raw_df)} baris)...")
    cleaned, cleaning_summary = clean_dataset_unsupervised(raw_df)
    if len(cleaned) < 20:
        raise AutoMLError("Dataset terlalu kecil untuk clustering. Minimal 20 baris diperlukan")

    _progress("⚙️ Feature engineering & selection...")
    engineered, fe_report = engineer_features_unsupervised(cleaned)
    if engineered.empty or len(engineered.columns) == 0:
        raise AutoMLError("Dataset tidak memiliki fitur setelah preprocessing")

    preprocessor, numeric_columns, categorical_columns = build_preprocessor(engineered)
    try:
        x_scaled = preprocessor.fit_transform(engineered)
    except Exception as exc:
        raise AutoMLError(f"Preprocessing gagal: {exc}") from exc

    if n_clusters <= 1:
        _progress("🔍 Mencari jumlah cluster optimal (k=2..10)...")
        n_clusters = _auto_select_k(x_scaled, random_state=random_state)
        _progress(f"  ✓ Jumlah cluster optimal: {n_clusters}")
    else:
        _progress(f"🔍 Menggunakan {n_clusters} cluster | {len(engineered.columns)} fitur...")

    candidates = build_candidate_clusterers(n_clusters, random_state)
    leaderboard = []
    best_name = None
    best_model = None
    best_sil = -2.0
    best_labels = None

    total = len(candidates)
    for idx, (cname, estimator) in enumerate(candidates.items(), 1):
        _progress(f"🏋️ Clustering {idx}/{total}: {estimator.__class__.__name__}...")
        try:
            labels = estimator.fit_predict(x_scaled)
            metrics = _evaluate_clustering(labels, x_scaled)
        except Exception as exc:
            log.warning("Clusterer %s gagal: %s", cname, exc)
            _progress(f"  ⚠️ {estimator.__class__.__name__} gagal: {str(exc)[:60]}")
            continue

        sil = metrics.get("silhouette") or -2.0
        _progress(
            f"  ✓ {estimator.__class__.__name__}: silhouette={sil:.4f}, "
            f"db={metrics.get('davies_bouldin')}, k={metrics.get('n_clusters_found')}"
        )
        leaderboard.append({
            "model_key": cname,
            "model_class": estimator.__class__.__name__,
            "metrics": metrics,
            "is_best": False,
        })
        if sil > best_sil:
            best_sil = sil
            best_name = cname
            best_model = estimator
            best_labels = labels

    if best_model is None or best_name is None:
        raise AutoMLError("Tidak ada clusterer yang berhasil dijalankan")

    for item in leaderboard:
        if item["model_key"] == best_name:
            item["is_best"] = True

    best_class = best_model.__class__.__name__
    _progress(f"🏆 Clusterer terbaik: {best_class} | Menyimpan model...")

    result_df = cleaned.copy()
    result_df["cluster"] = best_labels
    cluster_counts = pd.Series(best_labels).value_counts().sort_index().to_dict()
    cluster_profile: dict[str, Any] = {}
    num_cols = result_df.select_dtypes(include=["number"]).columns.difference(["cluster"]).tolist()
    for c_id in sorted(set(best_labels)):
        mask = result_df["cluster"] == c_id
        profile: dict[str, Any] = {"size": int(mask.sum())}
        for col in num_cols[:10]:
            profile[col] = round(float(result_df.loc[mask, col].mean()), 4)
        cluster_profile[str(c_id)] = profile

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    artifact_stem = _sanitize_model_name(model_name or f"{dataset_path.stem}-clustering-{best_name}-{timestamp}")
    models_dir = data_folder / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / f"{artifact_stem}.joblib"
    metadata_path = models_dir / f"{artifact_stem}.metadata.json"

    joblib.dump((preprocessor, best_model), model_path)

    clustered_output_path = data_folder / f"{dataset_path.stem}_clustered_{timestamp}.csv"
    result_df.to_csv(clustered_output_path, index=False)

    best_metrics = next(item["metrics"] for item in leaderboard if item["model_key"] == best_name)
    metadata = {
        "artifact_name": artifact_stem,
        "dataset_name": dataset_name,
        "target_column": None,
        "problem_type": CLUSTERING,
        "best_model_key": best_name,
        "best_model_class": best_class,
        "model_path": f"models/{model_path.name}",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "rows_total": int(len(engineered)),
        "n_clusters": n_clusters,
        "feature_columns": engineered.columns.tolist(),
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "cleaning_summary": cleaning_summary,
        "feature_engineering": fe_report.to_dict(),
        "best_metrics": best_metrics,
        "leaderboard": leaderboard,
        "cluster_counts": {str(k): int(v) for k, v in cluster_counts.items()},
        "cluster_profile": cluster_profile,
        "clustered_output": clustered_output_path.name,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    _progress(f"✅ Clustering selesai! {n_clusters} cluster | Silhouette={best_sil:.4f}")
    _progress(f"💾 Hasil tersimpan: {clustered_output_path.name}")

    return TrainingArtifacts(model_path=model_path, metadata_path=metadata_path, metadata=metadata)


def _run_training_loop(
    candidates: dict,
    preprocessor,
    x_train, x_test, y_train, y_test,
    inferred_problem_type: str,
    cv_strategy,
    progress_prefix: str = "",
) -> tuple[list, str | None, Any, float | None]:
    """
    Extracted shared training loop used by both first-pass and regression-fallback.
    Returns (leaderboard, best_name, best_pipeline, best_sort_score).
    """
    primary_metric, scorer = _primary_metric(inferred_problem_type)
    leaderboard = []
    best_name = None
    best_pipeline = None
    best_sort_score = None
    total_candidates = len(candidates)

    for idx, (candidate_name, estimator) in enumerate(candidates.items(), 1):
        label = f"{progress_prefix}Training model {idx}/{total_candidates}: {estimator.__class__.__name__}..."
        pipeline = Pipeline([
            ("preprocessor", clone(preprocessor)),
            ("model", estimator),
        ])
        try:
            cv_scores = cross_val_score(pipeline, x_train, y_train, cv=cv_strategy, scoring=scorer, n_jobs=1)
            pipeline.fit(x_train, y_train)
            metrics = evaluate_model(pipeline, inferred_problem_type, x_test, y_test)
        except Exception as exc:
            log.warning("Model %s gagal training: %s", candidate_name, exc)
            continue

        if inferred_problem_type == CLASSIFICATION:
            sort_score = float(metrics[primary_metric])
            cv_display = round(float(cv_scores.mean()), 6)
            cv_std = round(float(cv_scores.std()), 6)
        else:
            sort_score = -float(metrics[primary_metric])
            cv_display = round(float(-cv_scores.mean()), 6)
            cv_std = round(float(cv_scores.std()), 6)

        leaderboard.append({
            "model_key": candidate_name,
            "model_class": estimator.__class__.__name__,
            "cv_score": cv_display,
            "cv_std": cv_std,
            "test_metrics": metrics,
            "is_best": False,
        })

        if best_sort_score is None or sort_score > best_sort_score:
            best_sort_score = sort_score
            best_name = candidate_name
            best_pipeline = pipeline

    return leaderboard, best_name, best_pipeline, best_sort_score


def train_automl(
    *,
    data_folder: Path,
    dataset_name: str,
    target_column: str,
    problem_type: str = "auto",
    model_name: str | None = None,
    test_size: float = 0.2,
    random_state: int = 42,
    progress_callback: Callable[[str], None] | None = None,
    pre_cleaned_df: pd.DataFrame | None = None,
    pre_cleaning_summary: dict[str, Any] | None = None,
    pre_engineered_df: pd.DataFrame | None = None,
    pre_fe_report: FeatureEngineeringReport | None = None,
) -> TrainingArtifacts:
    def _progress(msg: str) -> None:
        if progress_callback:
            try:
                progress_callback(msg)
            except Exception:
                pass

    dataset_path = data_folder / dataset_name
    if not dataset_path.exists() or not dataset_path.is_file():
        raise AutoMLError("Dataset tidak ditemukan")
    if not 0.1 <= test_size <= 0.4:
        raise AutoMLError("test_size harus di antara 0.1 sampai 0.4")

    _progress(f"📂 Memuat dataset {dataset_name}...")
    raw_df = load_dataframe(dataset_path)
    normalized_raw = _normalize_columns(raw_df)
    raw_profile = profile_dataset(
        normalized_raw,
        _resolve_target_column(normalized_raw, target_column),
    )

    # Reuse cleaned/engineered data from caller when available to avoid double work
    if pre_cleaned_df is not None:
        cleaned = pre_cleaned_df.copy()
        cleaning_summary = dict(pre_cleaning_summary or {})
        if "resolved_target_column" in cleaning_summary:
            target_column = cleaning_summary["resolved_target_column"]
        else:
            target_column = _resolve_target_column(cleaned, target_column)
            cleaning_summary["resolved_target_column"] = target_column
        if len(cleaned) < 20:
            raise AutoMLError("Dataset terlalu kecil. Minimal 20 baris dengan target valid diperlukan")
    else:
        _progress(f"🔄 Membersihkan data ({len(raw_df)} baris)...")
        cleaned, cleaning_summary = clean_dataset(raw_df, target_column)
        target_column = cleaning_summary["resolved_target_column"]
        if len(cleaned) < 20:
            raise AutoMLError("Dataset terlalu kecil. Minimal 20 baris dengan target valid diperlukan")

    if pre_engineered_df is not None:
        engineered = pre_engineered_df.copy()
        fe_report = pre_fe_report or FeatureEngineeringReport()
    else:
        _progress("⚙️ Feature engineering & selection...")
        engineered, fe_report = engineer_features(cleaned, target_column)

    features = engineered.drop(columns=[target_column])
    if features.empty:
        raise AutoMLError("Dataset tidak memiliki fitur setelah target dihapus")
    target = engineered[target_column]
    inferred_problem_type = infer_problem_type(target, problem_type)
    _progress(f"🔍 Tipe masalah: {inferred_problem_type} | Fitur: {len(features.columns)} kolom | Split train/test...")

    x_train, x_test, y_train, y_test = _split_dataset(
        features, target, inferred_problem_type, test_size, random_state,
    )
    if y_train.nunique(dropna=False) < 2 and inferred_problem_type == CLASSIFICATION:
        raise AutoMLError("Target klasifikasi hanya memiliki satu kelas pada data training")

    preprocessor, numeric_columns, categorical_columns = build_preprocessor(features)
    candidates = build_candidate_models(inferred_problem_type, random_state)
    cv_strategy = build_cv_strategy(inferred_problem_type, y_train, random_state)

    leaderboard, best_name, best_pipeline, best_sort_score = _run_training_loop(
        candidates, preprocessor, x_train, x_test, y_train, y_test,
        inferred_problem_type, cv_strategy,
    )

    # Auto-fallback: if classification failed entirely, retry as regression
    if (best_pipeline is None or best_name is None) and inferred_problem_type == CLASSIFICATION:
        _progress("🔄 Target terdeteksi kontinu — beralih ke regression dan mencoba ulang...")
        inferred_problem_type = REGRESSION
        x_train, x_test, y_train, y_test = _split_dataset(
            features, target, inferred_problem_type, test_size, random_state,
        )
        candidates = build_candidate_models(inferred_problem_type, random_state)
        cv_strategy = build_cv_strategy(inferred_problem_type, y_train, random_state)
        leaderboard, best_name, best_pipeline, best_sort_score = _run_training_loop(
            candidates, preprocessor, x_train, x_test, y_train, y_test,
            inferred_problem_type, cv_strategy,
        )

    if best_pipeline is None or best_name is None:
        raise AutoMLError("Tidak ada model yang berhasil dilatih")

    # --- FIX #1: Hyperparameter tuning n_iter calculation fixed ---
    tuned = False
    param_grid = _get_tuning_param_grid(best_name, inferred_problem_type)
    if param_grid and len(x_train) >= 50:
        _progress(f"🔍 Hyperparameter tuning: {best_pipeline.named_steps['model'].__class__.__name__}...")
        try:
            tuning_pipeline = Pipeline([
                ("preprocessor", clone(preprocessor)),
                ("model", clone(candidates[best_name])),
            ])

            # FIX: was min(12, 1) which always evaluates to 1, capping n_iter too low.
            # Now correctly computes total combinations and caps at 12.
            total_combinations = 1
            for values in param_grid.values():
                total_combinations *= len(values)
            n_iter = min(total_combinations, 12)

            primary_metric, scorer = _primary_metric(inferred_problem_type)
            search = RandomizedSearchCV(
                tuning_pipeline,
                param_distributions=param_grid,
                n_iter=n_iter,
                cv=cv_strategy,
                scoring=scorer,
                random_state=random_state,
                n_jobs=1,
                refit=True,
            )
            search.fit(x_train, y_train)
            tuned_metrics = evaluate_model(search.best_estimator_, inferred_problem_type, x_test, y_test)

            if inferred_problem_type == CLASSIFICATION:
                tuned_score = float(tuned_metrics[primary_metric])
                original_score = best_sort_score
            else:
                tuned_score = -float(tuned_metrics[primary_metric])
                original_score = best_sort_score

            if tuned_score > original_score:
                best_pipeline = search.best_estimator_
                for item in leaderboard:
                    if item["model_key"] == best_name:
                        item["test_metrics"] = tuned_metrics
                        item["tuned"] = True
                        item["best_params"] = {
                            k.replace("model__", ""): v
                            for k, v in search.best_params_.items()
                        }
                tuned = True
        except Exception as exc:
            log.warning("Hyperparameter tuning gagal: %s", exc)

    for item in leaderboard:
        if item["model_key"] == best_name:
            item["is_best"] = True

    best_class = best_pipeline.named_steps["model"].__class__.__name__
    _progress(f"🏆 Model terbaik: {best_class} | Menyimpan model...")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    artifact_stem = _sanitize_model_name(model_name or f"{dataset_path.stem}-{target_column}-{best_name}-{timestamp}")
    models_dir = data_folder / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / f"{artifact_stem}.joblib"
    metadata_path = models_dir / f"{artifact_stem}.metadata.json"

    joblib.dump(best_pipeline, model_path)

    best_metrics = next(item["test_metrics"] for item in leaderboard if item["model_key"] == best_name)
    metadata = {
        "artifact_name": artifact_stem,
        "dataset_name": dataset_name,
        "target_column": target_column,
        "problem_type": inferred_problem_type,
        "best_model_key": best_name,
        "best_model_class": best_pipeline.named_steps["model"].__class__.__name__,
        "model_path": f"models/{model_path.name}",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "rows_total": int(len(engineered)),
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
        "test_size": test_size,
        "random_state": random_state,
        "feature_columns": features.columns.tolist(),
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "target_summary": {
            "dtype": str(target.dtype),
            "unique_values": int(target.nunique(dropna=False)),
        },
        "dataset_profile_before_cleaning": raw_profile,
        "cleaning_summary": cleaning_summary,
        "feature_engineering": fe_report.to_dict(),
        "hyperparameter_tuned": tuned,
        "best_metrics": best_metrics,
        "leaderboard": leaderboard,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return TrainingArtifacts(model_path=model_path, metadata_path=metadata_path, metadata=metadata)


def list_model_metadata(data_folder: Path) -> list[dict[str, Any]]:
    models_dir = data_folder / "models"
    if not models_dir.exists():
        return []

    items = []
    for metadata_path in sorted(models_dir.glob("*.metadata.json"), reverse=True):
        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                items.append(payload)
        except Exception:
            continue
    return items


def get_model_metadata(data_folder: Path, artifact_name: str) -> dict[str, Any]:
    metadata_path = data_folder / "models" / f"{artifact_name}.metadata.json"
    if not metadata_path.exists():
        raise AutoMLError("Metadata model tidak ditemukan")
    try:
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise AutoMLError("Metadata model rusak") from exc
    if not isinstance(payload, dict):
        raise AutoMLError("Metadata model tidak valid")
    return payload


def _preprocess_for_prediction(
    df: pd.DataFrame,
    metadata: dict[str, Any],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    problem_type = metadata.get("problem_type")
    target_column = metadata.get("target_column")
    required_columns = metadata.get("feature_columns") or []
    raw_df = df.copy()

    if problem_type == CLUSTERING:
        cleaned, _ = clean_dataset_unsupervised(raw_df)
        engineered, _ = engineer_features_unsupervised(cleaned)
        features = engineered.copy()
        result_base = raw_df.loc[cleaned.index].copy() if cleaned.index.isin(raw_df.index).all() else cleaned.copy()
    else:
        added_dummy = False
        if not target_column:
            target_column = "__placeholder__"
            raw_df[target_column] = 0
            added_dummy = True
        elif target_column not in raw_df.columns:
            raw_df[target_column] = 0
            added_dummy = True

        cleaned, _ = clean_dataset(raw_df, target_column)
        engineered, _ = engineer_features(cleaned, target_column)
        features = engineered.drop(columns=[target_column], errors="ignore")

        result_base = raw_df.loc[cleaned.index].copy()
        if added_dummy and target_column in result_base.columns:
            result_base = result_base.drop(columns=[target_column], errors="ignore")

    # FIX #2: Use np.nan instead of 0.0 for missing columns so imputer handles them correctly.
    # Previously, filling with 0.0 for categorical columns after OrdinalEncoding would
    # silently map to "first category" instead of being treated as missing.
    for col in required_columns:
        if col not in features.columns:
            features[col] = np.nan
    features = features.reindex(columns=required_columns, fill_value=np.nan)

    return features, result_base


def predict_with_model(
    *,
    data_folder: Path,
    artifact_name: str,
    dataset_name: str,
    output_name: str | None = None,
) -> PredictionArtifacts:
    metadata = get_model_metadata(data_folder, artifact_name)
    model_rel_path = metadata.get("model_path")
    if not model_rel_path:
        raise AutoMLError("Path model tidak tersedia pada metadata")

    model_path = data_folder / Path(model_rel_path)
    if not model_path.exists():
        raise AutoMLError("File model tidak ditemukan")

    dataset_path = data_folder / dataset_name
    if not dataset_path.exists() or not dataset_path.is_file():
        raise AutoMLError("Dataset prediksi tidak ditemukan")

    required_columns = metadata.get("feature_columns") or []
    if not required_columns:
        raise AutoMLError("Metadata model tidak memiliki daftar fitur")

    df = load_dataframe(dataset_path)
    missing_columns = [column for column in required_columns if column not in df.columns]

    if missing_columns:
        problem_type = metadata.get("problem_type")
        if problem_type in (CLASSIFICATION, REGRESSION, CLUSTERING):
            try:
                features, result_base = _preprocess_for_prediction(df, metadata)
                df = result_base
            except Exception as exc:
                raise AutoMLError(
                    "Dataset prediksi tidak cocok dengan schema model dan preprocessing gagal. "
                    f"Kolom yang hilang: {', '.join(missing_columns)}. Error: {exc}"
                ) from exc
        else:
            raise AutoMLError(
                "Dataset prediksi tidak cocok dengan schema model. "
                f"Kolom yang hilang: {', '.join(missing_columns)}"
            )
    else:
        features = df[required_columns].copy()

    extra_columns = [column for column in df.columns if column not in required_columns]
    features = features[required_columns].copy() if all(c in features.columns for c in required_columns) else features

    model = joblib.load(model_path)
    predictions = model.predict(features)
    result_df = df.copy()
    prediction_column = f"prediction_{metadata.get('target_column', 'target')}"
    result_df[prediction_column] = predictions

    confidence_column = None
    if metadata.get("problem_type") == CLASSIFICATION and hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(features)
        if getattr(probabilities, "ndim", 1) == 2:
            result_df["prediction_confidence"] = probabilities.max(axis=1)
            confidence_column = "prediction_confidence"

    predictions_dir = data_folder / "predictions"
    predictions_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    output_stem = _sanitize_model_name(output_name or f"{artifact_name}-{dataset_path.stem}-{timestamp}")
    output_path = predictions_dir / f"{output_stem}.csv"
    result_df.to_csv(output_path, index=False)

    preview_rows = result_df.head(10).fillna("").astype(str).to_dict(orient="records")
    prediction_summary = pd.Series(predictions).astype(str).value_counts().head(10).to_dict()
    payload = {
        "artifact_name": artifact_name,
        "dataset_name": dataset_name,
        "output_path": f"predictions/{output_path.name}",
        "rows_predicted": int(len(result_df)),
        "prediction_column": prediction_column,
        "confidence_column": confidence_column,
        "missing_columns": missing_columns,
        "extra_columns": extra_columns,
        "preview_rows": preview_rows,
        "prediction_summary": prediction_summary,
        "problem_type": metadata.get("problem_type"),
        "target_column": metadata.get("target_column"),
        "model_name": metadata.get("best_model_class"),
    }
    return PredictionArtifacts(output_path=output_path, metadata=payload)