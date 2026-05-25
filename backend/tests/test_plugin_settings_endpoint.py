"""v1.26.0 / BL-30 commit 6 — generic plugin-settings router.

Pins:

1. GET returns the current ``settings:`` block from the YAML.
2. PATCH writes the new block back AND reloads the plugin's
   in-memory config so the very next request sees the change.
3. Invalid plugin names (path-traversal, uppercase, special
   chars) reject with 400.
4. Unknown plugin names PATCH-reject with 404.
5. Empty / missing YAML reads as empty settings (no 500).
"""

from __future__ import annotations

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import app, manager
from app.paths import get_config_dir


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _learning_repo_yaml_path():
    return get_config_dir() / "plugins" / "learning-repo.yaml"


def test_get_returns_settings_block_for_registered_plugin(client: TestClient) -> None:
    """The test conftest isolates the config dir, so the YAML
    may not exist there yet (empty dict is the right answer per
    the lessons-learned "PluginForge config not found → empty
    defaults"). The pin is: 200 + plugin name + settings dict
    shape, NOT specific keys (those land via PATCH below)."""

    r = client.get("/api/plugin-settings/learning-repo")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["plugin"] == "learning-repo"
    assert isinstance(body["settings"], dict)


def test_get_after_patch_returns_the_written_settings(client: TestClient, tmp_path) -> None:
    """End-to-end: PATCH → GET → values round-trip through the
    YAML."""

    client.patch(
        "/api/plugin-settings/learning-repo",
        json={"settings": {"enable_git": False, "repos_dir": str(tmp_path)}},
    )
    body = client.get("/api/plugin-settings/learning-repo").json()
    assert body["settings"]["enable_git"] is False
    assert body["settings"]["repos_dir"] == str(tmp_path)


def test_patch_writes_to_yaml_and_reloads_in_memory_config(client: TestClient, tmp_path) -> None:
    """A PATCH must (a) overwrite the YAML and (b) update
    ``manager.get_plugin('learning-repo').config['settings']``
    so subsequent requests see the new values without a
    process restart."""

    path = _learning_repo_yaml_path()
    original = path.read_text() if path.exists() else ""
    try:
        new_repos_dir = str(tmp_path)
        r = client.patch(
            "/api/plugin-settings/learning-repo",
            json={"settings": {"enable_git": True, "repos_dir": new_repos_dir}},
        )
        assert r.status_code == 200, r.text
        # YAML round-trip
        with path.open("r", encoding="utf-8") as fh:
            loaded = yaml.safe_load(fh)
        assert loaded["settings"]["enable_git"] is True
        assert loaded["settings"]["repos_dir"] == new_repos_dir
        # In-memory reload
        plugin = manager.get_plugin("learning-repo")
        assert plugin is not None
        assert plugin.config["settings"]["enable_git"] is True
        assert plugin.config["settings"]["repos_dir"] == new_repos_dir
    finally:
        path.write_text(original)
        # Reload from the restored YAML so other tests are not disturbed
        with path.open("r", encoding="utf-8") as fh:
            restored = yaml.safe_load(fh) or {}
        plugin = manager.get_plugin("learning-repo")
        if plugin is not None:
            plugin.config["settings"] = restored.get("settings", {})


def test_patch_unknown_plugin_returns_404(client: TestClient) -> None:
    r = client.patch(
        "/api/plugin-settings/not-a-real-plugin",
        json={"settings": {"x": 1}},
    )
    assert r.status_code == 404


def test_get_rejects_invalid_plugin_name(client: TestClient) -> None:
    """Uppercase letters rejected by the kebab-case regex. The
    path-traversal shape ``..%2Fetc`` is normalised by FastAPI's
    URL parsing before reaching our route handler, so it
    surfaces as 404 from the router — also rejection, just at
    a different layer."""
    r = client.get("/api/plugin-settings/AnkiUpper")
    assert r.status_code == 400
    r2 = client.get("/api/plugin-settings/..%2Fetc")
    assert r2.status_code in (400, 404)


def test_get_rejects_invalid_plugin_name_on_patch(client: TestClient) -> None:
    r = client.patch(
        "/api/plugin-settings/AnkiUpper",
        json={"settings": {}},
    )
    assert r.status_code == 400
