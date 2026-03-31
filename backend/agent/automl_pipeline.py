"""Structured AutoML pipelines: supervised (analysis-first) and clustering."""

import re
from pathlib import Path
from typing import Any

from backend.agent.critic import automl_critic_event, run_critic_agent
from backend.agent.constants import MODEL_BUILD_KEYWORDS
from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import AUTOML_REQUEST_PROMPT
from backend.agent.utils import (
    TrainingResult,
    extract_text,
    format_distribution,
    list_data_contents,
    list_data_files,
    parse_json_from_llm,
    run_structured_code_step,
    run_training_with_progress,
)
from backend.core.automl import (
    AutoMLError,
    CLUSTERING,
    clean_dataset,
    engineer_features,
    infer_problem_type,
    load_dataframe,
    profile_dataset,
    train_automl,
    train_clustering,
)


# ── Common target column names used as hints for auto-detection ───────────────

_COMMON_TARGET_NAMES = {
    "target", "label", "class", "y", "outcome", "result",
    "isFraud", "is_fraud", "fraud", "Fraud",
    "churn", "Churn",
    "survived", "Survived",
    "diagnosis", "Diagnosis",
    "default", "Default",
    "spam", "Spam",
    "sentiment", "Sentiment",
    "price", "Price",
    "salary", "Salary",
    "revenue", "Revenue",
    "sales", "Sales",
}
_COMMON_TARGET_NAMES_LOWER = {name.lower() for name in _COMMON_TARGET_NAMES}


_INTENT_COLUMN_HINTS = {
    "fraud": ["isfraud", "is_fraud", "fraud", "fraudulent"],
    "penipuan": ["isfraud", "is_fraud", "fraud", "fraudulent"],
    "churn": ["churn", "is_churn", "churned"],
    "survived": ["survived", "survival"],
    "spam": ["spam", "is_spam"],
    "default": ["default", "is_default"],
}


def _heuristic_extract_train_request(question: str, data_folder: Path) -> dict[str, str]:
    q = (question or "").strip()
    q_lower = q.lower()

    dataset_name = ""
    available_files = list_data_files(data_folder)
    for name in available_files:
        if name.lower() in q_lower:
            dataset_name = name
            break
    if not dataset_name and len(available_files) == 1:
        dataset_name = available_files[0]

    target_column = ""
    target_match = re.search(r"target\s*[:=]?\s*([A-Za-z0-9_ ]+)", q, re.IGNORECASE)
    if target_match:
        target_column = target_match.group(1).strip().split()[0]

    if not target_column and dataset_name:
        try:
            dataset_path = data_folder / dataset_name
            if dataset_path.exists():
                df = load_dataframe(dataset_path)
                col_lower_map = {str(c).strip().lower(): str(c).strip() for c in df.columns}
                for intent_kw, hint_cols in _INTENT_COLUMN_HINTS.items():
                    if intent_kw in q_lower:
                        for hint in hint_cols:
                            if hint in col_lower_map:
                                target_column = col_lower_map[hint]
                                break
                    if target_column:
                        break
        except Exception:
            pass

    problem_type = "auto"
    if any(w in q_lower for w in ["clustering", "cluster", "segmentasi", "segmentation", "kmeans", "k-means", "unsupervised", "pengelompokan"]):
        problem_type = "clustering"
        target_column = ""
    elif any(w in q_lower for w in ["harga", "price", "sales", "nilai"]):
        problem_type = "regression"
    elif any(w in q_lower for w in ["klasifikasi", "churn", "fraud", "survived", "kelas", "label", "deteksi"]):
        problem_type = "classification"

    has_model_keyword = any(keyword in q_lower for keyword in MODEL_BUILD_KEYWORDS)

    return {
        "task": "train" if (target_column or has_model_keyword) else "other",
        "dataset_name": dataset_name,
        "target_column": target_column,
        "problem_type": problem_type,
    }


