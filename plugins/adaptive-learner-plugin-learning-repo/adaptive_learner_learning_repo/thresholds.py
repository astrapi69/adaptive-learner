"""Article-1 § 8 exit-threshold logic — single source of truth.

Both the LEARNING_STATS.md generator and the git-tagger consume
this module. Lifting the logic out of ``meta/stats.py`` keeps
the contract honest: when the stats-table pin says "this row
crossed the bar", the git tag on that same render fires for
the same reason.

The threshold (per Article 1 § 8 of *Von Theorie zur Praxis*):
**Understanding ≥ 9/10 AND Transfer ≥ 8/10 stable over 2
consecutive cycles.** ``SessionRating.understanding`` and
``method_fit`` are stored 1–5; the renderer scales ×2 to /10.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .context import RenderContext

# Per-session bar — must hold for THIS session AND the
# immediately preceding session for the row to be pinned.
UNDERSTANDING_OUT_OF_TEN_MIN = 9
TRANSFER_OUT_OF_TEN_MIN = 8


def meets_per_session_bar(session_id: str, ctx: RenderContext) -> bool:
    """True iff the latest rating on ``session_id`` clears the
    per-session understanding + transfer bar."""

    rating = ctx.latest_rating(session_id)
    if rating is None:
        return False
    understanding_ten = rating.understanding * 2
    transfer_ten = rating.method_fit * 2
    return (
        understanding_ten >= UNDERSTANDING_OUT_OF_TEN_MIN
        and transfer_ten >= TRANSFER_OUT_OF_TEN_MIN
    )


def exit_threshold_indices(ctx: RenderContext) -> set[int]:
    """Indices into the started_at-sorted session list where the
    Article-1 § 8 exit threshold is met (this session AND the
    immediately preceding session both clear the per-session
    bar). Session 0 never qualifies — the "stable over 2
    cycles" rule needs a predecessor.
    """

    sessions = sorted(ctx.sessions, key=lambda s: s.started_at)
    pinned: set[int] = set()
    for i, session in enumerate(sessions):
        if i == 0:
            continue
        prev = sessions[i - 1]
        if meets_per_session_bar(session.id, ctx) and meets_per_session_bar(prev.id, ctx):
            pinned.add(i)
    return pinned


def latest_exit_threshold_cycle(ctx: RenderContext) -> int | None:
    """Position (1-indexed) of the most recent session where the
    exit threshold was reached, or ``None`` if no session
    qualifies. The git-tagger uses this to decide whether to
    fire a ``cycle-{N}-mastered`` tag at the current commit.
    """

    indices = exit_threshold_indices(ctx)
    if not indices:
        return None
    return max(indices) + 1
