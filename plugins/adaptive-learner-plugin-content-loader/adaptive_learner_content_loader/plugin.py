"""ContentLoaderPlugin — PluginForge entry point (Phase 43 / EXP-002).

Plugin owns its own routes under
``/api/plugins/content-loader/*`` and exposes three content
hooks (``content_list_sets`` / ``content_download_set`` /
``content_get_lesson``) so future plugins (lesson viewer,
SRS, gamification) can read content without depending on the
loader's internal cache layout.

This commit (Phase 43 / 2A) ships only the plugin scaffold —
empty class, no routes, no hookimpls. The data models,
GitHub adapter, cache layer, and REST routes arrive in
subsequent commits of the Phase 43 chain (2B…2C).
"""

from __future__ import annotations

from pluginforge import BasePlugin


class ContentLoaderPlugin(BasePlugin):
    name = "content-loader"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = (
        "Downloads and caches structured lesson sets from "
        "public content repos. Makes the app usable without "
        "an API key by providing pre-built lessons. Works in "
        "both API and Dexie (GitHub Pages) storage modes."
    )
    author = "Asterios Raptis"
