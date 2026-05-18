"""Tests for the SessionPlugin class (no PluginForge wiring).

Route-mounting + ``on_session_complete`` fan-out tests live in
``backend/tests/test_session_plugin_integration.py`` — those need
``app.*`` on sys.path.
"""

from __future__ import annotations

from adaptive_learner_session.plugin import SessionPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(SessionPlugin, BasePlugin)


def test_required_class_attrs():
    assert SessionPlugin.name == "session"
    assert SessionPlugin.version == "0.1.0"
    assert SessionPlugin.description
    assert SessionPlugin.author


def test_create_session_prompt_returns_string():
    plugin = SessionPlugin()
    out = plugin.create_session_prompt(
        project={"topic": "Python", "goal": "Learn classes"},
        profile={"deductive": 0.8},
        method="deductive",
        step=1,
        lang="de",
    )
    assert isinstance(out, str)
    assert len(out) > 0


def test_create_session_prompt_returns_none_on_invalid_method():
    """firstresult=True semantics: None falls through to the next
    plugin instead of raising and aborting the dispatch chain."""
    plugin = SessionPlugin()
    out = plugin.create_session_prompt(
        project={"topic": "x", "goal": "y"},
        profile={},
        method="telekinesis",
        step=1,
        lang="de",
    )
    assert out is None


def test_create_session_prompt_returns_none_on_invalid_step():
    plugin = SessionPlugin()
    out = plugin.create_session_prompt(
        project={"topic": "x", "goal": "y"},
        profile={},
        method="deductive",
        step=99,
        lang="de",
    )
    assert out is None


# --- recommend_method_switch ----------------------------------------------


def test_recommend_method_switch_fires_on_stagnant_stressed():
    plugin = SessionPlugin()
    out = plugin.recommend_method_switch(
        project_id="p1",
        current_method="deductive",
        recent_ratings=[
            {"understanding": 3, "stress": 5},
            {"understanding": 3, "stress": 5},
            {"understanding": 3, "stress": 5},
        ],
    )
    assert out is not None
    assert out["from_method"] == "deductive"
    assert out["to_method"] != "deductive"
    assert "confidence" in out


def test_recommend_method_switch_returns_none_on_improving():
    plugin = SessionPlugin()
    out = plugin.recommend_method_switch(
        project_id="p1",
        current_method="deductive",
        recent_ratings=[
            {"understanding": 2, "stress": 5},
            {"understanding": 3, "stress": 5},
            {"understanding": 5, "stress": 5},
        ],
    )
    assert out is None
