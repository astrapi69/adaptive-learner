"""Aggregator for ``get_progress_summary`` + the GET
``/progress`` endpoint.

Returns the tracking plugin's slice under its own namespace key
so other plugins can stack their own slices in the same response
without colliding::

    {
        "tracking": {
            "total_sessions":              int,
            "sessions_per_method":         {method: count},
            "recent_understanding":        list[float],   # last 5, oldest first
            "recent_stress":               list[float],   # last 5, oldest first
            "mean_understanding":          float,
            "mean_stress":                 float,
        }
    }

A future ``stagnation`` plugin can produce its own slice via the
``get_progress_summary`` hook; the dispatch is list-mode so every
plugin's dict appears in the aggregator result; the route shallow-
merges them.
"""

from __future__ import annotations

from typing import Any

NAMESPACE = "tracking"
TREND_WINDOW = 5


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def aggregate(commits: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the tracking-namespace slice from a sequence of
    ProgressCommit row-dicts.

    ``commits`` is expected to be ordered by ``committed_at`` ASC
    (oldest first); the recent-trend slice takes the last
    :data:`TREND_WINDOW` entries from the tail.
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
    stress_all = [float(c["stress"]) for c in commits if isinstance(c.get("stress"), (int, float))]

    return {
        "total_sessions": len(commits),
        "sessions_per_method": sessions_per_method,
        "recent_understanding": understanding_all[-TREND_WINDOW:],
        "recent_stress": stress_all[-TREND_WINDOW:],
        "mean_understanding": _mean(understanding_all),
        "mean_stress": _mean(stress_all),
    }
