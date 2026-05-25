"""RenderContext: the dataclass every render function consumes.

Building the context up-front (once per render) lets each
meta-file generator be a pure str-returning function that can
be unit-tested in isolation without reconstructing the DB. The
orchestrator (``renderer.render_repository``) is the only piece
that touches the DB; the meta-file generators read only the
context.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Type-only imports — keeping ``app.models`` out of the
    # module-import path means plugin smoke tests (which run
    # under the backend's Python but don't expose ``app/`` on
    # sys.path for collection) can load this module without
    # triggering a ModuleNotFoundError. Matches the lazy-import
    # pattern used by anki/notebooklm.
    from app.models import (
        LearningProject,
        LearningSession,
        MethodSwitch,
        SessionNote,
        SessionRating,
        StepEvaluation,
    )


@dataclass(frozen=True)
class TopicSlice:
    """One distinct subtopic the project's sessions traversed.

    ``order`` is the appearance order across the project's
    sessions (oldest first). ``title`` is the canonical topic
    string from ``LearningSession.cycle_topics``. ``session_ids``
    pin the sessions that touched it; ``methods`` is the set of
    methods used (preserving first-appearance order).
    """

    order: int
    title: str
    session_ids: tuple[str, ...]
    methods: tuple[str, ...]


@dataclass(frozen=True)
class RenderContext:
    """Everything the meta-file generators read.

    Loaded once per render by ``renderer.load_context`` (sync,
    no AI). Frozen so render functions can't accidentally
    mutate it; readability vs perf is the right trade-off here
    because rendering is user-triggered, not hot-path.
    """

    project: LearningProject
    sessions: tuple[LearningSession, ...]
    ratings: tuple[SessionRating, ...]
    step_evaluations: tuple[StepEvaluation, ...]
    method_switches: tuple[MethodSwitch, ...]
    notes: tuple[SessionNote, ...]
    topics: tuple[TopicSlice, ...]
    rendered_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    # --- session-keyed views -------------------------------------------

    def ratings_for(self, session_id: str) -> list[SessionRating]:
        return [r for r in self.ratings if r.session_id == session_id]

    def latest_rating(self, session_id: str) -> SessionRating | None:
        rs = self.ratings_for(session_id)
        return rs[-1] if rs else None

    def notes_for(self, session_id: str) -> list[SessionNote]:
        return [n for n in self.notes if n.session_id == session_id]

    def step_evals_for(self, session_id: str) -> list[StepEvaluation]:
        return [e for e in self.step_evaluations if e.session_id == session_id]

    # --- kind-keyed views (cheatsheet) ----------------------------------

    def notes_by_kind(self, kind: str) -> list[SessionNote]:
        return [n for n in self.notes if n.kind == kind]

    # --- method aggregates ---------------------------------------------

    def method_distribution(self) -> dict[str, int]:
        """Count of sessions per method."""
        dist: dict[str, int] = {}
        for s in self.sessions:
            dist[s.method] = dist.get(s.method, 0) + 1
        return dist


# --- topic-derivation helper ------------------------------------------


def derive_topics(sessions: tuple[LearningSession, ...]) -> tuple[TopicSlice, ...]:
    """Build TopicSlice tuple from sessions' ``cycle_topics`` JSON.

    Each session's ``cycle_topics`` column is a JSON array of
    per-cycle ``{topic, summary}`` objects written by the v1.4.0
    auto-loop. Distinct topic strings become numbered slices in
    order of first appearance across the session timeline
    (oldest started_at first).

    Sessions whose ``cycle_topics`` is empty or malformed are
    skipped silently — they contribute their method/id to the
    "free-form" bucket via the readme but don't create a topic
    slice.
    """

    ordered_titles: list[str] = []
    title_to_sessions: dict[str, list[str]] = {}
    title_to_methods: dict[str, list[str]] = {}

    for session in sorted(sessions, key=lambda s: s.started_at):
        try:
            cycles = json.loads(session.cycle_topics or "[]")
        except (ValueError, TypeError):
            continue
        if not isinstance(cycles, list):
            continue
        for cycle in cycles:
            if not isinstance(cycle, dict):
                continue
            title = cycle.get("topic")
            if not isinstance(title, str) or not title.strip():
                continue
            title = title.strip()
            if title not in title_to_sessions:
                ordered_titles.append(title)
                title_to_sessions[title] = []
                title_to_methods[title] = []
            if session.id not in title_to_sessions[title]:
                title_to_sessions[title].append(session.id)
            if session.method not in title_to_methods[title]:
                title_to_methods[title].append(session.method)

    return tuple(
        TopicSlice(
            order=i + 1,
            title=title,
            session_ids=tuple(title_to_sessions[title]),
            methods=tuple(title_to_methods[title]),
        )
        for i, title in enumerate(ordered_titles)
    )