def _extract_automl_request(question: str, data_folder: Path, model_name: str) -> dict[str, str]:
    heuristic = _heuristic_extract_train_request(question, data_folder)
    file_list = list_data_contents(data_folder)
    try:
        llm = build_llm(model=model_name, temperature=0, max_output_tokens=256)
        response = invoke_with_retry(llm, [
            ("system", AUTOML_REQUEST_PROMPT + f"\n\nFile tersedia:\n{file_list}"),
            ("human", question),
        ])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        parsed = parse_json_from_llm(raw)
        if parsed:
            raw_ds = str(parsed.get("dataset_name", heuristic["dataset_name"]) or heuristic["dataset_name"])
            return {
                "task": str(parsed.get("task", heuristic["task"])),
                "dataset_name": Path(raw_ds).name if raw_ds else raw_ds,
                "target_column": str(parsed.get("target_column", heuristic["target_column"]) or heuristic["target_column"]),
                "problem_type": str(parsed.get("problem_type", heuristic["problem_type"]) or heuristic["problem_type"]),
            }
    except Exception:
        pass
    return heuristic


def _auto_detect_target(data_folder: Path, dataset_name: str, question: str, model_name: str) -> str:
    """Try to automatically detect the target column from the dataset."""
    from backend.agent.utils import load_schema_payload

    cache_key = (str(data_folder), dataset_name)
    _columns_cache: dict[tuple[str, str], list[str]]
    if not hasattr(_auto_detect_target, "_columns_cache"):
        setattr(_auto_detect_target, "_columns_cache", {})
    _columns_cache = getattr(_auto_detect_target, "_columns_cache")

    dataset_path = data_folder / dataset_name
    if not dataset_path.exists():
        return ""

    # Reuse cached columns when available to avoid repeated I/O on schema/file
    columns: list[str] = _columns_cache.get(cache_key, [])
    if not columns:
        schema = load_schema_payload(data_folder)
        if schema and schema.get("datasets"):
            for ds in schema["datasets"]:
                if ds.get("file") == dataset_name:
                    columns = ds.get("columns", [])
                    break

    if not columns:
        try:
            df = load_dataframe(dataset_path)
            columns = [str(c).strip() for c in df.columns.tolist()]
        except Exception:
            return ""

    if columns:
        _columns_cache[cache_key] = columns

    if not columns:
        return ""

    for col in columns:
        if col in _COMMON_TARGET_NAMES or col.lower() in _COMMON_TARGET_NAMES_LOWER:
            return col

    try:
        target_detect_prompt = (
            "Kamu diberikan daftar kolom dataset dan pertanyaan pengguna.\n"
            "Tugasmu: tentukan kolom mana yang TEPAT untuk dijadikan target/label model machine learning "
            "SESUAI DENGAN KONTEKS PERTANYAAN pengguna.\n\n"
            f"Kolom dataset: {', '.join(columns)}\n\n"
            f"Pertanyaan pengguna: {question}\n\n"
            "ATURAN PENTING:\n"
            "- Jika pengguna minta deteksi fraud/penipuan, cari kolom yang berisi label fraud (misal IsFraud, Fraud, is_fraud). "
            "Jika TIDAK ADA kolom fraud, jawab UNKNOWN.\n"
            "- Jika pengguna minta deteksi churn, cari kolom churn. Jika tidak ada, jawab UNKNOWN.\n"
            "- Jangan asal pilih kolom numerik yang tidak relevan dengan pertanyaan pengguna.\n"
            "- Jawab HANYA dengan nama kolom yang tepat (case-sensitive), atau UNKNOWN jika tidak ada kolom yang cocok.\n"
        )
        llm = build_llm(model=model_name, temperature=0, max_output_tokens=64)
        response = invoke_with_retry(llm, [("human", target_detect_prompt)])
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        candidate = raw.strip().strip('"').strip("'").strip("`")

        if candidate and candidate != "UNKNOWN" and candidate in columns:
            return candidate
        lower_map = {c.lower(): c for c in columns}
        if candidate.lower() in lower_map:
            return lower_map[candidate.lower()]
    except Exception:
        pass

    return ""


