"""Convert raw assessment answers into a 6-method-weight profile.

Algorithm (kept deliberately simple for v0.1.0):

1. Build a lookup ``question_id -> answer_id -> weights`` from the
   bundled :data:`questions.QUESTIONS`.
2. For each answer the user supplied, add its per-method weights to
   a running total.
3. Divide each method's total by the number of questions so the
   per-method score lands in ``[0.0, 1.0]``.

The interpretation: a 1.0 means the user picked the answer fully
attributed to that method on every question; a 0.0 means they never
did. A balanced respondent ends up around 0.17 across all six
(1/6 ≈ 0.17) — the dominant-method @property on
:class:`app.models.LearningProfile` then surfaces the argmax.

Unknown ``question_id`` / ``answer_id`` values are silently dropped
(robust against a future client sending an answer for a question
that was removed from the pack). The caller's request-validation
layer (Pydantic in :mod:`.routes`) catches the structural shape;
this module owns only the numeric aggregation.
"""

from __future__ import annotations

from typing import Any

from .questions import METHODS, lang_neutral_questions


def _build_lookup(
    questions: list[dict[str, Any]] | None,
) -> tuple[int, dict[str, dict[str, dict[str, float]]]]:
    """Return ``(num_questions, lookup)`` where lookup is
    ``{question_id: {answer_id: {method: weight}}}``.
    """
    if questions is None:
        questions = lang_neutral_questions()
    lookup: dict[str, dict[str, dict[str, float]]] = {}
    for q in questions:
        lookup[q["id"]] = {a["id"]: dict(a.get("weights", {})) for a in q.get("answers", [])}
    return len(questions), lookup


def calculate_profile(
    answers: list[dict[str, Any]],
    questions: list[dict[str, Any]] | None = None,
) -> dict[str, float]:
    """Aggregate per-answer weights into a 6-method-weight dict.

    Args:
        answers: List of entries with ``question_id`` plus either:

            - ``answer_id: str`` (legacy single-select shape), or
            - ``answer_ids: list[str]`` (v0.4.0 multi-select shape)

            Both shapes coexist so existing callers keep working.
            Last entry per ``question_id`` wins. For multi-select,
            each picked answer's weights contribute proportionally
            (``weight / num_picked``) so the question's total
            contribution stays comparable to a single-select pick.
        questions: Optional override of the question pack (tests
            pass a stub here). Default reads the bundled 12.

    Returns:
        Dict with the six method keys mapped to floats in
        ``[0.0, 1.0]``, rounded to 4 decimals.
    """
    num_questions, lookup = _build_lookup(questions)
    totals: dict[str, float] = {m: 0.0 for m in METHODS}

    # Dedupe by question_id (last write wins). Each value is a
    # NORMALISED list of answer-ids — single-select legacy shape
    # gets wrapped, multi-select shape gets filtered to strings.
    by_qid: dict[str, list[str]] = {}
    for ans in answers:
        qid = ans.get("question_id")
        if not isinstance(qid, str):
            continue
        aids: list[str] = []
        raw_ids = ans.get("answer_ids")
        if isinstance(raw_ids, list):
            aids = [x for x in raw_ids if isinstance(x, str)]
        elif isinstance(ans.get("answer_id"), str):
            aids = [ans["answer_id"]]
        if aids:
            by_qid[qid] = aids

    for qid, aids in by_qid.items():
        n = len(aids)
        if n == 0:
            continue
        for aid in aids:
            weights = lookup.get(qid, {}).get(aid, {})
            for method, weight in weights.items():
                if method in totals and isinstance(weight, (int, float)):
                    # Multi-select: split the answer's weight
                    # equally so picking 2 answers contributes
                    # the same total as picking 1.
                    totals[method] += float(weight) / n

    if num_questions == 0:
        return {m: 0.0 for m in METHODS}

    return {m: round(min(1.0, max(0.0, totals[m] / num_questions)), 4) for m in METHODS}
