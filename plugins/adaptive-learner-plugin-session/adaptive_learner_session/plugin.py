"""SessionPlugin - PluginForge entry point.

Owns two hookimpls + four routes:

- ``create_session_prompt(project, profile, method, step, lang)``
  (``firstresult=True``): composes a per-(method, step, lang)
  system prompt via :mod:`.prompts`. A future per-domain plugin
  can override by getting registered earlier.
- ``recommend_method_switch(project_id, current_method,
  recent_ratings)``: applies the v0.1.0 stagnation rule from
  :mod:`.switching`.
- POST /api/plugins/session/{start, {id}/message, {id}/rate,
  {id}/end} (see :mod:`.routes`).
"""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from . import prompts, switching

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class SessionPlugin(BasePlugin):
    name = "session"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "7-step learning cycle + per-method system prompts + stagnation-based method switching."
    )
    author = "Asterios Raptis"

    @hookimpl
    def create_session_prompt(
        self,
        project: dict[str, Any],
        profile: dict[str, Any],
        method: str,
        step: int,
        lang: str,
    ) -> str | None:
        try:
            return prompts.build_prompt(
                project=project,
                profile=profile,
                method=method,
                step=step,
                lang=lang,
            )
        except ValueError:
            # firstresult=True: returning None lets pluggy try the
            # next plugin (a future per-domain override). The
            # route-level handler raises ValidationError on bad
            # input; the hook stays graceful.
            return None

    @hookimpl
    def recommend_method_switch(
        self,
        project_id: str,
        current_method: str,
        recent_ratings: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        return switching.recommend(
            project_id=project_id,
            current_method=current_method,
            recent_ratings=recent_ratings,
        )

    def get_routes(self) -> list:
        # Lazy import: routes pull in ``app.*`` which isn't on
        # sys.path during the plugin's standalone test suite.
        from .routes import router

        return [router]
