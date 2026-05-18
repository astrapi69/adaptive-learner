"""v0.5.0 — AI-driven cycle-step transition evaluator.

The Phase 7 baseline advances ``LearningSession.cycle_step`` by 1
on every successful user-AI round-trip. Phase 8 replaces that
deterministic advance with a second AI call that judges whether
the learner is actually READY for the next step — and may
recommend skipping forward, repeating the current step, or even
going BACK to an earlier step when the learner's last turn
suggests a regression in understanding.

This module is the evaluator. The route layer (8B) fires
:func:`evaluate_step` after the learning response is persisted;
the result drives ``cycle_step`` for the next turn.

Design notes:

- **English system prompt + JSON output.** Phase 8 Q3 settled
  this: English prompt for cross-provider JSON reliability;
  ``output_language`` instructs the model to write the
  user-facing ``reason`` field in the learner's UI language so
  it reads naturally if surfaced as a tooltip on the frontend.
- **Capped at step 7.** When ``current_step`` is 7 the evaluator
  cannot suggest 8 — the cycle ends or repeats at the user's
  initiative (see Phase 8 Q2 — auto-loop deferred to v0.6.x).
  Suggestions outside ``[1, 7]`` clamp into range.
- **Backward transitions allowed.** Phase 8 Q4 — if the evaluator
  flags confusion at step 4, suggesting step 2 (re-attempt) is
  pedagogically correct. The seven steps are a framework, not a
  conveyor belt.
- **Deterministic fallback.** Invalid JSON, missing fields, or a
  hook returning ``None`` never crash the route; the evaluator
  returns ``advance=True, suggested_step=current+1`` (capped at
  7) with ``fallback_used=True`` so callers can record /
  surface the degraded path.
- **Method-aware.** :data:`METHOD_EVAL_HINTS` parameterises a
  single template by the active learning method; deductive
  evaluates rule comprehension, dialogic evaluates the quality
  of the exchange, etc. One template, six method variants.

This module deliberately has NO ``app.*`` imports so the
standalone plugin test suite can exercise the parsing logic and
prompt construction without the backend on sys.path. The route
layer (8B) does the DB work.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from .ai_orchestration import call_ai_complete

# --- The seven cycle steps -------------------------------------------------
#
# Mirrors :data:`backend.app.schemas.CycleStep` (frontend constants too).
# Numeric ids are load-bearing — they're the values the AI emits as
# ``suggested_step``.

STEP_DESCRIPTIONS: dict[int, str] = {
    1: "input — the learner is encountering new material for the first time",
    2: "attempt — the learner is applying what they just learned",
    3: "error — mistakes are happening and being noticed",
    4: "feedback — the learner is receiving and processing feedback on mistakes",
    5: "adapt — the learner is adjusting their approach based on feedback",
    6: "repeat — the learner is practising a variation with the new understanding",
    7: "integrate — the learner is connecting the new knowledge to broader context",
}

# How to judge readiness PER method. Kept short so the system prompt
# stays compact; the AI gets a one-line nudge that the same step looks
# different depending on the active method.
METHOD_EVAL_HINTS: dict[str, str] = {
    "deductive": (
        "Look for rule comprehension and correct application of the underlying theory. "
        "Readiness = the learner can articulate WHY, not only WHAT."
    ),
    "inductive": (
        "Look for pattern recognition from examples — does the learner generalise from "
        "concrete cases to the underlying principle?"
    ),
    "error_based": (
        "Errors are the point. Readiness = the learner identifies WHAT went wrong AND WHY, "
        "not just that something went wrong."
    ),
    "dialogic": (
        "Quality of the exchange matters more than producing the 'correct' answer first. "
        "Readiness = productive back-and-forth, not monologue."
    ),
    "contextual": (
        "Look for application in the learner's OWN real situation. Readiness = the learner "
        "ties the concept to a concrete, personal context."
    ),
    "ai_adaptive": (
        "The learner is steering. Readiness = self-direction — clear next-step intent, "
        "productive prompting back to the AI."
    ),
}

MIN_STEP, MAX_STEP = 1, 7

EVALUATION_SYSTEM_PROMPT = """\
You are an assessment co-pilot for an adaptive learning system. Your job
is to read a short learner-AI exchange and judge whether the learner is
ready to advance to the next step in a 7-step learning cycle.

