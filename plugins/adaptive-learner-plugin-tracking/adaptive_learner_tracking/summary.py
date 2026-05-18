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

from datetime import date, datetime, timezone
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
    streak_today = today if today is not None else datetime.now(timezone.utc).date()
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
