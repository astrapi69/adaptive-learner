"""Plugin class shape tests (no DB, no backend imports).

Router-shape and route-behaviour tests live in
``backend/tests/test_learning_repo_plugin_integration.py`` (BL-30
commit 4) — those run with the backend on sys.path so
``routes.py``'s ``from app.* import …`` resolves.
"""

from __future__ import annotations

from adaptive_learner_learning_repo.plugin import LearningRepoPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin() -> None:
    assert issubclass(LearningRepoPlugin, BasePlugin)


def test_required_class_attrs() -> None:
    assert LearningRepoPlugin.name == "learning-repo"
    assert LearningRepoPlugin.target_application == "adaptive_learner"
    assert LearningRepoPlugin.version
    assert LearningRepoPlugin.description
    assert LearningRepoPlugin.author