def _build_hybrid_analysis_code(dataset_name: str, target_column: str) -> str:
    return f"""
import uuid as _uuid
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

dataset_path = Path('/app/data/{dataset_name}')
target_column = {target_column!r}

suffix = dataset_path.suffix.lower()
if suffix == '.csv':
    df = pd.read_csv(dataset_path)
elif suffix in ('.xlsx', '.xls'):
    df = pd.read_excel(dataset_path)
elif suffix == '.json':
    df = pd.read_json(dataset_path)
elif suffix == '.parquet':
    df = pd.read_parquet(dataset_path)
else:
    df = pd.read_pickle(dataset_path)

df.columns = [str(column).strip() for column in df.columns]
resolved_target = target_column
if resolved_target not in df.columns:
    lowered = {{str(column).strip().lower(): str(column).strip() for column in df.columns}}
    resolved_target = lowered.get(resolved_target.lower(), resolved_target)

preview = df.head(5).to_string(index=False)
missing = df.isna().sum()
missing = missing[missing > 0].sort_values(ascending=False)
duplicate_rows = int(df.duplicated().sum())
numeric_df = df.select_dtypes(include=['number'])

print('Analisis awal dataset:')
print(f'- jumlah baris: {{len(df)}}')
print(f'- jumlah kolom: {{len(df.columns)}}')
print(f'- target: {{resolved_target}}')
print(f'- duplikat: {{duplicate_rows}}')
print('- 5 baris pertama:')
print(preview)
print('- missing value per kolom:')
print(missing.to_string() if not missing.empty else 'Tidak ada missing value')

if resolved_target in numeric_df.columns and numeric_df.shape[1] > 1:
    corr = numeric_df.corr(numeric_only=True)[resolved_target].drop(labels=[resolved_target], errors='ignore').sort_values(key=lambda s: s.abs(), ascending=False)
    print('- korelasi numerik terhadap target:')
    print(corr.head(10).to_string() if not corr.empty else 'Tidak ada korelasi numerik yang bisa dihitung')

    if not corr.empty:
        plt.figure(figsize=(8, 4))
        corr.head(8).sort_values().plot(kind='barh', color='#38bdf8')
        plt.title(f'Korelasi terhadap {{resolved_target}}')
        plt.tight_layout()
        chart_path = f"/app/data/_chart_{{_uuid.uuid4().hex}}.png"
        plt.savefig(chart_path, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        print(f'[[CHART_FILE]]{{chart_path}}[[/CHART_FILE]]')

if resolved_target in df.columns:
    print('- distribusi target teratas:')
    print(df[resolved_target].astype(str).value_counts().head(10).to_string())

outlier_summary = []
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
            outlier_summary.append(f'{{column}}={{outlier_count}}')

    print('- ringkasan outlier numerik:')
    print(', '.join(outlier_summary) if outlier_summary else 'Tidak ada outlier numerik yang menonjol')
""".strip()


def _format_clustering_leaderboard_entry(idx: int, item: dict) -> str:
    suffix = " (dipilih sebagai model terbaik)" if item.get("is_best") else ""
    return (
        f"{idx + 1}. {item.get('model_class')} ({item.get('model_key')}) "
        f"- silhouette={item.get('metrics', {}).get('silhouette')}{suffix}"
    )


def _format_supervised_leaderboard_entry(idx: int, item: dict) -> str:
    tuned_suffix = " (tuned)" if item.get("tuned") else ""
    return (
        f"{idx + 1}. {item.get('model_class')} ({item.get('model_key')}) "
        f"- CV {item.get('cv_score')}{tuned_suffix}"
    )


# ── Clustering pipeline ──────────────────────────────────────────────────────

