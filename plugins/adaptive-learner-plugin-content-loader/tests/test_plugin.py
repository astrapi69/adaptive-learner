"""Plugin class shape tests (Phase 43 / EXP-002).

The plugin scaffolds clean in this commit. Manifest parser
shape, GitHub adapter, and cache layer get their own test
modules in later commits.
"""

from __future__ import annotations

from adaptive_learner_content_loader.plugin import ContentLoaderPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin() -> None:
    assert issubclass(ContentLoaderPlugin, BasePlugin)


def test_required_class_attrs() -> None:
    assert ContentLoaderPlugin.name == "content-loader"
    assert ContentLoaderPlugin.target_application == "adaptive_learner"
    assert ContentLoaderPlugin.version
    assert ContentLoaderPlugin.description
    assert ContentLoaderPlugin.author


def test_can_instantiate() -> None:
    plugin = ContentLoaderPlugin()
    assert plugin.name == "content-loader"
