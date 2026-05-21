"""GamificationPlugin — PluginForge entry point (Phase 29).

Subscribes to:

- ``on_session_complete`` (side-effect): awards XP for the closed
  session. Errors are caught + logged so the session close call
  is never rolled back by a gamification failure.

Exposes read endpoints under ``/api/plugins/gamification/*`` and
direct-earn endpoints for the assessment + import flows.
"""

from __future__ import annotations

import logging
from typing import Any

import pluggy
from pluginforge import BasePlugin

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")

logger = logging.getLogger(__name__)


class GamificationPlugin(BasePlugin):
    name = "gamification"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "XP, badges, and enhanced streaks. Subscribes to session-complete "
        "and exposes read endpoints for the dashboard widgets."
    )
    author = "Asterios Raptis"

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        """Award XP and evaluate badges for the completed session.

        Errors here MUST NOT roll back the session close — pluggy's
        list-mode dispatch already isolates one subscriber's failure
        from the others, but we also catch + log so a DB error
        doesn't propagate through the hook caller's stack.

        v1.16.0 / Phase 29B — after the XP award lands, evaluate
        every badge predicate against the user's current state.
        New earns are inserted into ``user_badges``; the route layer
        exposes them via ``GET /badges/{user_id}``.
        """
        from app.database import SessionLocal

        from . import badge_service, xp_service

        db = SessionLocal()
        try:
            xp_service.award_xp_for_session(db, session=session, rating=rating)
            user_id = xp_service._resolve_user_id_from_session(db, session)
            if user_id:
                badge_service.evaluate_user(db, user_id)
        except Exception:  # noqa: BLE001
            logger.exception(
                "gamification.on_session_complete: hook failed "
                "(session=%r). Continuing — session close is unaffected.",
                session.get("id"),
            )
        finally:
            db.close()

    @hookimpl
    def get_progress_summary(self, project_id: str) -> dict[str, Any]:
        """Contribute the ``gamification`` namespace to the dashboard.

        Resolves project -> user -> UserXP state. Returns an empty
        namespace if the project doesn't exist (caller already
        validates, this is belt-and-braces).
        """
        from app.database import SessionLocal
        from app.models import LearningProject

        from . import xp_service

        db = SessionLocal()
        try:
            project = db.get(LearningProject, project_id)
            if project is None:
                return {"gamification": {}}
            state = xp_service.get_user_xp_state(db, project.user_id)
            return {"gamification": state}
        finally:
            db.close()

    def get_routes(self) -> list:
        from .routes import router

        return [router]
