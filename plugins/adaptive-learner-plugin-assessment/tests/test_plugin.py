"""Tests for the AssessmentPlugin class itself.

These exercise the plugin in isolation (no PluginForge wiring) so
they stay fast + don't depend on backend setup. The end-to-end
integration test that actually mounts the plugin under the
production app lives in ``backend/tests/test_assessment_plugin_integration.py``.
"""

from __future__ import annotations

from adaptive_learner_assessment.plugin import AssessmentPlugin
from adaptive_learner_assessment.questions import METHODS
from pluginforge import BasePlugin

# Route-mounting tests live in
# ``backend/tests/test_assessment_plugin_integration.py`` —
# ``AssessmentPlugin.get_routes()`` lazy-imports the routes module,
# which pulls in ``app.database`` / ``app.models``. Those aren't on
# sys.path when this file runs from the plugin's own ``tests/`` dir.


def test_inherits_from_baseplugin():
    assert issubclass(AssessmentPlugin, BasePlugin)


def test_required_class_attrs():
    assert AssessmentPlugin.name == "assessment"
    assert AssessmentPlugin.version == "0.1.0"
    assert AssessmentPlugin.description
    assert AssessmentPlugin.author


def test_get_assessment_questions_returns_localised_pack():
    plugin = AssessmentPlugin()
    de = plugin.get_assessment_questions("de")
    en = plugin.get_assessment_questions("en")
    assert len(de) == 12
    assert len(en) == 12
    assert de[0]["text"] != en[0]["text"]


def test_calculate_profile_returns_six_method_dict():
    plugin = AssessmentPlugin()
    out = plugin.calculate_profile([])
    assert set(out.keys()) == set(METHODS)


def test_health_returns_ok_by_default():
    # Inherited from BasePlugin; sanity check that nothing overrides
    # it incorrectly.
    assert AssessmentPlugin().health() == {"status": "ok"}
