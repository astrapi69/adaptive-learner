"""AssessmentPlugin — PluginForge entry point.

Registers two hookimpls + one FastAPI router:

- ``get_assessment_questions(lang)`` → list of questions.
- ``calculate_profile(answers)`` → 6-method-weight dict.
- ``/api/plugins/assessment/{questions,evaluate,profile/{id}}``.

The hookimpls let the session plugin (Phase 3-C) fetch the same
question pack via pluggy instead of going through HTTP — same
data source either way, so the dashboard's question pack and the
session plugin's profile calculator never drift.
"""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from .profile import calculate_profile as _calculate_profile
from .questions import questions_for_lang as _questions_for_lang

# routes.py is imported lazily inside ``get_routes`` so the plugin
# class stays importable in isolation (the route module reaches into
# ``app.database`` / ``app.models``, which aren't on sys.path when
# the plugin's own unit-test suite runs from the plugin directory).

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class AssessmentPlugin(BasePlugin):
    name = "assessment"
    version = "0.1.0"
    description = "12-question learner-profile assessment + 6-method-weight calculation."
    author = "Asterios Raptis"

    @hookimpl
    def get_assessment_questions(self, lang: str) -> list[dict[str, Any]]:
        return _questions_for_lang(lang)

    @hookimpl
    def calculate_profile(self, answers: list[dict[str, Any]]) -> dict[str, float]:
        return _calculate_profile(answers)

    def get_routes(self) -> list:
        # Lazy import: routes.py pulls in ``app.database`` /
        # ``app.models``, which only exist on sys.path when the
        # backend's poetry env is loaded. Keeps the plugin class
        # importable from the plugin's own ``tests/`` dir.
        from .routes import router

        return [router]
