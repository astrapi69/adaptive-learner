"""NotebookLMPlugin - PluginForge entry point (Phase 32)."""

from __future__ import annotations

import pluggy
from pluginforge import BasePlugin

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class NotebookLMPlugin(BasePlugin):
    name = "notebooklm"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "Active-recall question generator + study guide generator + "
        "NotebookLM-optimized ZIP export."
    )
    author = "Asterios Raptis"

    def get_routes(self) -> list:
        from .routes import router

        return [router]
