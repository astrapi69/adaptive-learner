"""Pure-unit tests for GamificationPlugin (no DB).

DB-touching tests for the on_session_complete hook + the routes
live in ``backend/tests/test_gamification_plugin_integration.py``.
"""

from __future__ import annotations

from adaptive_learner_gamification.plugin import GamificationPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin() -> None:
    assert issubclass(GamificationPlugin, BasePlugin)


def test_required_class_attrs() -> None:
    assert GamificationPlugin.name == "gamification"
    assert GamificationPlugin.target_application == "adaptive_learner"
    assert GamificationPlugin.version
    assert GamificationPlugin.description
    assert GamificationPlugin.author


# Note: ``get_routes()`` does a lazy import of ``.routes`` which
# imports ``app.database`` — that's only on sys.path under the
# backend's test environment, not in the plugin-side standalone
# run. The route-mounting contract is pinned in the backend
# integration test ``test_gamification_plugin_integration.
# test_router_paths_mounted`` instead.
