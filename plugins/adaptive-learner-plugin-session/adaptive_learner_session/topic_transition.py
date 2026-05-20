"""v1.4.0 — topic-transition evaluator for the auto-loop feature.

When the step evaluator (``step_evaluator.py``) signals that the
learner has reached step 7 (``integrate``) AND advance=true, the
session router calls THIS module to decide what comes next:

  - has the learner actually integrated the concept?
  - if yes, what new subtopic / deeper aspect should the next
    cycle tackle?
  - or should the session wrap up because the user has mastered
    the topic area?

A successful topic-transition response lets the route reset
``cycle_step`` to 1 and start a new cycle with a refined topic.
A fallback or ``continue_recommended=False`` keeps the v0.5.0
cap-at-7 behaviour, which is the safe degradation: the user can
manually end the session.

The hook firing is the same ``ai_complete`` the learning + step
evaluation calls use — same provider, same API key, same model.
Cheap call: 256 tokens cap, single JSON object.

Design mirrors :mod:`step_evaluator`: dataclass result,
deterministic fallback, never raises.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from .ai_orchestration import call_ai_complete


DIFFICULTY_VALUES = ("same", "easier", "harder")


TRANSITION_SYSTEM_PROMPT = """\
You are a learning-path advisor for an adaptive learning system.
A learner just finished a full 7-step learning cycle on a topic
(input -> attempt -> error -> feedback -> adapt -> repeat ->
integrate). Your job: decide what happens next.

You will receive: the original learning goal, the topic the
learner just completed, the active learning method, a short
conversation history, and the language for the user-facing
'summary' and 'next_topic' fields.

Output ONLY a single valid JSON object, no surrounding prose,
no markdown code fences, no commentary. The schema is:

  {
    "cycle_complete":         <boolean>,
    "summary":                <string, 1-2 sentences, in the output_language>,
    "next_topic":             <string or null, in the output_language>,
    "next_topic_rationale":   <string, 1 sentence, in the output_language>,
    "difficulty_adjustment":  <"same" | "easier" | "harder">,
    "continue_recommended":   <boolean>
  }

Field semantics:
- cycle_complete: did the learner actually integrate the concept?
  true means yes (worth moving on); false means they need another
  pass on the same topic.
- summary: 1-2 sentences naming what the learner just integrated.
  Concrete, not generic.
- next_topic: the natural next subtopic or deeper aspect. May be
  null if continue_recommended=false (learner mastered the area).
- next_topic_rationale: WHY this is the right next step.
- difficulty_adjustment: "same" by default, "easier" if the
  learner struggled even though they completed the cycle, "harder"
  if they breezed through it.
- continue_recommended: true if the learner would benefit from
  another cycle on a new subtopic; false if they have learned
  enough for one session and should end on a high note.

