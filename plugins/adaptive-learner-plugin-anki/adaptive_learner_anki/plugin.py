"""AnkiPlugin - PluginForge entry point (Phase 30).

Hookspec coverage is minimal — the plugin owns its own routes
under ``/api/plugins/anki/*`` and doesn't subscribe to existing
hooks. Card extraction is a USER-TRIGGERED action (per the spec:
"AI card extraction is a SUGGESTION — user always reviews
before accepting") so we don't auto-fire on session-complete.
"""

from __future__ import annotations

import pluggy
from pluginforge import BasePlugin

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class AnkiPlugin(BasePlugin):
    name = "anki"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "AI-extracted Anki flashcard suggestions + .apkg export. "
        "User-triggered extraction; cards reviewed + accepted in the "
        "frontend Anki page before download."
    )
    author = "Asterios Raptis"

    def get_routes(self) -> list:
        from .routes import router

        return [router]
