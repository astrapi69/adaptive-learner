"""Aggregator for ``get_progress_summary`` + the GET
``/progress`` endpoint.

Returns the tracking plugin's slice under its own namespace key
so other plugins can stack their own slices in the same response
without colliding::

    {
        "tracking": {
            "total_sessions":              int,
            "total_minutes":               int,    # v0.4.0
            "streak_days":                 int,    # v0.4.0
            "sessions_per_method":         {method: count},
            "method_distribution":         [       # v0.4.0
                {"method": str, "count": int, "percentage": int},
                ...                                # one entry per method,
                                                   # sorted by count desc
            ],
            "recent_understanding":        list[float],   # last 5, oldest first
            "recent_stress":               list[float],   # last 5, oldest first
            "mean_understanding":          float,
            "mean_stress":                 float,
            "recent_sessions":             [               # v0.4.0
                {                                          # newest first,
                    "id": str,                             # up to 5
                    "session_id": str | None,              # originating session
                    "method": str,
                    "understanding": float,
                    "stress": float,
                    "duration_minutes": int,
                    "committed_at": str | None,
                },
                ...
            ],
        }
    }

A future ``stagnation`` plugin can produce its own slice via the
``get_progress_summary`` hook; the dispatch is list-mode so every
plugin's dict appears in the aggregator result; the route shallow-
merges them.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

NAMESPACE = "tracking"
TREND_WINDOW = 5

# Method keys must match :data:`app.schemas.LearningMethod`. The
# aggregator builds an entry per method (including zero-counts)
# so the frontend can render every method bar even when the
# learner hasn't touched it yet.
_METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def _parse_iso_datetime(value: object) -> datetime | None:
    """Tolerant ISO-8601 -> ``datetime`` parser. Returns ``None``
    on anything that can't be coerced. v0.5.0 step-evaluation
    aggregates use this to compute time deltas between
    consecutive evaluations within a session.
    """
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    # ``datetime.fromisoformat`` accepts the ``2026-05-18T07:30:58Z``
    # shape since Python 3.11 — strip a trailing ``Z`` defensively
    # for older callers / hand-crafted strings.
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _parse_iso_date(value: object) -> date | None:
    """Tolerant ISO-8601 -> ``date`` parser.

    The ProgressCommit ORM serialises ``committed_at`` to
    ``2026-05-18T07:30:58.543774+00:00`` via ``.isoformat()``;
    we strip the time portion and parse just the date so two
    commits on the same calendar day count toward one streak
    day regardless of the hour. Returns None for malformed
    values rather than raising; the streak calc treats a
    missing date as a gap day.
    """
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        # First 10 chars are always YYYY-MM-DD for ISO timestamps;
        # ``date.fromisoformat`` parses that exact slice.
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _current_streak_days(commit_dates: set[date], today: date) -> int:
    """Count consecutive calendar days with at least one commit,
    walking back from ``today``. Stops at the first gap.

    Edge cases:
    - Empty set -> 0 streak.
    - No commit today but one yesterday -> 0 streak (the user
      has to do a session today to maintain the streak). This
      matches the Duolingo / Habitica convention; the strict
      "missed today" decision keeps the streak honest.
    - Multiple commits same day -> still counts as 1 day.

    Parameter ``today`` is injected for deterministic tests.
    """
    if not commit_dates or today not in commit_dates:
        return 0
    streak = 0
    from datetime import timedelta

    cursor = today
    while cursor in commit_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _method_distribution(
    sessions_per_method: dict[str, int],
    total_sessions: int,
) -> list[dict[str, Any]]:
    """Build the per-method distribution list used by the
    Dashboard's MethodDistribution chart.

    Always emits one entry per method in :data:`_METHODS`,
    including zero-count rows so the chart renders every bar
    consistently. Percentages are integers (rounded) and sum
    to 100 only when ``total_sessions > 0``.
    """
    entries: list[dict[str, Any]] = []
    for method in _METHODS:
        count = sessions_per_method.get(method, 0)
        pct = round(count * 100 / total_sessions) if total_sessions else 0
        entries.append({"method": method, "count": count, "percentage": pct})
    # Sort descending by count so the most-used method renders
    # first; ties keep the canonical method order (stable sort).
    entries.sort(key=lambda e: -e["count"])
    return entries


def aggregate(
    commits: list[dict[str, Any]],
    *,
    today: date | None = None,
) -> dict[str, Any]:
    """Build the tracking-namespace slice from a sequence of
    ProgressCommit row-dicts.

    ``commits`` is expected to be ordered by ``committed_at`` ASC
    (oldest first); the recent-trend slice takes the last
    :data:`TREND_WINDOW` entries from the tail. v0.4.0 adds
    ``total_minutes``, ``streak_days``, ``method_distribution``,
    and ``recent_sessions``.

    ``today`` is injected for deterministic streak tests.
    Defaults to UTC today; the streak rolls over at UTC
    midnight, which is good enough for v0.4.0. A timezone-
    aware variant is its own follow-up.
    """
    sessions_per_method: dict[str, int] = {}
    for c in commits:
        method = c.get("method")
        if isinstance(method, str):
            sessions_per_method[method] = sessions_per_method.get(method, 0) + 1

    understanding_all = [
        float(c["understanding"])
        for c in commits
        if isinstance(c.get("understanding"), (int, float))
    ]
    stress_all = [
        float(c["stress"]) for c in commits if isinstance(c.get("stress"), (int, float))
    ]

    total_minutes = sum(
        int(c["duration_minutes"])
        for c in commits
        if isinstance(c.get("duration_minutes"), (int, float))
    )

    commit_dates = {
        d for d in (_parse_iso_date(c.get("committed_at")) for c in commits) if d is not None
    }
    streak_today = today if today is not None else datetime.now(UTC).date()
    streak_days = _current_streak_days(commit_dates, streak_today)

    total_sessions = len(commits)
    method_distribution = _method_distribution(sessions_per_method, total_sessions)

    # Recent sessions: newest first, up to TREND_WINDOW. The
    # input is sorted oldest-first; reverse the tail.
    recent_sessions = []
    for row in reversed(commits[-TREND_WINDOW:]):
        recent_sessions.append(
            {
                "id": row.get("id"),
                "session_id": row.get("session_id"),
                "method": row.get("method"),
                "understanding": row.get("understanding"),
                "stress": row.get("stress"),
                "duration_minutes": row.get("duration_minutes"),
                "committed_at": row.get("committed_at"),
            }
        )

    return {
        "total_sessions": total_sessions,
        "total_minutes": total_minutes,
        "streak_days": streak_days,
        "sessions_per_method": sessions_per_method,
        "method_distribution": method_distribution,
        "recent_understanding": understanding_all[-TREND_WINDOW:],
        "recent_stress": stress_all[-TREND_WINDOW:],
        "mean_understanding": _mean(understanding_all),
        "mean_stress": _mean(stress_all),
        "recent_sessions": recent_sessions,
    }


# --- v0.5.0 / 8D step-evaluation analytics --------------------------------

# Step gaps longer than this are excluded from ``time_seconds_per_step``:
# any pause longer than 2h almost certainly reflects the learner walking
# away from the screen, not "time spent on the step". Clamping prevents a
# single overnight session from dominating the per-step averages.
_MAX_STEP_GAP_SECONDS = 2 * 60 * 60


def _empty_step_eval_aggregate() -> dict[str, Any]:
    """Shape returned when no evaluations exist yet.

    Matches the populated shape's keys so the frontend can read
    every field without conditional ``?? 0`` everywhere — empty
    state is just "all-zeros".
    """
    return {
        "total_evaluations": 0,
        "average_confidence": 0.0,
        "advance_count": 0,
        "repeat_count": 0,
        "backward_count": 0,
        "fallback_count": 0,
        "evaluations_per_step": {},
        "time_seconds_per_step": {},
    }


def aggregate_step_evaluations(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the step_evaluation namespace slice from one project's
    evaluation rows.

    Caller responsibility: pre-filter to one project (via the
    StepEvaluation -> LearningSession -> LearningProject join) so
    the aggregator never crosses project boundaries.

    Each row carries:
      - id, session_id (str)
      - from_step, to_step (int)
      - advance, applied, fallback_used (bool)
      - confidence (float in [0, 1])
      - reason (str)
      - evaluated_at (ISO-8601 string OR ``datetime``)

    Returns:
      total_evaluations:       overall count
      average_confidence:      mean across all rows, rounded to 4 dp
      advance_count:           applied=True ∧ to_step > from_step
      repeat_count:            applied=False  ("AI said not ready")
      backward_count:          applied=True ∧ to_step < from_step
      fallback_count:          fallback_used=True (audit signal)
      evaluations_per_step:    {step → count of evaluations from
                                that step}; useful for "where do
                                learners spend most messages?"
      time_seconds_per_step:   {step → total seconds spent on that
                                step across all sessions for the
                                project}. Computed from per-
                                session timestamp deltas; long
                                pauses (>2h) excluded. Sum, not
                                average — divide by
                                evaluations_per_step downstream
                                if you want per-message mean.
    """
    if not rows:
        return _empty_step_eval_aggregate()

    confidences: list[float] = []
    advance_count = 0
    repeat_count = 0
    backward_count = 0
    fallback_count = 0
    evaluations_per_step: dict[int, int] = {}
    by_session: dict[str, list[dict[str, Any]]] = {}

    for r in rows:
        # Confidence is the most important signal — clamp + collect.
        c = r.get("confidence")
        if isinstance(c, (int, float)):
            confidences.append(float(c))

        applied = bool(r.get("applied"))
        from_step = r.get("from_step")
        to_step = r.get("to_step")
        if applied and isinstance(from_step, int) and isinstance(to_step, int):
            if to_step > from_step:
                advance_count += 1
            elif to_step < from_step:
                backward_count += 1
            # to_step == from_step (repeat-applied) folded into
            # repeat_count to keep the dashboard categories
            # mutually exclusive.
        if not applied:
            repeat_count += 1
        if r.get("fallback_used"):
            fallback_count += 1

        if isinstance(from_step, int):
            evaluations_per_step[from_step] = (
                evaluations_per_step.get(from_step, 0) + 1
            )

        sid = r.get("session_id")
        if isinstance(sid, str):
            by_session.setdefault(sid, []).append(r)

    # Time per step: walk each session's rows in evaluated_at
    # order, attribute the gap between consecutive evaluations to
    # the FROM step of the earlier evaluation. This means a
    # session that sits on step 2 for three messages credits all
    # the elapsed-time gaps to step 2.
    time_seconds_per_step: dict[int, float] = {}
    for session_rows in by_session.values():
        ordered = sorted(
            session_rows,
            key=lambda r: _parse_iso_datetime(r.get("evaluated_at"))
            or datetime.min.replace(tzinfo=UTC),
        )
        for i in range(1, len(ordered)):
            prev = ordered[i - 1]
            curr = ordered[i]
            prev_ts = _parse_iso_datetime(prev.get("evaluated_at"))
            curr_ts = _parse_iso_datetime(curr.get("evaluated_at"))
            if prev_ts is None or curr_ts is None:
                continue
            delta = (curr_ts - prev_ts).total_seconds()
            if delta <= 0 or delta > _MAX_STEP_GAP_SECONDS:
                continue
            step = prev.get("from_step")
            if isinstance(step, int):
                time_seconds_per_step[step] = (
                    time_seconds_per_step.get(step, 0.0) + delta
                )

    return {
        "total_evaluations": len(rows),
        "average_confidence": _mean(confidences),
        "advance_count": advance_count,
        "repeat_count": repeat_count,
        "backward_count": backward_count,
        "fallback_count": fallback_count,
        "evaluations_per_step": evaluations_per_step,
        "time_seconds_per_step": {
            step: round(secs, 2) for step, secs in time_seconds_per_step.items()
        },
    }