If the learner clearly struggled (low understanding signals in
the transcript, repeated confusion), prefer
continue_recommended=false — better to end with a positive
takeaway than push exhaustion."""


@dataclass
class TopicTransition:
    """Result of one topic-transition call.

    ``fallback_used`` is True iff the AI's response could not be
    parsed; the route layer then keeps the v0.5.0 cap-at-7
    behaviour (no auto-loop). Callers persist this for audit.
    """

    cycle_complete: bool
    summary: str
    next_topic: str | None
    next_topic_rationale: str
    difficulty_adjustment: str
    continue_recommended: bool
    fallback_used: bool = False
    raw_response: str | None = field(default=None, repr=False)


def build_transition_messages(
    *,
    goal: str,
    topic: str,
    method: str,
    history: list[dict[str, Any]],
    output_language: str,
) -> list[dict[str, Any]]:
    """Compose the ``messages`` list for the ``ai_complete`` call.

    Returns ``[{system}, {user}]``. The user message names the
    learning goal, the completed topic, the method, and the last
    few turns so the model can detect struggle / mastery signals.
    """
    recent = history[-8:] if len(history) > 8 else history
    turns: list[str] = []
    for msg in recent:
        role = msg.get("role")
        content = msg.get("content")
        if not isinstance(role, str) or not isinstance(content, str):
            continue
        label = {"user": "Learner", "assistant": "AI", "system": "(prompt)"}.get(
            role, role
        )
        turns.append(f"{label}: {content}")
    transcript = "\n".join(turns) if turns else "(no exchanges yet)"

    user_content = (
        f"goal: {goal}\n"
        f"completed_topic: {topic}\n"
        f"method: {method}\n"
        f"output_language: {output_language}\n"
        f"\n"
        f"--- transcript ---\n"
        f"{transcript}\n"
        f"--- end transcript ---\n"
        f"\n"
        f"Return only the JSON transition object. No surrounding prose."
    )
    return [
        {"role": "system", "content": TRANSITION_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


_FENCE_RE = re.compile(r"^\s*```(?:json|JSON)?\s*\n?|\n?```\s*$")


def _deterministic_fallback(raw: str | None) -> TopicTransition:
    """Replacement for an unparseable AI response.

    Falls back to the v0.5.0 behaviour: NO auto-loop. The session
    stays at step 7; the user can end manually. ``cycle_complete``
    is False because we cannot confirm integration without the
    AI's verdict.
    """
    return TopicTransition(
        cycle_complete=False,
        summary="Topic-transition evaluator output unparseable.",
        next_topic=None,
        next_topic_rationale="",
        difficulty_adjustment="same",
        continue_recommended=False,
        fallback_used=True,
        raw_response=raw,
    )


def _normalise_difficulty(value: Any) -> str:
    """Clamp to a valid value or fall back to ``"same"``."""
    if isinstance(value, str) and value.strip().lower() in DIFFICULTY_VALUES:
        return value.strip().lower()
    return "same"


def parse_transition_response(raw: str | None) -> TopicTransition:
    """Robustly parse the AI's JSON response.

    On any parse failure / missing required field / wrong type,
    returns the deterministic fallback with ``fallback_used=True``.
    """
    if not isinstance(raw, str) or not raw.strip():
        return _deterministic_fallback(raw)

    cleaned = _FENCE_RE.sub("", raw.strip())
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    candidate = match.group(0) if match else cleaned

    try:
        data = json.loads(candidate)
    except (json.JSONDecodeError, ValueError):
        return _deterministic_fallback(raw)

    if not isinstance(data, dict):
        return _deterministic_fallback(raw)

    required = ("cycle_complete", "continue_recommended")
    if any(k not in data for k in required):
        return _deterministic_fallback(raw)

    cycle_complete = bool(data.get("cycle_complete"))
    continue_recommended = bool(data.get("continue_recommended"))
    summary_raw = data.get("summary", "")
    summary = (
        summary_raw.strip()[:500]
        if isinstance(summary_raw, str) and summary_raw.strip()
        else ""
    )
    next_topic_raw = data.get("next_topic")
    next_topic = (
        next_topic_raw.strip()[:300]
        if isinstance(next_topic_raw, str) and next_topic_raw.strip()
        else None
    )
    rationale_raw = data.get("next_topic_rationale", "")
    rationale = (
        rationale_raw.strip()[:500]
        if isinstance(rationale_raw, str) and rationale_raw.strip()
        else ""
    )
    difficulty = _normalise_difficulty(data.get("difficulty_adjustment"))

    return TopicTransition(
        cycle_complete=cycle_complete,
        summary=summary,
        next_topic=next_topic,
        next_topic_rationale=rationale,
        difficulty_adjustment=difficulty,
        continue_recommended=continue_recommended,
        fallback_used=False,
        raw_response=raw,
    )


TRANSITION_DEFAULT_MAX_TOKENS = 256


def evaluate_topic_transition(
    *,
    pm: Any,
    goal: str,
    topic: str,
    method: str,
    history: list[dict[str, Any]],
    model: str,
    api_key: str,
    output_language: str = "en",
    max_tokens: int = TRANSITION_DEFAULT_MAX_TOKENS,
) -> TopicTransition:
    """End-to-end orchestration. Build the prompt, fire
    ``ai_complete``, parse the response. Never raises; failures
    collapse into the deterministic fallback.
    """
    messages = build_transition_messages(
        goal=goal,
        topic=topic,
        method=method,
        history=history,
        output_language=output_language,
    )
    try:
        raw = call_ai_complete(
            pm=pm,
            messages=messages,
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
        )
    except Exception:  # noqa: BLE001 — defensive
        return _deterministic_fallback(None)
    return parse_transition_response(raw)
