"""ToolsPlugin — PluginForge entry point."""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from .catalogue import rank_tools

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class ToolsPlugin(BasePlugin):
    name = "tools"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "Static external-tool recommendations tailored to the learner's method-weight profile."
    )
    author = "Asterios Raptis"

    @hookimpl
    def get_tool_recommendations(self, profile: dict[str, Any], lang: str) -> list[dict[str, Any]]:
        return rank_tools(profile, lang)

    def get_routes(self) -> list:
        from .routes import router

        return [router]
