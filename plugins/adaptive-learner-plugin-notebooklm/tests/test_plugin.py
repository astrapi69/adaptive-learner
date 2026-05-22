"""Plugin class shape tests (no DB)."""

from __future__ import annotations

from adaptive_learner_notebooklm.plugin import NotebookLMPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin() -> None:
    assert issubclass(NotebookLMPlugin, BasePlugin)


def test_required_class_attrs() -> None:
    assert NotebookLMPlugin.name == "notebooklm"
    assert NotebookLMPlugin.target_application == "adaptive_learner"
    assert NotebookLMPlugin.version
    assert NotebookLMPlugin.description
    assert NotebookLMPlugin.author
