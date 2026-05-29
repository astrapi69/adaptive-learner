"""MissionsPlugin - PluginForge entry point (EXP-010 / Phase 56)."""

from __future__ import annotations

from pluginforge import BasePlugin


class MissionsPlugin(BasePlugin):
    name = "missions"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "Daily missions (EXP-010): deterministic per-user/per-day goals "
        "evaluated against existing learning data."
    )
    author = "Asterios Raptis"

    def get_routes(self) -> list:
        from .routes import router

        return [router]
