"""Stagnation-based method-switch recommendation (project-reference §12).

v0.1.0 rule, deliberately simple:

  Recommend a switch when BOTH:
    1. The last :data:`STAGNATION_WINDOW` (=3) understanding scores
       are non-increasing (max(last3) - last3[0] <= 0; same value
       three times in a row counts as stagnant).
    2. The mean stress score across the same window is > 3.0.

Confidence:
  - 0.5 baseline when only one condition fires (we still don't
    recommend in that case — both must hold — but the helper
    surfaces the partial signal for diagnostics).
  - 1.0 when both fire AND stress is > 4.0 (clearly miserable).
  - 0.75 when both fire and stress is in (3.0, 4.0].

Returns ``None`` (= no switch) when the window has fewer than
:data:`STAGNATION_WINDOW` ratings; the dashboard needs at least
three data points before suggesting the user change their
approach.

Future plugins can layer on top via the list-mode ``recommend_method_switch``
dispatch — a fatigue detector, a per-topic specialist, etc. — and
a Phase-4 arbiter takes the max-confidence non-None result.
"""

from __future__ import annotations

from typing import Any

from .prompts import METHODS

STAGNATION_WINDOW = 3
STRESS_THRESHOLD = 3.0


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _is_stagnant(understanding: list[float]) -> bool:
    """No improvement across the window. ``max - first <= 0`` covers
    "same value", "decreasing", and the small-noise case (5→5→5)."""
    if len(understanding) < STAGNATION_WINDOW:
        return False
    return (max(understanding) - understanding[0]) <= 0


def _next_method(
    current_method: str,
    profile: dict[str, Any] | None,
    recently_used: list[str],
) -> str | None:
    """Pick the next-best method.

    1. If a profile is supplied, prefer the highest-weighted method
       that isn't ``current_method`` and wasn't used in the
       ``recently_used`` window.
    2. If no profile (or every option got filtered out), fall back
       to the static method order, skipping the current one and
       the recently-used ones.
    3. If even that runs out, return any non-current method.
    4. If all six methods are in ``recently_used`` AND the same as
       ``current_method`` (impossible practically), return None.
    """
    skip = {current_method, *recently_used}

    if profile:
        ranked = sorted(
            (m for m in METHODS if isinstance(profile.get(m), (int, float))),
            key=lambda m: -float(profile[m]),
        )
        for candidate in ranked:
            if candidate not in skip:
                return candidate

    for candidate in METHODS:
        if candidate not in skip:
            return candidate

    for candidate in METHODS:
        if candidate != current_method:
            return candidate

    return None


def recommend(
    project_id: str,
    current_method: str,
    recent_ratings: list[dict[str, Any]],
    *,
    profile: dict[str, Any] | None = None,
    recently_used_methods: list[str] | None = None,
) -> dict[str, Any] | None:
    """Return a switch recommendation or ``None``.

    Args:
        project_id: The project the recommendation applies to.
            Included verbatim in the returned dict so a future
            multi-project arbiter can keep the result attached to
            its source.
        current_method: The session method just rated.
        recent_ratings: Last N (typically 3+) SessionRating rows as
            dicts. Each carries at least ``understanding`` (int 1-5)
            and ``stress`` (int 1-5). Order: oldest first.
        profile: Optional LearningProfile (weight dict). Used to pick
            the highest-ranked alternative the user hasn't tried
            recently.
        recently_used_methods: Optional list of method keys the
            project has cycled through recently; the candidate
            picker avoids them. Defaults to ``[current_method]``.
    """
    if recently_used_methods is None:
        recently_used_methods = [current_method]

    window = recent_ratings[-STAGNATION_WINDOW:]
    if len(window) < STAGNATION_WINDOW:
        return None

    understanding = [float(r["understanding"]) for r in window if "understanding" in r]
    stress = [float(r["stress"]) for r in window if "stress" in r]
    if len(understanding) < STAGNATION_WINDOW or len(stress) < STAGNATION_WINDOW:
        return None

    if not _is_stagnant(understanding):
        return None
    mean_stress = _mean(stress)
    if mean_stress <= STRESS_THRESHOLD:
        return None

    to_method = _next_method(current_method, profile, recently_used_methods)
    if to_method is None:
        return None

    confidence = 0.75 if mean_stress <= 4.0 else 1.0
    reason_en = (
        f"Understanding flat over the last {STAGNATION_WINDOW} sessions "
        f"({[int(u) for u in understanding]}) while mean stress is "
        f"{mean_stress:.1f}/5. Trying {to_method} next."
    )
    return {
        "project_id": project_id,
        "from_method": current_method,
        "to_method": to_method,
        "reason": reason_en,
        "confidence": confidence,
    }
