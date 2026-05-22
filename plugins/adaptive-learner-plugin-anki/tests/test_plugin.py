"""Plugin class shape tests (no DB)."""

from __future__ import annotations

from adaptive_learner_anki.plugin import AnkiPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin() -> None:
    assert issubclass(AnkiPlugin, BasePlugin)


def test_required_class_attrs() -> None:
    assert AnkiPlugin.name == "anki"
    assert AnkiPlugin.target_application == "adaptive_learner"
    assert AnkiPlugin.version
    assert AnkiPlugin.description
    assert AnkiPlugin.author