You will receive: the current learning method, the current cycle step,
a short conversation history, and the language the human-readable
'reason' field must be written in.

Output ONLY a single valid JSON object, with NO surrounding prose, NO
markdown code fences, NO trailing commentary. The schema is:

  {
    "advance":         <boolean>,
    "confidence":      <float in [0.0, 1.0]>,
    "reason":          <string, max ~200 chars, in the output_language>,
    "suggested_step":  <integer in [1, 7]>
  }

Field semantics:
- advance=true  → the learner is ready to leave the current step.
- advance=false → stay on the current step for the next exchange.
- confidence is your certainty in the advance decision (0 = no idea,
  1 = unambiguous).
- suggested_step is where the next exchange should START. Usually
  current+1, but you MAY skip forward (e.g. 1 → 3 if the learner
  clearly already grasps the input), repeat the current step (= the
  same value as current), or go BACKWARD (e.g. 4 → 2 if the learner's
  last turn reveals they did not actually understand and should
  re-attempt). The 7-step cycle is a framework, not a conveyor belt.
- After step 7 the learning cycle ends; suggested_step must not be 8.
  If the learner has fully integrated, suggest 7 with advance=false.

If you are unsure, prefer advance=false with a moderate confidence —
staying on the current step is the safer pedagogical default."""


@dataclass
class StepEvaluation:
    """Result of one evaluation call.

    ``fallback_used`` is True iff the AI's raw response could not be
    parsed into a valid JSON evaluation and the deterministic +1
    advance was substituted. Callers persist this so a future audit
    can spot models / prompts that fail to produce valid JSON.
    """

    advance: bool
    confidence: float
    reason: str
    suggested_step: int
    fallback_used: bool = False
    raw_response: str | None = field(default=None, repr=False)


def build_evaluation_messages(
    *,
    method: str,
    current_step: int,
    history: list[dict[str, Any]],
    output_language: str,
) -> list[dict[str, Any]]:
    """Compose the ``messages`` list for the evaluation ``ai_complete`` call.

    Returns ``[{system}, {user}]`` — a single user message containing
    the full evaluation context. The system message carries the
    output schema; the user message carries the case.
    """
    step_desc = STEP_DESCRIPTIONS.get(current_step, f"step {current_step}")
    method_hint = METHOD_EVAL_HINTS.get(method, "")

    # Render the exchange as plain text so the evaluator sees it as a
    # readable conversation rather than as nested JSON. Limit to the
    # last ~8 turns: the evaluator only needs RECENT context to judge
    # the current step, and longer histories inflate the token bill.
    recent = history[-8:] if len(history) > 8 else history
    turns: list[str] = []
    for msg in recent:
        role = msg.get("role")
        content = msg.get("content")
        if not isinstance(role, str) or not isinstance(content, str):
            continue
        # Map system messages to "(prompt)" so they don't confuse the
        # evaluator into judging the system prompt's own content.
        label = {"user": "Learner", "assistant": "AI", "system": "(prompt)"}.get(
            role, role
        )
        turns.append(f"{label}: {content}")
    transcript = "\n".join(turns) if turns else "(no exchanges yet)"

    user_content = (
        f"method: {method}\n"
        f"method_hint: {method_hint}\n"
        f"current_step: {current_step} ({step_desc})\n"
        f"output_language: {output_language}\n"
        f"\n"
        f"--- transcript ---\n"
        f"{transcript}\n"
        f"--- end transcript ---\n"
        f"\n"
        f"Return only the JSON evaluation. No surrounding prose."
    )
    return [
        {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


# Models occasionally wrap JSON in markdown fences. This strips
# ```json...``` and ``` (no language) variants before parsing.
_FENCE_RE = re.compile(r"^\s*```(?:json|JSON)?\s*\n?|\n?```\s*$")


def _deterministic_fallback(current_step: int, raw: str | None) -> StepEvaluation:
    """Replacement for an unparseable AI response.

    Mirrors the v0.4.0 Phase-7A behaviour: advance by 1, capped at 7.
    At step 7 the fallback is "stay at 7" (no advance), so a broken
    evaluator never silently moves the learner off the integration
    step.
    """
    if current_step >= MAX_STEP:
        return StepEvaluation(
            advance=False,
            confidence=0.5,
            reason="Evaluator output unparseable; staying at step 7.",
            suggested_step=MAX_STEP,
            fallback_used=True,
            raw_response=raw,
        )
    return StepEvaluation(
        advance=True,
        confidence=0.5,
        reason="Evaluator output unparseable; defaulting to +1 advance.",
        suggested_step=current_step + 1,
        fallback_used=True,
        raw_response=raw,
    )


def _clamp_step(value: Any, current_step: int) -> int:
    """Bring ``value`` into ``[MIN_STEP, MAX_STEP]`` or fall back to ``current``."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return current_step
    if n < MIN_STEP:
        return MIN_STEP
    if n > MAX_STEP:
        return MAX_STEP
    return n