def run_clustering_automl(data_folder: Path, dataset_name: str, model_name: str):
    """Structured clustering pipeline — no target column needed."""
    automl_started = False
    yield {"type": "agent_label", "content": "Planner"}
    yield {
        "type": "plan",
        "content": [
            {"task": f"Profiling dataset {dataset_name}", "agent": "execution", "phase": 0},
            {"task": "Cleaning & feature engineering (unsupervised)", "agent": "execution", "phase": 1},
            {"task": "Penentuan jumlah cluster optimal", "agent": "execution", "phase": 2},
            {"task": "Training clustering AutoML", "agent": "execution", "phase": 3},
            {"task": "Ringkas profil cluster", "agent": "execution", "phase": 4},
        ],
    }
    yield {"type": "agent_label", "content": "Execution"}

    try:
        dataset_path = data_folder / dataset_name
        raw_df = load_dataframe(dataset_path)
        normalized_df = raw_df.copy()
        normalized_df.columns = [str(c).strip() for c in normalized_df.columns]
        n_rows = len(normalized_df)
        n_cols = len(normalized_df.columns)
        n_dup = int(normalized_df.duplicated().sum())
        n_missing = int((normalized_df.isna().sum() > 0).sum())
        n_numeric = int(normalized_df.select_dtypes(include=["number"]).shape[1])

        yield {"type": "task_start", "content": f"Analisis awal dataset {dataset_name}", "index": 0, "total": 5, "agent": "execution"}
        yield {
            "type": "text",
            "content": (
                f"Ringkasan dataset **{dataset_name}** untuk clustering:\n"
                f"- Baris: {n_rows}\n"
                f"- Kolom: {n_cols}\n"
                f"- Duplikat: {n_dup}\n"
                f"- Kolom dengan missing value: {n_missing}\n"
                f"- Kolom numerik: {n_numeric}"
            ),
        }

        yield {"type": "task_start", "content": "Cleaning & feature engineering (unsupervised)", "index": 1, "total": 5, "agent": "execution"}
        yield {
            "type": "text",
            "content": "Membersihkan dataset dan melakukan feature engineering tanpa kolom target untuk menghindari data leakage.",
        }

        yield {"type": "task_start", "content": "Penentuan jumlah cluster optimal (elbow + silhouette)", "index": 2, "total": 5, "agent": "execution"}
        yield {
            "type": "text",
            "content": "Sistem akan mencari jumlah cluster optimal menggunakan metode elbow + silhouette score (k=2..10) secara otomatis.",
        }

        yield {"type": "task_start", "content": "Training clustering AutoML", "index": 3, "total": 5, "agent": "execution"}
        yield {
            "type": "text",
            "content": "Menjalankan KMeans dan AgglomerativeClustering, memilih model terbaik berdasarkan silhouette score tertinggi.",
        }
        automl_started = True
        yield {"type": "automl_train_start", "dataset": dataset_name, "target": "", "problem_type": CLUSTERING}

        artifacts = None
        for event in run_training_with_progress(
            lambda progress_callback: train_clustering(
                data_folder=data_folder,
                dataset_name=dataset_name,
                progress_callback=progress_callback,
            )
        ):
            if isinstance(event, TrainingResult):
                artifacts = event.value
            else:
                yield event

        metadata = artifacts.metadata
        n_clusters = metadata.get("n_clusters", "?")
        best_metrics = metadata.get("best_metrics", {})
        cluster_counts = metadata.get("cluster_counts", {})
        cluster_profile = metadata.get("cluster_profile", {})
        leaderboard = metadata.get("leaderboard", [])

        metric_lines = "\n".join(
            f"- {k}: {v}" for k, v in best_metrics.items() if v is not None
        ) or "- Tidak ada metrik"

        leaderboard_lines = "\n".join(
            _format_clustering_leaderboard_entry(idx, item)
            for idx, item in enumerate(leaderboard)
        ) or "1. Tidak ada leaderboard"

        cluster_size_lines = "\n".join(
            f"- Cluster {k}: {v} data points" for k, v in sorted(cluster_counts.items())
        )

        yield {
            "type": "automl_train_done",
            "artifact_name": metadata.get("artifact_name"),
            "dataset_name": metadata.get("dataset_name"),
            "target_column": "",
            "problem_type": CLUSTERING,
            "best_model_class": metadata.get("best_model_class"),
            "best_model_key": metadata.get("best_model_key"),
            "best_metrics": best_metrics,
            "leaderboard": leaderboard,
            "model_path": metadata.get("model_path"),
            "n_clusters": n_clusters,
            "cluster_counts": cluster_counts,
            "cluster_profile": cluster_profile,
            "clustered_output": metadata.get("clustered_output"),
            "hyperparameter_tuned": False,
        }

        yield {
            "type": "text",
            "content": (
                f"Clustering selesai. Model terbaik: **{metadata.get('best_model_class')}** dengan **{n_clusters} cluster**.\n\n"
                "Metrik clustering:\n"
                f"{metric_lines}\n\n"
                "Distribusi cluster:\n"
                f"{cluster_size_lines}\n\n"
                "Peringkat kandidat model:\n"
                f"{leaderboard_lines}\n\n"
                f"Artifact model: **{metadata.get('model_path')}** | "
                f"Dataset berlabel: **{metadata.get('clustered_output')}**"
            ),
        }

        yield {"type": "task_start", "content": "Ringkas profil cluster", "index": 4, "total": 5, "agent": "execution"}

        profile_lines = []
        for c_id, c_data in sorted(cluster_profile.items()):
            size = c_data.pop("size", "?")
            top_feats = list(c_data.items())[:5]
            feat_str = ", ".join(f"{k}={v}" for k, v in top_feats)
            profile_lines.append(f"- **Cluster {c_id}** ({size} data): {feat_str}")
            c_data["size"] = size

        yield {
            "type": "text",
            "content": (
                f"Dataset **{dataset_name}** berhasil dikelompokkan menjadi **{n_clusters} cluster** "
                f"menggunakan **{metadata.get('best_model_class')}** (silhouette={best_metrics.get('silhouette', '?')}).\n\n"
                "Profil tiap cluster (rata-rata fitur numerik):\n"
                + ("\n".join(profile_lines) if profile_lines else "- (tidak ada profil tersedia)")
                + f"\n\nDataset dengan label cluster telah disimpan di **{metadata.get('clustered_output')}** untuk analisis lanjutan."
            ),
        }

        from backend.core.config import MODEL_CRITIC as _critic_model_cl
        cluster_summary = (
            f"Dataset: {dataset_name}, Problem: clustering\n"
            f"Model terbaik: {metadata.get('best_model_class')}, Clusters: {n_clusters}\n"
            f"Metrik: {', '.join(f'{k}={v}' for k, v in best_metrics.items())}"
        )
        critic_emitted_cl = False
        for ev in run_critic_agent(f"clustering {dataset_name}", cluster_summary, data_folder, _critic_model_cl):
            if ev["type"] == "_critic_result":
                continue
            if ev["type"] == "critic":
                critic_emitted_cl = True
            yield ev
        if not critic_emitted_cl:
            yield {"type": "agent_label", "content": "Critic"}
            yield automl_critic_event(CLUSTERING, best_metrics, metadata.get("best_model_class", ""))

    except AutoMLError as exc:
        if automl_started:
            yield {"type": "automl_train_done", "error": True, "message": str(exc)}
        yield {"type": "error", "content": str(exc)}
    except Exception as exc:
        if automl_started:
            yield {"type": "automl_train_done", "error": True, "message": str(exc)}
        yield {"type": "error", "content": f"Clustering AutoML gagal: {str(exc)}"}

    yield {"type": "done"}


