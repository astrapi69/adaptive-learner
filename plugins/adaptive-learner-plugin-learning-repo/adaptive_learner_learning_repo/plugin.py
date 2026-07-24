"""LearningRepoPlugin - PluginForge entry point (Phase 42 / BL-30).

Plugin owns its own routes under ``/api/plugins/learning-repo/*``
and doesn't subscribe to existing hooks. Rendering is a
USER-TRIGGERED action: the user opens the repo browser or
clicks "Render now"; nothing auto-fires at session-end (this
matches the anki plugin's "user always reviews before
accepting" stance).

The plugin scaffolds clean at commit 2; real renderer + routes
land in commits 3-4.
"""

from __future__ import annotations

from pluginforge import BasePlugin


class LearningRepoPlugin(BasePlugin):
    name = "learning-repo"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "Git-backed Learning Repository - per-project Markdown "
        "artefacts (README / LEARNING_STATS / CHEATSHEET / ROADMAP) "
        "auto-emitted from DB state. Optional git integration. "
        "Implements the Article-3 pattern from Asterios Raptis' "
        "*Von Theorie zur Praxis* Medium series."
    )
    author = "Asterios Raptis"

    def get_routes(self) -> list:
        from .routes import router

        return [router]
