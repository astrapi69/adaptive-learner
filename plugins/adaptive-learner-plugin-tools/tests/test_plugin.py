"""Tests for the ToolsPlugin class (no PluginManager wiring)."""

from __future__ import annotations

from adaptive_learner_tools.plugin import ToolsPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(ToolsPlugin, BasePlugin)


def test_required_class_attrs():
    assert ToolsPlugin.name == "tools"
    assert ToolsPlugin.version == "0.1.0"
    assert ToolsPlugin.description
    assert ToolsPlugin.author


def test_get_tool_recommendations_returns_list():
    out = ToolsPlugin().get_tool_recommendations(profile={"deductive": 0.9}, lang="de")
    assert isinstance(out, list)
    assert len(out) >= 1


def test_get_tool_recommendations_empty_profile_still_returns_baseline():
    out = ToolsPlugin().get_tool_recommendations(profile={}, lang="en")
    assert len(out) >= 1
