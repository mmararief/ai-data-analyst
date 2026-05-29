import base64
import hashlib
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.core.security import get_current_user
from backend.models.user import UserInDB

router = APIRouter(prefix="/notebook", tags=["notebook"])


class Part(BaseModel):
    type: str  # 'text' | 'image' | 'plan' | 'task_start'
    content: Optional[str | list] = ""
    index: Optional[int] = None
    total: Optional[int] = None


class CodeStep(BaseModel):
    code: str
    output: Optional[str] = ""


class ConversationMessage(BaseModel):
    role: str
    content: Optional[str] = ""
    parts: Optional[List[Part]] = Field(default_factory=list)
    codeSteps: Optional[List[CodeStep]] = Field(default_factory=list)
    images: Optional[List[str]] = Field(default_factory=list)


class NotebookRequest(BaseModel):
    messages: List[ConversationMessage]


def _cell_id() -> str:
    """Generate a short random cell id."""
    return hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]


def _md_cell(source_lines: list[str]) -> dict:
    return {
        "cell_type": "markdown",
        "id": _cell_id(),
        "metadata": {},
        "source": source_lines,
    }


def _code_cell(
    source_lines: list[str],
    text_output: str | None = None,
    image_b64_list: list[str] | None = None,
) -> dict:
    outputs = []
    if text_output:
        outputs.append({
            "output_type": "stream",
            "name": "stdout",
            "text": [ln + "\n" for ln in text_output.splitlines()],
        })
    for img_b64 in (image_b64_list or []):
        outputs.append({
            "output_type": "display_data",
            "metadata": {},
            "data": {
                "image/png": img_b64,
                "text/plain": ["<Figure>"],
            },
        })
    return {
        "cell_type": "code",
        "id": _cell_id(),
        "execution_count": None,
        "metadata": {},
        "outputs": outputs,
        "source": source_lines,
    }


def _source_lines(text: str) -> list[str]:
    """Convert a text block into nbformat source lines (each ending with \\n except the last)."""
    lines = text.split("\n")
    return [ln + "\n" for ln in lines[:-1]] + [lines[-1]] if lines else []


@router.post("/generate")
def generate_notebook(req: NotebookRequest, user: UserInDB = Depends(get_current_user)):
    cells: list[dict] = []

    # Title cell
    cells.append(_md_cell(_source_lines(
        "# Laporan Analisis Data\n"
        f"Dibuat otomatis oleh **Analisai** — {datetime.now().strftime('%d %B %Y, %H:%M')}\n\n"
        "> **Catatan:** Sesuaikan path dataset jika menjalankan notebook ini secara lokal."
    )))

    code_step_idx = 0  # running counter for execution_count display

    for msg in req.messages:
        if msg.role == "user":
            # User question as a markdown header
            cells.append(_md_cell(_source_lines(f"## Pertanyaan\n{msg.content}")))
            continue

        # Assistant message — walk through parts and codeSteps in order
        parts = msg.parts or []
        steps = msg.codeSteps or []
        step_cursor = 0
        pending_images: list[str] = []  # collect image b64 that may belong to the next code cell output

        for part in parts:
            if part.type == "text" and part.content:
                text = part.content.strip()
                if not text:
                    continue
                cells.append(_md_cell(_source_lines(text)))

            elif part.type == "plan" and isinstance(part.content, list):
                plan_lines = "## Rencana Eksekusi\n" + "\n".join(
                    f"{i+1}. {task}" for i, task in enumerate(part.content)
                )
                cells.append(_md_cell(_source_lines(plan_lines)))

            elif part.type == "task_start" and part.content:
                idx = (part.index or 0) + 1
                total = part.total or "?"
                cells.append(_md_cell(_source_lines(f"### Langkah {idx}/{total} — {part.content}")))

            elif part.type == "image" and part.content:
                pending_images.append(part.content)


        # Now add code steps (with their outputs and any preceding images)
        for step in steps:
            code_step_idx += 1
            # Skip steps that errored (agent retried)
            is_error = step.output and step.output.strip().lower().startswith("error")

            code = step.code or ""
            source = _source_lines(code)

            # Collect images that were generated right before/during this step
            step_images = pending_images
            pending_images = []

            cell = _code_cell(
                source,
                text_output=step.output if step.output else None,
                image_b64_list=step_images if not is_error else [],
            )
            cell["execution_count"] = code_step_idx
            cells.append(cell)

        # Any remaining images not attached to code steps — add as display cells
        for img_b64 in pending_images:
            cells.append(_code_cell(
                _source_lines("# Visualisasi"),
                image_b64_list=[img_b64],
            ))

    notebook = {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {
                "name": "python",
                "version": "3.10.0",
            },
        },
        "cells": cells,
    }

    return JSONResponse(content=notebook)
