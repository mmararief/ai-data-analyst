"""Agent creation with tool definitions (python_repl, automl_train/predict/list, web_search, file_export)."""

import json
import logging
import queue
import re
from pathlib import Path

from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from backend.agent.llm import build_llm
from backend.agent.prompts import build_system_prompt
from backend.core.automl import (
    AutoMLError,
    CLUSTERING,
    list_model_metadata,
    predict_with_model,
    train_automl,
    train_clustering,
)
from sandbox import run_ai_code_securely, stream_ai_code_securely

logger = logging.getLogger(__name__)

# Try importing Tavily for web search
try:
    from tavily import TavilyClient
except ImportError:
    TavilyClient = None


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
                # Best-effort only; jangan biarkan error queue mematikan tool
                pass

    @tool
    def python_repl_tool(code: str) -> str:
        """Eksekusi kode Python/Pandas di sandbox Docker yang terisolasi."""
        if progress_queue is not None:
            accumulated = []
            for line in stream_ai_code_securely(code, data_folder_path=folder_str):
                accumulated.append(line)
                if line.rstrip():
                    _push(line.rstrip())
            return "".join(accumulated)
        return run_ai_code_securely(code, data_folder_path=folder_str)

    # ── Web Search Tool ────────────────────────────────────────────────
    @tool
    def web_search_tool(query: str) -> str:
        """Cari informasi terbaru di internet. Gunakan untuk pertanyaan konsep, teori, best practice, benchmark, referensi paper, atau solusi spesifik yang membutuhkan sumber eksternal.
        JANGAN gunakan untuk analisis data lokal — gunakan python_repl_tool untuk itu."""
        from backend.core.config import TAVILY_API_KEY

        if not TAVILY_API_KEY or TavilyClient is None:
            return json.dumps({
                "type": "web_search",
                "error": "Web search tidak tersedia. TAVILY_API_KEY belum dikonfigurasi.",
            }, ensure_ascii=False)

        _push(f"🔍 Mencari: {query}")
        try:
            client = TavilyClient(api_key=TAVILY_API_KEY)
            results = client.search(
                query=query,
                search_depth="basic",
                max_results=5,
                include_answer=True,
            )
            sources = []
            for r in results.get("results", []):
                sources.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", "")[:500],
                })

            return json.dumps({
                "type": "web_search",
                "query": query,
                "answer": results.get("answer", ""),
                "sources": sources,
            }, ensure_ascii=False)
        except Exception as exc:
            logger.warning("Web search failed: %s", exc)
            return json.dumps({
                "type": "web_search",
                "error": f"Pencarian gagal: {type(exc).__name__}: {str(exc)}",
            }, ensure_ascii=False)

    # ── File Export Tool ───────────────────────────────────────────────
    @tool
    def file_export_tool(content: str, filename: str, format: str = "md") -> str:
        """Export konten ke file dalam berbagai format. Format yang tersedia: ipynb, csv, md, html, txt.
        - ipynb: content berisi markdown dan code blocks yang akan dikonversi ke Jupyter notebook
        - csv, md, html, txt: content langsung ditulis ke file
        File hasil export tersedia di sidebar file manager user."""

        fmt = format.lower().strip().lstrip(".")
        fname = Path(filename).stem  # ambil nama tanpa extension

        if fmt == "ipynb":
            # Parse content: split markdown dan code blocks → notebook cells
            cells = []
            code_block_re = re.compile(r"```(?:python)?\n(.*?)```", re.DOTALL)
            parts = code_block_re.split(content)
            for i, part in enumerate(parts):
                text = part.strip()
                if not text:
                    continue
                if i % 2 == 1:  # code block (captured group)
                    cells.append({
                        "cell_type": "code",
                        "execution_count": None,
                        "metadata": {},
                        "outputs": [],
                        "source": [ln + "\n" for ln in text.split("\n")],
                    })
                else:  # markdown
                    cells.append({
                        "cell_type": "markdown",
                        "metadata": {},
                        "source": [ln + "\n" for ln in text.split("\n")],
                    })

            notebook = {
                "nbformat": 4,
                "nbformat_minor": 5,
                "metadata": {
                    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                    "language_info": {"name": "python", "version": "3.10.0"},
                },
                "cells": cells or [{"cell_type": "markdown", "metadata": {}, "source": [content]}],
            }
            out_path = data_folder / f"{fname}.ipynb"
            out_path.write_text(json.dumps(notebook, ensure_ascii=False, indent=2), encoding="utf-8")

        elif fmt in ("csv", "md", "html", "txt"):
            out_path = data_folder / f"{fname}.{fmt}"
            out_path.write_text(content, encoding="utf-8")

        else:
            return json.dumps({
                "type": "file_export",
                "error": f"Format '{fmt}' tidak didukung. Gunakan: ipynb, csv, md, html, txt",
            }, ensure_ascii=False)

        _push(f"📄 File diekspor: {out_path.name}")
        return json.dumps({
            "type": "file_export",
            "filename": out_path.name,
            "format": fmt,
            "size_bytes": out_path.stat().st_size,
        }, ensure_ascii=False)

    @tool
    def automl_train_tool(
        dataset_name: str,
        target_column: str,
        problem_type: str = "auto",
        model_name: str = "",
    ) -> str:
        """Analisis dataset, lakukan cleaning dasar, lalu latih model machine learning otomatis.
        Untuk supervised learning (classification/regression): isi target_column.
        Untuk unsupervised learning (clustering): isi problem_type='clustering', target_column boleh kosong.
        Gunakan saat user meminta pembuatan model."""

        _push("🚀 Memulai AutoML pipeline...")
        dataset_name = Path(dataset_name).name if dataset_name else dataset_name

        if (problem_type or "").strip().lower() == CLUSTERING:
            try:
                artifacts = train_clustering(
                    data_folder=data_folder,
                    dataset_name=dataset_name,
                    n_clusters=0,
                    model_name=model_name or None,
                    progress_callback=_push if progress_queue is not None else None,
                )
            except AutoMLError as exc:
                return f"AUTO_ML_ERROR: {str(exc)}"
            except Exception as exc:
                return f"ERROR: {type(exc).__name__}: {str(exc)}"

            metadata = artifacts.metadata
            return json.dumps({
                "type": "automl_train",
                "artifact_name": metadata.get("artifact_name"),
                "dataset_name": metadata.get("dataset_name"),
                "target_column": None,
                "problem_type": CLUSTERING,
                "best_model_class": metadata.get("best_model_class"),
                "best_model_key": metadata.get("best_model_key"),
                "dataset_profile_before_cleaning": None,
                "n_clusters": metadata.get("n_clusters"),
                "cluster_counts": metadata.get("cluster_counts"),
                "cluster_profile": metadata.get("cluster_profile"),
                "clustered_output": metadata.get("clustered_output"),
                "hyperparameter_tuned": False,
                "best_metrics": metadata.get("best_metrics"),
                "leaderboard": metadata.get("leaderboard", [])[:5],
                "model_path": metadata.get("model_path"),
                "cleaning_summary": metadata.get("cleaning_summary"),
                "feature_engineering": metadata.get("feature_engineering"),
            }, ensure_ascii=False)

        try:
            artifacts = train_automl(
                data_folder=data_folder,
                dataset_name=dataset_name,
                target_column=target_column,
                problem_type=problem_type or "auto",
                model_name=model_name or None,
                progress_callback=_push if progress_queue is not None else None,
            )
        except AutoMLError as exc:
            return f"AUTO_ML_ERROR: {str(exc)}"
        except Exception as exc:
            return f"ERROR: {type(exc).__name__}: {str(exc)}"

        metadata = artifacts.metadata
        return json.dumps({
            "type": "automl_train",
            "artifact_name": metadata.get("artifact_name"),
            "dataset_name": metadata.get("dataset_name"),
            "target_column": metadata.get("target_column"),
            "problem_type": metadata.get("problem_type"),
            "best_model_class": metadata.get("best_model_class"),
            "best_model_key": metadata.get("best_model_key"),
            "n_clusters": None,
            "cluster_counts": None,
            "cluster_profile": None,
            "clustered_output": None,
            "dataset_profile_before_cleaning": metadata.get("dataset_profile_before_cleaning"),
            "cleaning_summary": metadata.get("cleaning_summary"),
            "feature_engineering": metadata.get("feature_engineering"),
            "hyperparameter_tuned": metadata.get("hyperparameter_tuned"),
            "best_metrics": metadata.get("best_metrics"),
            "leaderboard": metadata.get("leaderboard", [])[:5],
            "model_path": metadata.get("model_path"),
        }, ensure_ascii=False)

    @tool
    def automl_list_models_tool() -> str:
        """Lihat daftar model AutoML yang sudah tersimpan untuk user saat ini."""
        items = list_model_metadata(data_folder)
        compact = []
        for item in items[:20]:
            compact.append({
                "artifact_name": item.get("artifact_name"),
                "dataset_name": item.get("dataset_name"),
                "target_column": item.get("target_column"),
                "problem_type": item.get("problem_type"),
                "best_model_class": item.get("best_model_class"),
                "trained_at": item.get("trained_at"),
            })
        return json.dumps(
            {
                "type": "automl_models",
                "models": compact,
                "total": len(items),
            },
            ensure_ascii=False,
        )

    @tool
    def automl_predict_tool(
        artifact_name: str,
        dataset_name: str,
        output_name: str = "",
    ) -> str:
        """Jalankan prediksi memakai model AutoML tersimpan ke dataset baru. Gunakan saat user meminta prediksi dengan model yang sudah ada."""
        try:
            artifacts = predict_with_model(
                data_folder=data_folder,
                artifact_name=artifact_name,
                dataset_name=dataset_name,
                output_name=output_name or None,
            )
        except AutoMLError as exc:
            return f"AUTO_ML_ERROR: {str(exc)}"
        except Exception as exc:
            return f"ERROR: {type(exc).__name__}: {str(exc)}"

        return json.dumps({"type": "automl_predict", **artifacts.metadata}, ensure_ascii=False)

    llm = build_llm(model=model, temperature=0, max_output_tokens=8192)

    # Build tool list — web search only if configured
    tool_list = [python_repl_tool, automl_train_tool, automl_list_models_tool, automl_predict_tool, file_export_tool]

    from backend.core.config import WEB_SEARCH_ENABLED
    if WEB_SEARCH_ENABLED:
        tool_list.append(web_search_tool)
    else:
        logger.info("Web search tool disabled (TAVILY_API_KEY not set)")

    return create_react_agent(
        llm,
        tools=tool_list,
        prompt=prompt,
    )
