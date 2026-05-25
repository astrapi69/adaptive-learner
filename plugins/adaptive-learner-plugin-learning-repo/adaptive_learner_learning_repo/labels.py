"""User-facing strings for the rendered repository (Phase 42 / BL-30).

Commit 3 ships English defaults inline. Commit 7 swaps the
:func:`labels_for` factory to read from
``backend/config/i18n/{lang}.yaml`` under the ``repo.*``
namespace, keyed by the dataclass field names (e.g.
``repo.readme.title``). The dataclass shape stays stable
across that swap so callers don't change.

Keeping every user-visible string in one dataclass means the
renderer functions can be unit-tested with a custom Labels
fixture (override one field, assert it lands in the output)
without touching i18n machinery.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Labels:
    """Every string the renderer emits, grouped by meta-file."""

    # README.md
    readme_title: str = "Learning Project: {topic}"
    readme_goal_heading: str = "Goal"
    readme_status_heading: str = "Status"
    readme_active: str = "active"
    readme_archived: str = "archived"
    readme_progress_heading: str = "Progress"
    readme_sessions_label: str = "Sessions"
    readme_cycles_label: str = "Cycles"
    readme_method_distribution_heading: str = "Method distribution"
    readme_topics_heading: str = "Topics"
    readme_no_topics: str = "_No topics traversed yet._"
    readme_see_also_heading: str = "See also"
    readme_see_stats: str = "[LEARNING_STATS.md](LEARNING_STATS.md) — error rates, understanding, transfer, intervention log."
    readme_see_cheatsheet: str = (
        "[CHEATSHEET.md](CHEATSHEET.md) — distilled notes + Meta-Learning Insights."
    )
    readme_see_roadmap: str = "[ROADMAP.md](ROADMAP.md) — next steps."

    # LEARNING_STATS.md
    stats_title: str = "Learning Statistics"
    stats_intro: str = (
        "Per-session metrics derived from `step_evaluations`, "
        "`session_ratings`, and `method_switches`. Generated "
        "automatically — do not edit by hand."
    )
    stats_no_sessions: str = "_No sessions yet._"
    stats_sessions_heading: str = "Sessions"
    stats_table_session: str = "Session"
    stats_table_method: str = "Method"
    stats_table_understanding: str = "Understanding"
    stats_table_transfer: str = "Transfer"
    stats_table_stress: str = "Stress"
    stats_table_cycles: str = "Cycles"
    stats_table_status: str = "Status"
    stats_method_switches_heading: str = "Method switches"
    stats_no_method_switches: str = "_No method switches recorded._"
    stats_table_from: str = "From"
    stats_table_to: str = "To"
    stats_table_reason: str = "Reason"
    stats_table_when: str = "When"
    stats_exit_threshold_heading: str = "Exit thresholds"
    stats_exit_threshold_body: str = (
        "Per the *Von Theorie zur Praxis* Article 1 § 8: a topic "
        "is considered mastered when Understanding ≥ 9/10 AND "
        "Transfer ≥ 8/10 stable over 2 consecutive cycles. The "
        "renderer pins the corresponding session row when both "
        "conditions hold."
    )
    stats_exit_pin_marker: str = "✅ exit threshold met"

    # CHEATSHEET.md
    cheatsheet_title: str = "Cheatsheet"
    cheatsheet_intro: str = (
        "Distilled notes from your sessions. The "
        "**Meta-Learning Insights** section collects notes tagged "
        '`kind="meta_learning"` — observations about *how* you '
        "learn best (per the Article-3 pattern)."
    )
    cheatsheet_notes_heading: str = "Notes"
    cheatsheet_meta_learning_heading: str = "Meta-Learning Insights"
    cheatsheet_no_notes: str = "_No notes yet._"
    cheatsheet_no_meta_learning: str = (
        "_No meta-learning insights yet. Add a `SessionNote` with "
        '`kind="meta_learning"` to record an observation about '
        "your learning process._"
    )

    # ROADMAP.md
    roadmap_title: str = "Roadmap"
    roadmap_intro: str = "Open topics + recommended next steps."
    roadmap_next_steps_heading: str = "Next steps"
    roadmap_no_next_steps: str = "_No active project — start a new session to populate this list._"
    roadmap_resume_active: str = (
        "Resume the active session (method: **{method}**, step {step}/7, cycle {cycle})."
    )
    roadmap_start_first: str = (
        "Start your first learning session — the assessment "
        "recommends starting with method **{method}**."
    )
    roadmap_start_next: str = (
        "Start the next session — last completed session used method **{method}**."
    )
    roadmap_open_topics_heading: str = "Open topics"
    roadmap_no_open_topics: str = "_No topics defined yet._"

    # Topic folder stub README.md
    topic_readme_title: str = "Topic: {title}"
    topic_readme_sessions_heading: str = "Sessions on this topic"
    topic_readme_methods_heading: str = "Methods used"
    topic_readme_parent_link: str = "← [Project root](../README.md)"
    topic_readme_no_sessions: str = "_No sessions traversed this topic._"


def labels_for(language: str) -> Labels:
    """Return the Labels bundle for ``language``.

    Commit 3 ignores ``language`` and always returns the English
    defaults — the function signature pins the eventual i18n
    contract so commit 7 can swap the implementation without
    touching callers.
    """

    # Commit 7 will read backend/config/i18n/{language}.yaml under
    # the repo.* namespace and build a Labels instance from it.
    _ = language  # acknowledged; not yet consumed
    return Labels()
