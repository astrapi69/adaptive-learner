"""ROADMAP.md generator.

Surfaces the immediate next-step recommendation (resume active
session / start first session / start next) plus the list of
topics already in flight. Curriculum-level future topics
(``LearningTopic`` rows not yet touched by any session) are NOT
included here in commit 3 because the data model doesn't link
``LearningProject`` to ``Curriculum`` directly — that surface
arrives if + when the cross-link lands.
"""

from __future__ import annotations

from ..context import RenderContext
from ..labels import Labels


def render_roadmap(ctx: RenderContext, labels: Labels) -> str:
    """Render ROADMAP.md."""

    lines: list[str] = [
        f"# {labels.roadmap_title}",
        "",
        labels.roadmap_intro,
        "",
    ]
    lines.extend(_next_steps_block(ctx, labels))
    lines.extend(_open_topics_block(ctx, labels))
    return "\n".join(lines).rstrip() + "\n"


def _next_steps_block(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.roadmap_next_steps_heading}", ""]
    suggestion = _suggest_next_step(ctx, labels)
    if suggestion is None:
        lines.extend([labels.roadmap_no_next_steps, ""])
        return lines
    lines.append(f"- {suggestion}")
    lines.append("")
    return lines


def _suggest_next_step(ctx: RenderContext, labels: Labels) -> str | None:
    """Pick the most actionable next-step suggestion."""

    active = _active_session(ctx)
    if active is not None:
        return labels.roadmap_resume_active.format(
            method=active.method,
            step=active.cycle_step,
            cycle=active.cycle_count,
        )
    last_completed = _last_completed_session(ctx)
    if last_completed is not None:
        return labels.roadmap_start_next.format(method=last_completed.method)
    if ctx.sessions:
        # All sessions abandoned, no active, no completed — fall
        # through to the "start first" suggestion using the
        # first session's method (best signal we have).
        first_method = min(ctx.sessions, key=lambda s: s.started_at).method
        return labels.roadmap_start_first.format(method=first_method)
    return None


def _active_session(ctx: RenderContext):
    return next(
        (s for s in ctx.sessions if s.status == "active"),
        None,
    )


def _last_completed_session(ctx: RenderContext):
    completed = [s for s in ctx.sessions if s.status == "completed"]
    if not completed:
        return None
    return max(completed, key=lambda s: s.ended_at or s.started_at)


def _open_topics_block(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.roadmap_open_topics_heading}", ""]
    if not ctx.topics:
        lines.extend([labels.roadmap_no_open_topics, ""])
        return lines
    for topic in ctx.topics:
        methods = ", ".join(topic.methods) if topic.methods else "-"
        lines.append(f"- **{topic.title}** ({len(topic.session_ids)} sessions; methods: {methods})")
    lines.append("")
    return lines
