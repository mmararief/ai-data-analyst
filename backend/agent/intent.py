"""Intent Agent — comprehension layer that runs BEFORE the Planner.

Responsibilities:
1. Understand the user's underlying intent (eda / ml / viz / dashboard / knowledge / ambiguous)
2. Decide whether the request is clear enough for the Planner, or if clarification is needed
3. Bundle up to 3 multi-choice clarification questions in a single round
4. Rewrite ambiguous queries into more specific, context-rich versions when possible

This is the FIRST agent in the pipeline (after the Classifier fast-path).
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from backend.agent.llm import build_llm, invoke_with_retry
from backend.agent.prompts import INTENT_AGENT_PROMPT
from backend.agent.utils import build_history_context, extract_text


logger = logging.getLogger(__name__)


MAX_CLARIFICATION_QUESTIONS = 3
VALID_INTENTS = {"eda", "viz", "dashboard", "knowledge", "ambiguous"}


def _extract_json_object(raw: str) -> dict | None:
    """Extract the outermost JSON object from a possibly noisy LLM response.

    Uses greedy matching with brace-balancing so that nested arrays/objects
    inside ``clarification_questions`` are preserved intact.
    """
    if not raw:
        return None

    text = raw.strip()
    if text.startswith("```"):
        # strip markdown code fences if model wrapped the JSON
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()

    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start:i + 1]
                try:
                    parsed = json.loads(candidate)
                    return parsed if isinstance(parsed, dict) else None
                except (json.JSONDecodeError, ValueError):
                    return None
    return None


def _normalize_questions(raw_questions: Any) -> list[dict]:
    """Validate and trim clarification questions to a safe shape.

    Each returned dict has keys: id, question, options, allow_multiple.
    """
    if not isinstance(raw_questions, list):
        return []

    cleaned: list[dict] = []
    for idx, q in enumerate(raw_questions[:MAX_CLARIFICATION_QUESTIONS]):
        if not isinstance(q, dict):
            continue
        question_text = str(q.get("question", "")).strip()
        options = q.get("options", [])
        if not question_text or not isinstance(options, list):
            continue
        clean_options = [str(opt).strip() for opt in options if str(opt).strip()]
        if len(clean_options) < 2:
            continue
        cleaned.append({
            "id": str(q.get("id") or f"q{idx + 1}"),
            "question": question_text,
            "options": clean_options[:5],
            "allow_multiple": bool(q.get("allow_multiple", False)),
        })
    return cleaned


def run_intent_agent(
    question: str,
    file_list: str,
    schema_context: str,
    model: str,
    history: list | None = None,
) -> dict:
    """Invoke the Intent Agent and return a normalized result dict.

    Returns a dict with shape::

        {
            "intent": "eda" | "ml" | ... | "ambiguous",
            "confidence": float,
            "rewritten_query": str | None,
            "needs_clarification": bool,
            "clarification_questions": [ {id, question, options, allow_multiple}, ... ],
            "reasoning": str,
        }

    On any failure, returns a safe fallback that lets the pipeline proceed
    straight to the Planner without asking clarification.
    """
    fallback = {
        "intent": "ambiguous",
        "confidence": 0.0,
        "rewritten_query": None,
        "needs_clarification": False,
        "clarification_questions": [],
        "reasoning": "Fallback: intent agent tidak menghasilkan output valid.",
    }

    if not (question or "").strip():
        return fallback

    try:
        history_text = build_history_context(history)
        history_context_block = (
            f"Riwayat percakapan terakhir (gunakan untuk memahami konteks pesan singkat):\n{history_text.strip()}"
            if history_text.strip()
            else ""
        )
        system_prompt = INTENT_AGENT_PROMPT.format(
            file_list=file_list or "(belum ada dataset)",
            schema_context=schema_context or "",
            history_context=history_context_block,
        )
        human_input = question

        llm = build_llm(model=model, temperature=0, max_output_tokens=768)
        response = invoke_with_retry(
            llm,
            [("system", system_prompt), ("human", human_input)],
        )
        raw = response.content if isinstance(response.content, str) else extract_text(response.content)
        parsed = _extract_json_object(raw)
        if not isinstance(parsed, dict):
            logger.debug("Intent Agent returned non-JSON output: %r", raw[:200] if raw else None)
            return fallback

        intent = str(parsed.get("intent", "")).lower().strip()
        if intent not in VALID_INTENTS:
            intent = "ambiguous"

        try:
            confidence = float(parsed.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        confidence = max(0.0, min(1.0, confidence))

        rewritten = parsed.get("rewritten_query")
        if rewritten is not None:
            rewritten = str(rewritten).strip() or None

        needs_clar = bool(parsed.get("needs_clarification", False))
        questions = _normalize_questions(parsed.get("clarification_questions", []))

        # Hard guard: if model said needs_clarification but produced no valid
        # questions, downgrade to "no clarification" so the pipeline does not stall.
        if needs_clar and not questions:
            needs_clar = False

        return {
            "intent": intent,
            "confidence": confidence,
            "rewritten_query": rewritten,
            "needs_clarification": needs_clar,
            "clarification_questions": questions,
            "reasoning": str(parsed.get("reasoning", "")).strip(),
            "opening_message": str(parsed.get("opening_message", "")).strip() if parsed.get("opening_message") else None,
        }
    except Exception:
        logger.debug("Intent Agent invocation failed", exc_info=True)
        return fallback


def format_clarification_answer_context(
    original_question: str,
    answers: dict[str, str | list[str]],
) -> str:
    """Render user answers to clarification questions as a context block.

    Used when the user replies to clarification — we prepend the answers as
    extra context for the Planner so it has the full intent.
    """
    if not answers:
        return original_question
    parts = [original_question, "\n=== JAWABAN KLARIFIKASI PENGGUNA ==="]
    for qid, ans in answers.items():
        if isinstance(ans, list):
            ans_text = ", ".join(str(a) for a in ans)
        else:
            ans_text = str(ans)
        parts.append(f"- {qid}: {ans_text}")
    return "\n".join(parts)
