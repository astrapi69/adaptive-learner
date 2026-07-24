"""TrackingPlugin - PluginForge entry point.

Implements two Phase-2 hookspecs:

- ``on_session_complete(session, rating)`` (side-effect): writes
  a ProgressCommit row via the :mod:`.commits` translator.
- ``get_progress_summary(project_id)``: returns the tracking
  namespace slice via :mod:`.summary`.

Plus two routes (``/progress``, ``/commits``) — see :mod:`.routes`.
"""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from . import commits as _commits
from . import summary as _summary

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class TrackingPlugin(BasePlugin):
    name = "tracking"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = "ProgressCommit writer on session-complete + dashboard summary aggregator."
    author = "Asterios Raptis"

    @hookimpl
    def on_session_complete(self, session: dict[str, Any], rating: dict[str, Any]) -> None:
        """Write the ProgressCommit row.

        Lazy imports of ``app.*`` keep the plugin class importable
        from the plugin's standalone test dir; the hook only fires
        in-process under the production app, where ``app.*`` is
        always available.
        """
        kwargs = _commits.build_commit_kwargs(session, rating)
        if kwargs is None:
            # Incomplete payload — log and skip rather than crash
            # the session-close call. The hookspec contract requires
            # subscriber errors to be non-blocking; quietly dropping
            # an unwritable row is the same shape.
            import logging

            logging.getLogger(__name__).warning(
                "tracking.on_session_complete: incomplete payload, "
                "skipping ProgressCommit write. session=%r rating=%r",
                session,
                rating,
            )
            return

        from app.database import SessionLocal
        from app.models import ProgressCommit

        db = SessionLocal()
        try:
            db.add(ProgressCommit(**kwargs))
            db.commit()
        finally:
            db.close()

    @hookimpl
    def get_progress_summary(self, project_id: str) -> dict[str, Any]:
        """Return this plugin's namespace slices.

        v0.4.0: ``tracking`` slice from ``ProgressCommit`` rows.
        v0.5.0: ``step_evaluation`` slice from ``StepEvaluation``
        rows joined to ``LearningSession`` so the aggregator only
        sees rows belonging to this project's sessions.
        """
        from app.database import SessionLocal
        from app.models import LearningSession, ProgressCommit, StepEvaluation

        db = SessionLocal()
        try:
            rows = (
                db.query(ProgressCommit)
                .filter(ProgressCommit.project_id == project_id)
                .order_by(ProgressCommit.committed_at.asc())
                .all()
            )
            commits_dicts = [
                {
                    "id": r.id,
                    "method": r.method,
                    "understanding": r.understanding,
                    "stress": r.stress,
                    "error_rate": r.error_rate,
                    "duration_minutes": r.duration_minutes,
                    # ISO-8601 (UTC) so the aggregator can group
                    # by calendar date for the streak calc and
                    # the frontend can render a localized date.
                    "committed_at": (
                        r.committed_at.isoformat() if r.committed_at else None
                    ),
                }
                for r in rows
            ]
            # v0.5.0 — step evaluation rows for this project. The
            # join goes through LearningSession so we never
            # accidentally surface another project's evaluations.
            eval_rows = (
                db.query(StepEvaluation)
                .join(LearningSession, StepEvaluation.session_id == LearningSession.id)
                .filter(LearningSession.project_id == project_id)
                .order_by(
                    StepEvaluation.session_id,
                    StepEvaluation.evaluated_at.asc(),
                )
                .all()
            )
            eval_dicts = [
                {
                    "id": r.id,
                    "session_id": r.session_id,
                    "from_step": r.from_step,
                    "to_step": r.to_step,
                    "advance": r.advance,
                    "applied": r.applied,
                    "fallback_used": r.fallback_used,
                    "confidence": r.confidence,
                    "reason": r.reason,
                    "evaluated_at": (
                        r.evaluated_at.isoformat() if r.evaluated_at else None
                    ),
                }
                for r in eval_rows
            ]
        finally:
            db.close()
        return {
            _summary.NAMESPACE: _summary.aggregate(commits_dicts),
            "step_evaluation": _summary.aggregate_step_evaluations(eval_dicts),
        }

    def get_routes(self) -> list:
        from .routes import router

        return [router]