def _clamp_confidence(value: Any) -> float:
    """Clamp into ``[0.0, 1.0]`` with a safe-middle default on failure."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return 0.5
    if f < 0.0:
        return 0.0
    if f > 1.0:
        return 1.0
    return f


def parse_evaluation_response(
    raw: str | None, *, current_step: int
) -> StepEvaluation:
    """Robustly parse the AI's JSON response into a StepEvaluation.

    Strips common markdown fences. On any parse failure or missing
    field, returns the deterministic fallback (+1 advance, capped at
    7) with ``fallback_used=True``.
    """
    if not isinstance(raw, str) or not raw.strip():
        return _deterministic_fallback(current_step, raw)

    cleaned = _FENCE_RE.sub("", raw.strip())
    # Some models still leak prose around the JSON. Snip the first
    # balanced JSON object; if regex misfires, json.loads catches it.
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    candidate = match.group(0) if match else cleaned

    try:
        data = json.loads(candidate)
    except (json.JSONDecodeError, ValueError):
        return _deterministic_fallback(current_step, raw)

    if not isinstance(data, dict):
        return _deterministic_fallback(current_step, raw)

    if "advance" not in data or "suggested_step" not in data:
        return _deterministic_fallback(current_step, raw)

    advance = bool(data.get("advance"))
    confidence = _clamp_confidence(data.get("confidence"))
    reason_raw = data.get("reason", "")
    reason = (
        reason_raw.strip()[:240]
        if isinstance(reason_raw, str) and reason_raw.strip()
        else "(no reason provided)"
    )
    suggested_step = _clamp_step(data.get("suggested_step"), current_step)

    return StepEvaluation(
        advance=advance,
        confidence=confidence,
        reason=reason,
        suggested_step=suggested_step,
        fallback_used=False,
        raw_response=raw,
    )


def evaluate_step(
    *,
    pm: Any,
    method: str,
    current_step: int,
    history: list[dict[str, Any]],
    model: str,
    api_key: str,
    output_language: str = "en",
) -> StepEvaluation:
    """End-to-end orchestration: build the prompt, fire ``ai_complete``,
    parse the response, return a :class:`StepEvaluation`.

    The hook firing is the same one the learning call uses — same
    provider, same API key, same model. (Phase 8B will plumb a
    smaller ``max_tokens`` through when the hookspec gains the kwarg;
    until then, prompt engineering keeps the JSON tight.)

    Never raises. A None / empty / malformed response from the hook
    collapses into the deterministic fallback so the route caller
    never has to wrap this in a try/except.
    """
    messages = build_evaluation_messages(
        method=method,
        current_step=current_step,
        history=history,
        output_language=output_language,
    )
    try:
        raw = call_ai_complete(
            pm=pm,
            messages=messages,
            model=model,
            api_key=api_key,
        )
    except Exception:  # noqa: BLE001 — defensive: never crash the route
        return _deterministic_fallback(current_step, None)
    return parse_evaluation_response(raw, current_step=current_step)
