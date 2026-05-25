"""README.md generator for the learning-repo renderer."""

from __future__ import annotations

from ..context import RenderContext
from ..labels import Labels


def render_readme(ctx: RenderContext, labels: Labels) -> str:
    """Render the project's top-level README.md."""

    lines: list[str] = [
        f"# {labels.readme_title.format(topic=ctx.project.topic)}",
        "",
        f"## {labels.readme_goal_heading}",
        "",
        ctx.project.goal,
        "",
        f"## {labels.readme_status_heading}",
        "",
        labels.readme_active if ctx.project.active else labels.readme_archived,
        "",
        f"## {labels.readme_progress_heading}",
        "",
        f"- {labels.readme_sessions_label}: {len(ctx.sessions)}",
        f"- {labels.readme_cycles_label}: {sum(s.cycle_count for s in ctx.sessions)}",
        "",
    ]
    lines.extend(_method_distribution_block(ctx, labels))
    lines.extend(_topics_block(ctx, labels))
    lines.extend(_see_also_block(labels))
    return "\n".join(lines).rstrip() + "\n"


def _method_distribution_block(ctx: RenderContext, labels: Labels) -> list[str]:
    dist = ctx.method_distribution()
    if not dist:
        return []
    lines = [f"## {labels.readme_method_distribution_heading}", ""]
    for method in sorted(dist, key=lambda m: (-dist[m], m)):
        lines.append(f"- **{method}**: {dist[method]}")
    lines.append("")
    return lines


def _topics_block(ctx: RenderContext, labels: Labels) -> list[str]:
    lines = [f"## {labels.readme_topics_heading}", ""]
    if not ctx.topics:
        lines.extend([labels.readme_no_topics, ""])
        return lines
    for topic in ctx.topics:
        folder = _topic_folder_name(topic.order, topic.title)
        lines.append(f"- [{topic.title}]({folder}/README.md)")
    lines.append("")
    return lines


def _see_also_block(labels: Labels) -> list[str]:
    return [
        f"## {labels.readme_see_also_heading}",
        "",
        f"- {labels.readme_see_stats}",
        f"- {labels.readme_see_cheatsheet}",
        f"- {labels.readme_see_roadmap}",
        "",
    ]


def _topic_folder_name(order: int, title: str) -> str:
    """Numbered phase folder name per Article-3 convention.

    Form: ``NN_slug`` where ``NN`` is the zero-padded order and
    ``slug`` is the lowercased title with non-alphanumeric chars
    collapsed to underscores. Lossy by design — the folder name
    is a navigation aid, not the source of truth.
    """

    slug_chars = [c.lower() if c.isalnum() else "_" for c in title]
    slug = "".join(slug_chars).strip("_") or "topic"
    # Collapse runs of underscores.
    while "__" in slug:
        slug = slug.replace("__", "_")
    return f"{order:02d}_{slug}"
