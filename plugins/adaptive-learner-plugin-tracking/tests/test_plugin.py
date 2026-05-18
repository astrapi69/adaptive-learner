"""Tests for the TrackingPlugin class (no PluginManager wiring).

End-to-end hook + route tests live in
``backend/tests/test_tracking_plugin_integration.py`` — those need
``app.*`` on sys.path for the DB write + the manager lookup.
"""

from __future__ import annotations

from adaptive_learner_tracking.plugin import TrackingPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(TrackingPlugin, BasePlugin)


def test_required_class_attrs():
    assert TrackingPlugin.name == "tracking"
    assert TrackingPlugin.version == "0.1.0"
    assert TrackingPlugin.description
    assert TrackingPlugin.author


def test_on_session_complete_returns_none_signature():
    """Side-effect-only hook returns None even on the unit path
    (where there's no app.database to commit to). Defensive
    invocation: incomplete payload short-circuits before the
    DB-touching code runs."""
    plugin = TrackingPlugin()
    # Pass an incomplete session so the builder returns None and
    # the DB code path is never reached (would crash here since
    # app.database isn't on sys.path).
    out = plugin.on_session_complete(session={"id": None}, rating={})
    assert out is None