# ── Supervised (analysis-first) pipeline ─────────────────────────────────────

def run_analysis_first_automl(data_folder: Path, question: str, model_name: str):
    request = _extract_automl_request(question, data_folder, model_name)
    automl_started = False
    if request.get("task") != "train":
        yield {
            "type": "text",
            "content": "Saya perlu informasi lebih jelas tentang model yang ingin dibuat. Contoh: buat model untuk target Price pada file housing.csv.",
        }
        yield {"type": "done"}
        return

    dataset_name = request.get("dataset_name") or ""
    target_column = request.get("target_column") or ""
    problem_type = request.get("problem_type") or "auto"

    available_files = list_data_files(data_folder)
    if not dataset_name:
        if len(available_files) == 1:
            dataset_name = available_files[0]
        else:
            yield {
                "type": "text",
                "content": "Saya belum bisa menentukan dataset yang dipakai. Sebutkan nama file dataset bersama target yang ingin diprediksi.",
            }
            yield {"type": "done"}
            return

    if problem_type == CLUSTERING:
        yield from run_clustering_automl(data_folder, dataset_name, model_name)
        return

    if not target_column:
        target_column = _auto_detect_target(data_folder, dataset_name, question, model_name)
        if not target_column:
            q_lower = (question or "").lower()
            intent_keywords = {
                "fraud": "fraud/penipuan",
                "penipuan": "fraud/penipuan",
                "churn": "churn",
                "anomali": "anomali",
                "anomaly": "anomali",
            }
            detected_intent = ""
            for kw, label in intent_keywords.items():
                if kw in q_lower:
                    detected_intent = label
                    break

            if detected_intent:
                yield {
                    "type": "text",
                    "content": (
                        f"Dataset **{dataset_name}** tidak memiliki kolom label **{detected_intent}** yang bisa dijadikan target klasifikasi.\n\n"
                        "Opsi yang tersedia:\n"
                        f"1. **Deteksi anomali (unsupervised)** — gunakan clustering/isolation forest tanpa label. "
                        f"Coba ketik: *\"deteksi anomali pada {dataset_name} dengan clustering\"*\n"
                        "2. **Tentukan kolom target secara manual** — jika ada kolom yang merepresentasikan label, sebutkan secara eksplisit. "
                        f"Contoh: *\"buat model klasifikasi untuk target NamaKolom pada {dataset_name}\"*\n"
                        "3. **Buat label sendiri** — jika Anda punya aturan bisnis untuk menentukan fraud "
                        "(misal: transaksi > threshold tertentu), saya bisa bantu membuat kolom label terlebih dahulu.\n"
                    ),
                }
            else:
                yield {
                    "type": "text",
                    "content": (
                        "Saya tidak bisa menentukan kolom target secara otomatis. "
                        "Sebutkan kolom target yang ingin diprediksi. "
                        f"Contoh: *\"buat model untuk target NamaKolom pada {dataset_name}\"*"
                    ),
                }
            yield {"type": "done"}
            return

    yield {"type": "agent_label", "content": "Planner"}
    yield {
        "type": "plan",
        "content": [
            {"task": f"Profiling dataset {dataset_name}", "agent": "execution", "phase": 0},
            {"task": f"Cleaning dataset untuk target {target_column}", "agent": "execution", "phase": 1},
            {"task": "Feature engineering & selection", "agent": "execution", "phase": 2},
            {"task": f"Training AutoML untuk target {target_column}", "agent": "execution", "phase": 3},
            {"task": "Ringkas temuan dan performa model", "agent": "execution", "phase": 4},
        ],
    }

    yield {"type": "agent_label", "content": "Execution"}

    try:
        dataset_path = data_folder / dataset_name
        raw_df = load_dataframe(dataset_path)
        normalized_df = raw_df.copy()
        normalized_df.columns = [str(column).strip() for column in normalized_df.columns]
        resolved_target = target_column.strip()
        if resolved_target not in normalized_df.columns:
            lowered = {str(column).strip().lower(): str(column).strip() for column in normalized_df.columns}
            resolved_target = lowered.get(resolved_target.lower(), resolved_target)
        profile = profile_dataset(normalized_df, resolved_target)

        yield {"type": "task_start", "content": f"Analisis awal dataset {dataset_name}", "index": 0, "total": 5, "agent": "execution"}
        yield {
            "type": "text",
            "content": "Saya mulai dengan menulis dan menjalankan kode Python untuk profiling dataset, melihat missing value, preview data, distribusi target, dan korelasi numerik penting sebelum cleaning dan training dimulai.",
        }
        yield from run_structured_code_step(data_folder, _build_hybrid_analysis_code(dataset_name, resolved_target))
        yield {
            "type": "text",
            "content": (
                f"Ringkasan analisis awal dataset **{dataset_name}**:\n"
                f"- jumlah baris: {profile['rows']}\n"
                f"- jumlah kolom: {profile['columns']}\n"
                f"- duplikat: {profile['duplicate_rows']}\n"
                f"- missing value per kolom yang terdeteksi: {len(profile['missing_by_column'])} kolom\n"
                f"- target: **{profile['target_column']}** dengan {profile['target_unique_values']} nilai unik\n"
                f"- kolom numerik: {len(profile.get('numeric_quality', {}).get('numeric_columns', []))}\n"
                f"- kolom dengan outlier terdeteksi: {len(profile.get('numeric_quality', {}).get('outlier_columns', {}))}\n"
                "- distribusi target teratas:\n"
                f"{format_distribution(profile['target_distribution_top'])}"
            ),
        }

        cleaned_df, cleaning_summary = clean_dataset(raw_df, target_column)
        resolved_target = cleaning_summary["resolved_target_column"]
        inferred_problem_type = infer_problem_type(cleaned_df[resolved_target], problem_type)

        yield {"type": "task_start", "content": "Cleaning dan validasi dataset", "index": 1, "total": 5, "agent": "execution"}
        high_missing_dropped = cleaning_summary.get('high_missing_columns_dropped', [])
        yield {
            "type": "text",
            "content": (
                "Pembersihan dataset selesai dilakukan sebelum training:\n"
                f"- duplikat dihapus: {cleaning_summary['duplicate_rows_removed']}\n"
                f"- baris target kosong dihapus: {cleaning_summary['target_missing_rows_removed']}\n"
                f"- kolom semua kosong dihapus: {len(cleaning_summary['all_missing_columns_removed'])}\n"
                f"- kolom missing tinggi (>70%) dihapus: {len(high_missing_dropped)}{(' (' + ', '.join(high_missing_dropped[:5]) + ')') if high_missing_dropped else ''}\n"
                f"- kolom konstan dihapus: {len(cleaning_summary['constant_columns_removed'])}\n"
                f"- dataset siap proses: {cleaning_summary['rows_after_cleaning']} baris, {cleaning_summary['columns_after_cleaning']} kolom\n"
                f"- tipe masalah terdeteksi: **{inferred_problem_type}**\n"
                "- catatan: feature engineering yang memakai target tidak digunakan untuk menghindari data leakage"
            ),
        }

        engineered_df, fe_report = engineer_features(cleaned_df, resolved_target)
        yield {"type": "task_start", "content": "Feature engineering & selection", "index": 2, "total": 5, "agent": "execution"}
        fe_lines = []
        if fe_report.datetime_features_created:
            fe_lines.append(f"- fitur datetime diekstrak: {', '.join(fe_report.datetime_features_created[:8])}")
        if fe_report.id_columns_dropped:
            fe_lines.append(f"- kolom ID-like di-drop: {', '.join(fe_report.id_columns_dropped)}")
        if fe_report.high_cardinality_columns:
            fe_lines.append(f"- kolom high-cardinality di-encode: {', '.join(fe_report.high_cardinality_columns.keys())}")
        if fe_report.outlier_clipped_columns:
            fe_lines.append(f"- outlier di-clip (IQR): {', '.join(fe_report.outlier_clipped_columns[:8])}")
        if fe_report.skew_transformed_columns:
            fe_lines.append(f"- skewness di-transform (log1p): {', '.join(fe_report.skew_transformed_columns[:8])}")
        if fe_report.low_variance_columns_dropped:
            fe_lines.append(f"- kolom low-variance di-drop: {', '.join(fe_report.low_variance_columns_dropped)}")
        if fe_report.high_missing_columns_dropped:
            fe_lines.append(f"- kolom missing tinggi di-drop: {', '.join(fe_report.high_missing_columns_dropped)}")
        if not fe_lines:
            fe_lines.append("- tidak ada transformasi tambahan yang diperlukan")
        fe_lines.append(f"- fitur siap training: {len(engineered_df.columns) - 1} kolom")
        yield {
            "type": "text",
            "content": "Feature engineering otomatis selesai:\n" + "\n".join(fe_lines),
        }

        yield {"type": "task_start", "content": f"Training AutoML untuk target {resolved_target}", "index": 3, "total": 5, "agent": "execution"}
        yield {
            "type": "text",
            "content": "Setelah analisis, cleaning, dan feature engineering selesai, training final saya jalankan lewat AutoML terstruktur dengan 5 model candidates (termasuk XGBoost & LightGBM) dan hyperparameter tuning otomatis.",
        }
        automl_started = True
        yield {"type": "automl_train_start", "dataset": dataset_name, "target": resolved_target, "problem_type": inferred_problem_type}

        artifacts = None
        for event in run_training_with_progress(
            lambda progress_callback: train_automl(
                data_folder=data_folder,
                dataset_name=dataset_name,
                target_column=resolved_target,
                problem_type=inferred_problem_type,
                model_name=None,
                test_size=0.2,
                random_state=42,
                progress_callback=progress_callback,
                pre_cleaned_df=cleaned_df,
                pre_cleaning_summary=cleaning_summary,
                pre_engineered_df=engineered_df,
                pre_fe_report=fe_report,
            )
        ):
            if isinstance(event, TrainingResult):
                artifacts = event.value
            else:
                yield event

        metadata = artifacts.metadata
        best_metrics = metadata.get("best_metrics", {})
        metric_lines = "\n".join(f"- {key}: {value}" for key, value in best_metrics.items()) or "- Tidak ada metrik"
        leaderboard = metadata.get("leaderboard", [])[:5]

        leaderboard_lines = "\n".join(
            _format_supervised_leaderboard_entry(idx, item)
            for idx, item in enumerate(leaderboard)
        ) or "1. Tidak ada leaderboard"
        tuned_info = ""
        if metadata.get("hyperparameter_tuned"):
            best_entry = next((x for x in leaderboard if x.get("is_best")), None)
            if best_entry and best_entry.get("best_params"):
                params_str = ", ".join(f"{k}={v}" for k, v in best_entry["best_params"].items())
                tuned_info = f"\n\nHyperparameter tuning berhasil meningkatkan performa. Parameter terbaik: {params_str}"
        yield {
            "type": "automl_train_done",
            "artifact_name": metadata.get("artifact_name"),
            "dataset_name": metadata.get("dataset_name"),
            "target_column": metadata.get("target_column"),
            "problem_type": metadata.get("problem_type"),
            "best_model_class": metadata.get("best_model_class"),
            "best_model_key": metadata.get("best_model_key"),
            "best_metrics": metadata.get("best_metrics"),
            "leaderboard": leaderboard,
            "model_path": metadata.get("model_path"),
            "hyperparameter_tuned": metadata.get("hyperparameter_tuned", False),
        }
        yield {
            "type": "text",
            "content": (
                f"Training AutoML selesai. Model terbaik adalah **{metadata.get('best_model_class')}** ({metadata.get('best_model_key')}).\n\n"
                "Metrik model terbaik:\n"
                f"{metric_lines}\n\n"
                "Peringkat kandidat model:\n"
                f"{leaderboard_lines}"
                f"{tuned_info}\n\n"
                f"Artifact model tersimpan di **{metadata.get('model_path')}**."
            ),
        }

        yield {"type": "task_start", "content": "Ringkas temuan analisis dan performa model", "index": 4, "total": 5, "agent": "execution"}

        fe_meta = metadata.get("feature_engineering", {})
        fe_insight_parts = []
        if fe_meta.get("datetime_features_created"):
            fe_insight_parts.append(f"ekstraksi {len(fe_meta['datetime_features_created'])} fitur datetime")
        if fe_meta.get("id_columns_dropped"):
            fe_insight_parts.append(f"penghapusan {len(fe_meta['id_columns_dropped'])} kolom ID-like")
        if fe_meta.get("high_cardinality_columns"):
            fe_insight_parts.append(f"frequency encoding {len(fe_meta['high_cardinality_columns'])} kolom high-cardinality")
        if fe_meta.get("outlier_clipped_columns"):
            fe_insight_parts.append(f"clipping outlier pada {len(fe_meta['outlier_clipped_columns'])} kolom")
        if fe_meta.get("skew_transformed_columns"):
            fe_insight_parts.append(f"log1p transform pada {len(fe_meta['skew_transformed_columns'])} kolom skewed")
        fe_insight_str = (
            f" Feature engineering yang dilakukan mencakup {', '.join(fe_insight_parts)}."
            if fe_insight_parts else ""
        )
        yield {
            "type": "text",
            "content": (
                f"Sebelum model dibangun, dataset dianalisis dan dibersihkan terlebih dahulu. Profil awal menunjukkan dataset berisi **{profile['rows']}** baris dan **{profile['columns']}** kolom dengan target **{resolved_target}**.{fe_insight_str} "
                f"Setelah cleaning dan feature engineering, sistem mendeteksi masalah **{inferred_problem_type}** dan mengevaluasi {len(leaderboard)} model candidates (termasuk XGBoost & LightGBM jika tersedia). "
                f"Model terbaik adalah **{metadata.get('best_model_class')}** dengan artifact **{metadata.get('artifact_name')}**. "
                f"Performa model terbaik: {', '.join(f'{key}={value}' for key, value in metadata.get('best_metrics', {}).items())}. "
                + ("Hyperparameter tuning berhasil meningkatkan performa model." if metadata.get('hyperparameter_tuned') else "")
                + " Secara metodologis, hasil ini lebih kuat karena pipeline mencakup feature engineering otomatis (datetime extraction, outlier clipping, skewness transform, high-cardinality encoding), feature selection, dan hyperparameter tuning yang menghindari data leakage dan menjaga reproduktibilitas."
            ),
        }

        from backend.core.config import MODEL_CRITIC as _critic_model
        automl_summary = (
            f"Dataset: {dataset_name}, Target: {resolved_target}, Problem: {inferred_problem_type}\n"
            f"Model terbaik: {metadata.get('best_model_class')}\n"
            f"Metrik: {', '.join(f'{k}={v}' for k, v in best_metrics.items())}"
        )
        critic_emitted = False
        for ev in run_critic_agent(question, automl_summary, data_folder, _critic_model):
            if ev["type"] == "_critic_result":
                continue
            if ev["type"] == "critic":
                critic_emitted = True
            yield ev
        if not critic_emitted:
            yield {"type": "agent_label", "content": "Critic"}
            yield automl_critic_event(
                inferred_problem_type, best_metrics, metadata.get("best_model_class", ""),
            )

    except AutoMLError as exc:
        if automl_started:
            yield {"type": "automl_train_done", "error": True, "message": str(exc)}
        yield {"type": "error", "content": str(exc)}
    except Exception as exc:
        if automl_started:
            yield {"type": "automl_train_done", "error": True, "message": str(exc)}
        yield {"type": "error", "content": f"AutoML terstruktur gagal: {str(exc)}"}

    yield {"type": "done"}
