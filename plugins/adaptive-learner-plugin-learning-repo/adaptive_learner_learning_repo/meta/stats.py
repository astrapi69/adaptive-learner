"""LEARNING_STATS.md generator — the load-bearing meta-file.

Per Article 3's STATS.md example: per-cycle table of error
rate, understanding, transfer, method effectiveness, plus a
pin for sessions where the Article-1 § 8 exit threshold
(Understanding ≥ 9/10 AND Transfer ≥ 8/10 stable over 2
consecutive cycles) is met.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..context import RenderContext
from ..labels import Labels

if TYPE_CHECKING:
    # Annotation-only; see context.py for rationale.
    from app.models import LearningSession, SessionRating


def render_stats(ctx: RenderContext, labels: Labels) -> str:
    """Render LEARNING_STATS.md."""

    lines: list[str] = [
        f"# {labels.stats_title}",
        "",
        labels.stats_intro,
        "",
    ]
    lines.extend(_session_table(ctx, labels))
    lines.extend(_method_switch_table(ctx, labels))
    lines.extend(_exit_threshold_block(labels))
    return "\n".join(lines).rstrip() + "\n"


def _session_table(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.stats_sessions_heading}", ""]
    if not ctx.sessions:
        lines.extend([labels.stats_no_sessions, ""])
        return lines
    header = (
        f"| {labels.stats_table_session} "
        f"| {labels.stats_table_method} "
        f"| {labels.stats_table_understanding} "
        f"| {labels.stats_table_transfer} "
        f"| {labels.stats_table_stress} "
        f"| {labels.stats_table_cycles} "
        f"| {labels.stats_table_status} |"
    )
    lines.append(header)
    lines.append("|" + "---|" * 7)
    sessions_sorted = sorted(ctx.sessions, key=lambda s: s.started_at)
    exit_indices = _exit_threshold_indices(sessions_sorted, ctx)
    for index, session in enumerate(sessions_sorted):
        lines.append(_session_row(session, ctx, labels, index in exit_indices))
    lines.append("")
    return lines


def _session_row(
    session: LearningSession,
    ctx: RenderContext,
    labels: Labels,
    exit_met: bool,
) -> str:
    rating = ctx.latest_rating(session.id)
    understanding = _format_rating(rating, "understanding")
    transfer = _format_rating(rating, "method_fit")
    stress = _format_rating(rating, "stress")
    short_id = session.id[:8]
    status = session.status
    if exit_met:
        status = f"{session.status} {labels.stats_exit_pin_marker}"
    return (
        f"| `{short_id}` "
        f"| {session.method} "
        f"| {understanding} "
        f"| {transfer} "
        f"| {stress} "
        f"| {session.cycle_count} "
        f"| {status} |"
    )


def _format_rating(rating: SessionRating | None, field: str) -> str:
    if rating is None:
        return "—"
    # SessionRating scores are 1–5. Article 1 § 8 reasons in
    # /10. We scale the column display to /10 so the rendered
    # numbers match the exit-threshold contract everywhere in
    # this file.
    raw = getattr(rating, field)
    scaled = raw * 2
    return f"{scaled}/10"


def _exit_threshold_indices(
    sessions: list[LearningSession],
    ctx: RenderContext,
) -> set[int]:
    """Return indices of sessions that satisfy Article-1 § 8.

    Threshold: Understanding ≥ 9/10 AND Transfer ≥ 8/10 stable
    over 2 consecutive cycles. We approximate "stable over 2
    consecutive cycles" as "this session AND the immediately
    preceding session both meet the per-session bar."
    """

    pinned: set[int] = set()
    for i, session in enumerate(sessions):
        if i == 0:
            continue
        if _meets_threshold(session, ctx) and _meets_threshold(sessions[i - 1], ctx):
            pinned.add(i)
    return pinned


def _meets_threshold(session: LearningSession, ctx: RenderContext) -> bool:
    rating = ctx.latest_rating(session.id)
    if rating is None:
        return False
    return rating.understanding * 2 >= 9 and rating.method_fit * 2 >= 8


def _method_switch_table(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.stats_method_switches_heading}", ""]
    if not ctx.method_switches:
        lines.extend([labels.stats_no_method_switches, ""])
        return lines
    header = (
        f"| {labels.stats_table_from} "
        f"| {labels.stats_table_to} "
        f"| {labels.stats_table_reason} "
        f"| {labels.stats_table_when} |"
    )
    lines.append(header)
    lines.append("|" + "---|" * 4)
    for switch in sorted(ctx.method_switches, key=lambda s: s.switched_at):
        when = switch.switched_at.strftime("%Y-%m-%d")
        reason = switch.reason.replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {switch.from_method} | {switch.to_method} | {reason} | {when} |")
    lines.append("")
    return lines


def _exit_threshold_block(labels: Labels) -> list[str]:
    return [
        f"## {labels.stats_exit_threshold_heading}",
        "",
        labels.stats_exit_threshold_body,
        "",
    ]
