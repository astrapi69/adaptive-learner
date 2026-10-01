"""One plugin-settings contract for Settings UI, startup and plugins (#3370).

The Settings endpoint used to read and write only
``get_config_dir()/plugins/{name}.yaml``, a file no plugin reads at
startup, and returned ``{}`` instead of the bundled defaults. So a
Learning-Repository opt-in reverted on restart, and connecting a content
repo on a fresh install wrote ``{user_repos: [...]}`` without
``default_sources``, which hid the official catalogue.

Pins, per consumer:

1. GET returns the bundled defaults merged with the user overlay.
2. PATCH writes only the delta to the user overlay; a PATCH without a
   bundled key keeps the bundled value (the official source survives).
3. A simulated restart (``manager.get_plugin_config``, the call
   PluginForge makes at activation) sees the saved value.
4. The content-loader reads the same merged settings.
5. Values saved before this change (the legacy file) are still read.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app import config_overlay
from app.main import app, manager
from app.paths import get_config_dir

OFFICIAL = {"source": "astrapi69/adaptive-learner-content", "branch": "main"}
USER_REPO = {"owner": "jane", "repo": "deck", "branch": "main"}


def _overlay_path(name: str) -> Path:
    return config_overlay.get_user_plugins_dir() / f"{name}.yaml"


def _legacy_path(name: str) -> Path:
    return get_config_dir() / "plugins" / f"{name}.yaml"


@pytest.fixture()
def client() -> Iterator[TestClient]:
    names = ("content-loader", "learning-repo")
    for n in names:
        _overlay_path(n).unlink(missing_ok=True)
        _legacy_path(n).unlink(missing_ok=True)
    with TestClient(app) as c:
        saved = {n: dict(manager.get_plugin(n).config.get("settings", {})) for n in names}
        yield c
    for n in names:
        _overlay_path(n).unlink(missing_ok=True)
        _legacy_path(n).unlink(missing_ok=True)
        manager.get_plugin(n).config["settings"] = saved[n]


def test_get_returns_bundled_defaults_on_a_fresh_install(client: TestClient) -> None:
    settings = client.get("/api/plugin-settings/content-loader").json()["settings"]
    assert settings["default_sources"] == [OFFICIAL]


def test_patch_without_default_sources_keeps_the_official_source(client: TestClient) -> None:
    r = client.patch(
        "/api/plugin-settings/content-loader",
        json={"settings": {"user_repos": [USER_REPO]}},
    )
    assert r.status_code == 200, r.text
    settings = client.get("/api/plugin-settings/content-loader").json()["settings"]
    assert settings["default_sources"] == [OFFICIAL]
    assert settings["user_repos"] == [USER_REPO]


def test_content_loader_reads_the_merged_settings(client: TestClient) -> None:
    from adaptive_learner_content_loader import config_resolver

    client.patch(
        "/api/plugin-settings/content-loader",
        json={"settings": {"user_repos": [USER_REPO]}},
    )
    settings = config_resolver.read_plugin_settings()
    assert settings["default_sources"] == [OFFICIAL]
    assert settings["user_repos"] == [USER_REPO]


def test_a_saved_opt_in_survives_a_restart(client: TestClient) -> None:
    current = client.get("/api/plugin-settings/learning-repo").json()["settings"]
    client.patch(
        "/api/plugin-settings/learning-repo",
        json={"settings": {**current, "enable_git": True}},
    )
    # What PluginForge hands the plugin at the next activation.
    assert manager.get_plugin_config("learning-repo")["settings"]["enable_git"] is True
    assert manager.get_plugin("learning-repo").config["settings"]["enable_git"] is True


def test_the_overlay_holds_only_the_changed_keys(client: TestClient) -> None:
    current = client.get("/api/plugin-settings/learning-repo").json()["settings"]
    client.patch(
        "/api/plugin-settings/learning-repo",
        json={"settings": {**current, "enable_git": True}},
    )
    written = yaml.safe_load(_overlay_path("learning-repo").read_text(encoding="utf-8"))
    assert written == {"settings": {"enable_git": True}}


def test_a_value_back_at_its_default_leaves_the_overlay(client: TestClient) -> None:
    current = client.get("/api/plugin-settings/learning-repo").json()["settings"]
    client.patch(
        "/api/plugin-settings/learning-repo",
        json={"settings": {**current, "enable_git": True}},
    )
    client.patch("/api/plugin-settings/learning-repo", json={"settings": current})
    written = yaml.safe_load(_overlay_path("learning-repo").read_text(encoding="utf-8"))
    assert written == {"settings": {}}
    assert manager.get_plugin_config("learning-repo")["settings"]["enable_git"] is False


def test_values_saved_before_the_fix_are_still_read(client: TestClient) -> None:
    legacy = _legacy_path("content-loader")
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text(yaml.safe_dump({"settings": {"user_repos": [USER_REPO]}}), encoding="utf-8")
    settings = client.get("/api/plugin-settings/content-loader").json()["settings"]
    assert settings["user_repos"] == [USER_REPO]
    assert settings["default_sources"] == [OFFICIAL]
    assert manager.get_plugin_config("content-loader")["settings"]["user_repos"] == [USER_REPO]


@pytest.mark.parametrize(
    "name",
    ["../escape", "a/b", "..", "", "Upper", "name.yaml"],
    ids=["parent-traversal", "subdirectory", "dotdot", "empty", "uppercase", "dotted"],
)
def test_plugin_path_helpers_reject_non_identifier_names(name: str) -> None:
    """The overlay builds file paths from the plugin name itself (CodeQL
    py/path-injection on #3474), so it validates the name where the path is
    built instead of trusting every caller to have checked it."""
    from app.exceptions import ValidationError

    with pytest.raises(ValidationError):
        config_overlay.read_plugin_settings_merged(name)
    with pytest.raises(ValidationError):
        config_overlay.write_user_plugin_settings(name, {"x": 1})


def test_plugin_path_helpers_accept_hyphenated_names() -> None:
    """Every shipped plugin name (lowercase, digits, hyphens) still resolves."""
    assert config_overlay.read_plugin_settings_merged("content-loader") is not None
    assert config_overlay.read_plugin_settings_merged("ai-anthropic") == {}
