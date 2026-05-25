"""Per-topic folder stub README.md generator (Phase 42 / BL-30 commit 3).

Each TopicSlice from ``RenderContext.topics`` becomes one
numbered folder under the project repo root. Folder names use
the same ``NN_slug`` convention as ``meta.readme._topic_folder_name``
so the parent README's links resolve.

This commit ships stub READMEs only — the per-folder
``concepts.md`` / ``tasks.md`` / ``solutions.md`` triplet from
Article 3 is deferred to a follow-up item (see backlog "Out
of scope for v1.26.0"). Validate the foundation first.
"""

from __future__ import annotations

from .context import RenderContext, TopicSlice
from .labels import Labels
from .meta.readme import _topic_folder_name


def render_topic_folders(
    ctx: RenderContext,
    labels: Labels,
) -> dict[str, str]:
    """Return ``{folder_path: stub_readme_content}`` for every topic.

    Empty when ``ctx.topics`` is empty (free-form projects, no
    ``cycle_topics`` history).
    """

    folders: dict[str, str] = {}
    for topic in ctx.topics:
        folder = _topic_folder_name(topic.order, topic.title)
        path = f"{folder}/README.md"
        folders[path] = _render_topic_stub(topic, labels)
    return folders


def _render_topic_stub(topic: TopicSlice, labels: Labels) -> str:
    """Single topic folder's stub README."""

    lines: list[str] = [
        f"# {labels.topic_readme_title.format(title=topic.title)}",
        "",
        labels.topic_readme_parent_link,
        "",
        f"## {labels.topic_readme_sessions_heading}",
        "",
    ]
    if topic.session_ids:
        for session_id in topic.session_ids:
            lines.append(f"- `{session_id[:8]}`")
    else:
        lines.append(labels.topic_readme_no_sessions)
    lines.extend(["", f"## {labels.topic_readme_methods_heading}", ""])
    if topic.methods:
        for method in topic.methods:
            lines.append(f"- {method}")
    else:
        lines.append("—")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"
