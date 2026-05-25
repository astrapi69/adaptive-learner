"""Renderer unit tests — pure context input, no DB.

DB-touching integration tests live in
``backend/tests/test_learning_repo_plugin_integration.py``
(commit 4 of the BL-30 chain).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from adaptive_learner_learning_repo.context import RenderContext, derive_topics
from adaptive_learner_learning_repo.labels import Labels, labels_for
from adaptive_learner_learning_repo.meta import (
    render_cheatsheet,
    render_readme,
    render_roadmap,
    render_stats,
)
from adaptive_learner_learning_repo.renderer import render_from_context
from adaptive_learner_learning_repo.topic_folders import render_topic_folders

# --- Helpers --------------------------------------------------------------


def _proj(topic: str = "Docker", goal: str = "QA setups", active: bool = True):
    return SimpleNamespace(
        id="p-1",
        topic=topic,
        goal=goal,
        active=active,
    )


def _session(
    sid: str,
    method: str,
    *,
    started: datetime,
    status: str = "completed",
    cycle_step: int = 7,
    cycle_count: int = 1,
    cycle_topics: str = "[]",
):
    return SimpleNamespace(
        id=sid,
        project_id="p-1",
        method=method,
        started_at=started,
        ended_at=started + timedelta(minutes=30),
        cycle_step=cycle_step,
        status=status,
        cycle_count=cycle_count,
        cycle_topics=cycle_topics,
    )


def _rating(sid: str, *, understanding: int, stress: int, method_fit: int):
    return SimpleNamespace(
        id=f"r-{sid}",
        session_id=sid,
        understanding=understanding,
        stress=stress,
        method_fit=method_fit,
        notes=None,
        created_at=datetime(2026, 5, 25, 10, 0, 0),
    )


def _note(sid: str, content: str, kind: str = "note", *, created: datetime | None = None):
    return SimpleNamespace(
        id=f"n-{sid}-{kind}",
        session_id=sid,
        content=content,
        kind=kind,
        created_at=created or datetime(2026, 5, 25, 11, 0, 0),
        updated_at=created or datetime(2026, 5, 25, 11, 0, 0),
    )


def _switch(from_method: str, to_method: str, reason: str, when: datetime):
    return SimpleNamespace(
        id="ms-1",
        project_id="p-1",
        from_method=from_method,
        to_method=to_method,
        reason=reason,
        switched_at=when,
    )


def _ctx(
    *,
    project=None,
    sessions=(),
    ratings=(),
    notes=(),
    method_switches=(),
    topics=None,
) -> RenderContext:
    proj = project or _proj()
    return RenderContext(
        project=proj,
        sessions=tuple(sessions),
        ratings=tuple(ratings),
        step_evaluations=(),
        method_switches=tuple(method_switches),
        notes=tuple(notes),
        topics=tuple(topics) if topics is not None else derive_topics(tuple(sessions)),
    )


# --- labels --------------------------------------------------------------


def test_labels_for_returns_english_defaults_in_commit_3():
    labels = labels_for("en")
    assert labels.readme_active == "active"
    assert "Learning Statistics" in labels.stats_title


def test_labels_for_accepts_unknown_language_returns_english_for_now():
    """Commit 3: language is acknowledged but always returns
    English. Commit 7 will swap this to a YAML-driven lookup."""
    labels = labels_for("xx-XX-unknown")
    assert labels.readme_active == "active"


# --- README.md ----------------------------------------------------------


def test_readme_lists_topic_goal_and_status():
    ctx = _ctx(project=_proj(topic="Docker", goal="Multi-container QA"))
    out = render_readme(ctx, Labels())
    assert "# Learning Project: Docker" in out
    assert "Multi-container QA" in out
    assert "active" in out


def test_readme_method_distribution_orders_by_count_then_name():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", "deductive", started=base),
        _session("s2", "deductive", started=base + timedelta(hours=1)),
        _session("s3", "inductive", started=base + timedelta(hours=2)),
    ]
    out = render_readme(_ctx(sessions=sessions), Labels())
    # deductive (2) comes before inductive (1).
    assert out.index("**deductive**") < out.index("**inductive**")


def test_readme_links_to_topic_folders_when_topics_exist():
    base = datetime(2026, 5, 20, 9, 0, 0)
    cycle_json = '[{"topic": "Volumes", "summary": "ok"}]'
    sessions = [_session("s1", "deductive", started=base, cycle_topics=cycle_json)]
    out = render_readme(_ctx(sessions=sessions), Labels())
    assert "[Volumes](01_volumes/README.md)" in out


def test_readme_shows_empty_topics_marker_when_no_cycle_topics():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", "deductive", started=base)]  # cycle_topics defaults to "[]"
    out = render_readme(_ctx(sessions=sessions), Labels())
    assert "_No topics traversed yet._" in out


def test_readme_status_marks_archived_project():
    out = render_readme(_ctx(project=_proj(active=False)), Labels())
    assert "archived" in out


# --- LEARNING_STATS.md --------------------------------------------------


def test_stats_no_sessions_message():
    out = render_stats(_ctx(), Labels())
    assert "_No sessions yet._" in out


def test_stats_table_scales_ratings_to_out_of_ten():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", "deductive", started=base)]
    ratings = [_rating("s1", understanding=5, stress=2, method_fit=4)]
    out = render_stats(_ctx(sessions=sessions, ratings=ratings), Labels())
    # 5 understanding * 2 == 10 of 10. 4 method_fit * 2 == 8 of 10. 2 stress * 2 == 4 of 10.
    assert "10/10" in out  # understanding
    assert "8/10" in out  # method_fit (transfer)
    assert "4/10" in out  # stress


def test_stats_pins_exit_threshold_when_two_consecutive_sessions_pass():
    """Article 1 § 8 — Understanding ≥ 9/10 AND Transfer ≥ 8/10
    stable over 2 cycles. Pin on the SECOND consecutive session."""
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", "ai_adaptive", started=base),
        _session("s2", "ai_adaptive", started=base + timedelta(hours=1)),
    ]
    ratings = [
        _rating("s1", understanding=5, stress=1, method_fit=4),  # 10/10, 8/10
        _rating("s2", understanding=5, stress=1, method_fit=5),  # 10/10, 10/10
    ]
    out = render_stats(_ctx(sessions=sessions, ratings=ratings), Labels())
    assert out.count("exit threshold met") == 1  # only s2 gets pinned


def test_stats_does_not_pin_when_single_session_meets_bar():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [_session("s1", "ai_adaptive", started=base)]
    ratings = [_rating("s1", understanding=5, stress=1, method_fit=5)]
    out = render_stats(_ctx(sessions=sessions, ratings=ratings), Labels())
    assert "exit threshold met" not in out


def test_stats_method_switch_table_renders_rows():
    when = datetime(2026, 5, 20, 9, 0, 0)
    out = render_stats(
        _ctx(method_switches=[_switch("deductive", "ai_adaptive", "stagnation", when)]),
        Labels(),
    )
    assert "deductive" in out
    assert "ai_adaptive" in out
    assert "stagnation" in out
    assert "2026-05-20" in out


def test_stats_method_switch_reason_escapes_pipe_and_newline():
    when = datetime(2026, 5, 20, 9, 0, 0)
    reason = "fail|over\nnewline"
    out = render_stats(
        _ctx(method_switches=[_switch("a", "b", reason, when)]),
        Labels(),
    )
    assert "\\|" in out
    # Newlines collapsed to space inside the table row.
    assert "over newline" in out


# --- CHEATSHEET.md ------------------------------------------------------


def test_cheatsheet_empty_state_pins_meta_learning_call_to_action():
    out = render_cheatsheet(_ctx(), Labels())
    assert "_No notes yet._" in out
    assert 'kind=\\"meta_learning\\"' in out or 'kind="meta_learning"' in out


def test_cheatsheet_lists_default_kind_notes_in_notes_section():
    note = _note("s1", "Use docker compose down -v to wipe volumes.")
    out = render_cheatsheet(_ctx(notes=[note]), Labels())
    assert "Use docker compose down -v to wipe volumes." in out


def test_cheatsheet_dedupes_repeated_note_content_case_insensitive():
    notes = [
        _note("s1", "Drill clears repetition errors fast.", created=datetime(2026, 5, 20, 9, 0)),
        _note("s2", "drill clears repetition errors fast.", created=datetime(2026, 5, 20, 10, 0)),
    ]
    out = render_cheatsheet(_ctx(notes=notes), Labels())
    # The earlier one wins (sorted by created_at); only one bullet survives.
    assert out.count("Drill clears repetition errors fast.") == 1


def test_cheatsheet_splits_meta_learning_into_its_own_section():
    notes = [
        _note("s1", "A regular note.", kind="note"),
        _note(
            "s2",
            "Drill eliminates persistent errors faster than general practice.",
            kind="meta_learning",
        ),
    ]
    out = render_cheatsheet(_ctx(notes=notes), Labels())
    notes_section_idx = out.index("## Notes")
    meta_section_idx = out.index("## Meta-Learning Insights")
    assert notes_section_idx < meta_section_idx
    # The meta note is under the meta section, not the notes section.
    assert out.index("Drill eliminates") > meta_section_idx
    assert out.index("A regular note.") > notes_section_idx
    assert out.index("A regular note.") < meta_section_idx


def test_cheatsheet_flattens_multiline_note_to_single_bullet():
    note = _note("s1", "line one\n\nline two\nline three")
    out = render_cheatsheet(_ctx(notes=[note]), Labels())
    assert "- line one line two line three" in out


# --- ROADMAP.md ---------------------------------------------------------


def test_roadmap_no_sessions_returns_empty_state_with_call_to_action():
    out = render_roadmap(_ctx(), Labels())
    assert "_No active project" in out


def test_roadmap_resume_active_when_active_session_exists():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", "ai_adaptive", started=base, status="active", cycle_step=3, cycle_count=2),
    ]
    out = render_roadmap(_ctx(sessions=sessions), Labels())
    assert "Resume the active session" in out
    assert "ai_adaptive" in out
    assert "step 3/7" in out


def test_roadmap_suggests_next_session_using_last_completed_method():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = [
        _session("s1", "deductive", started=base, status="completed"),
        _session("s2", "inductive", started=base + timedelta(hours=1), status="completed"),
    ]
    out = render_roadmap(_ctx(sessions=sessions), Labels())
    assert "last completed session used" in out
    assert "**inductive**" in out


def test_roadmap_lists_open_topics_with_session_counts_and_methods():
    base = datetime(2026, 5, 20, 9, 0, 0)
    cycle_json = '[{"topic": "Volumes", "summary": "ok"}]'
    sessions = [
        _session("s1", "deductive", started=base, cycle_topics=cycle_json),
        _session("s2", "ai_adaptive", started=base + timedelta(hours=1), cycle_topics=cycle_json),
    ]
    out = render_roadmap(_ctx(sessions=sessions), Labels())
    assert "**Volumes**" in out
    assert "2 sessions" in out
    assert "deductive" in out
    assert "ai_adaptive" in out


# --- Topic folders ------------------------------------------------------


def test_topic_folders_empty_when_no_topics():
    folders = render_topic_folders(_ctx(), Labels())
    assert folders == {}


def test_topic_folders_numbers_and_slugifies_titles():
    base = datetime(2026, 5, 20, 9, 0, 0)
    cycle_json = '[{"topic": "Docker Compose & Networks", "summary": "ok"}]'
    sessions = [_session("s1", "deductive", started=base, cycle_topics=cycle_json)]
    folders = render_topic_folders(_ctx(sessions=sessions), Labels())
    # "Docker Compose & Networks" -> "docker_compose_networks"
    assert "01_docker_compose_networks/README.md" in folders


def test_topic_folder_stub_links_back_to_parent_and_lists_sessions():
    base = datetime(2026, 5, 20, 9, 0, 0)
    cycle_json = '[{"topic": "Volumes", "summary": "ok"}]'
    sessions = [_session("s1aaaaaaaa", "deductive", started=base, cycle_topics=cycle_json)]
    folders = render_topic_folders(_ctx(sessions=sessions), Labels())
    stub = folders["01_volumes/README.md"]
    assert "# Topic: Volumes" in stub
    assert "[Project root](../README.md)" in stub
    assert "`s1aaaaaa`" in stub  # short id, 8 chars
    assert "deductive" in stub


# --- derive_topics ------------------------------------------------------


def test_derive_topics_preserves_first_appearance_order():
    base = datetime(2026, 5, 20, 9, 0, 0)
    s_old = _session(
        "s_old",
        "deductive",
        started=base,
        cycle_topics='[{"topic": "Volumes"}]',
    )
    s_new = _session(
        "s_new",
        "ai_adaptive",
        started=base + timedelta(hours=1),
        cycle_topics='[{"topic": "Networks"}, {"topic": "Volumes"}]',
    )
    topics = derive_topics((s_new, s_old))  # unsorted input
    assert [t.title for t in topics] == ["Volumes", "Networks"]
    assert topics[0].order == 1
    assert topics[1].order == 2


def test_derive_topics_skips_malformed_cycle_topics_silently():
    base = datetime(2026, 5, 20, 9, 0, 0)
    sessions = (
        _session("s_bad_json", "deductive", started=base, cycle_topics="not json"),
        _session(
            "s_empty_topic",
            "deductive",
            started=base + timedelta(hours=1),
            cycle_topics='[{"topic": "  "}]',
        ),
        _session(
            "s_good",
            "deductive",
            started=base + timedelta(hours=2),
            cycle_topics='[{"topic": "Real Topic"}]',
        ),
    )
    topics = derive_topics(sessions)
    assert [t.title for t in topics] == ["Real Topic"]


# --- Orchestrator -------------------------------------------------------


def test_render_from_context_produces_expected_path_set():
    base = datetime(2026, 5, 20, 9, 0, 0)
    cycle_json = '[{"topic": "Volumes"}, {"topic": "Networks"}]'
    sessions = [_session("s1", "deductive", started=base, cycle_topics=cycle_json)]
    tree = render_from_context(_ctx(sessions=sessions))
    assert set(tree) == {
        "README.md",
        "LEARNING_STATS.md",
        "CHEATSHEET.md",
        "ROADMAP.md",
        "01_volumes/README.md",
        "02_networks/README.md",
    }


def test_render_from_context_minimal_project_has_only_root_meta_files():
    tree = render_from_context(_ctx())
    assert set(tree) == {"README.md", "LEARNING_STATS.md", "CHEATSHEET.md", "ROADMAP.md"}


def test_render_from_context_topic_folder_referenced_in_readme_matches_returned_path():
    base = datetime(2026, 5, 20, 9, 0, 0)
    cycle_json = '[{"topic": "Volumes"}]'
    sessions = [_session("s1", "deductive", started=base, cycle_topics=cycle_json)]
    tree = render_from_context(_ctx(sessions=sessions))
    # The README's link target MUST be a key in the returned tree.
    assert "01_volumes/README.md" in tree
    assert "[Volumes](01_volumes/README.md)" in tree["README.md"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
