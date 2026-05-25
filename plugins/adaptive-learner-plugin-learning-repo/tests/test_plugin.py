"""Plugin class shape tests (no DB)."""

from __future__ import annotations

from adaptive_learner_learning_repo.plugin import LearningRepoPlugin
from adaptive_learner_learning_repo.routes import router
from pluginforge import BasePlugin


def test_inherits_from_baseplugin() -> None:
    assert issubclass(LearningRepoPlugin, BasePlugin)


def test_required_class_attrs() -> None:
    assert LearningRepoPlugin.name == "learning-repo"
    assert LearningRepoPlugin.target_application == "adaptive_learner"
    assert LearningRepoPlugin.version
    assert LearningRepoPlugin.description
    assert LearningRepoPlugin.author


def test_router_prefix() -> None:
    """Routes must mount under /plugins/learning-repo so the
    eventual /api/plugins/learning-repo/* surface lands at the
    expected path once the backend mounts the plugin routers."""
    assert router.prefix == "/plugins/learning-repo"
    assert "learning-repo" in router.tags


def test_get_routes_returns_router() -> None:
    instance = LearningRepoPlugin()
    routes = instance.get_routes()
    assert len(routes) == 1
    assert routes[0] is router
