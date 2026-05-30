"""config_overlay coverage (Phase 61 — config backbone 51% -> >80%).

Exercises the project<-user merge/precedence, the defensive
``_read_yaml`` paths (missing / malformed / non-dict), and the
app + plugin read/load/write/delete round-trips. Both the project
layer and the user layer point at tmp dirs so the merge logic runs
end-to-end without touching the real bundled configs.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app import config_overlay as co


@pytest.fixture
def layered(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Path]:
    """Point the project layer at tmp/project and the user layer at
    tmp/user (via get_data_dir -> get_user_config_dir)."""
    project = tmp_path / "project"
    (project / "plugins").mkdir(parents=True)
    user_data = tmp_path / "userdata"
    (user_data / "config" / "plugins").mkdir(parents=True)
    original = co.get_project_config_dir()
    co.set_project_config_dir(project)
    monkeypatch.setattr(co, "get_data_dir", lambda: user_data)
    yield {"project": project, "user_config": user_data / "config"}
    co.set_project_config_dir(original)


# --- deep_merge ----------------------------------------------------------

def test_deep_merge_recurses_and_override_wins():
    base = {"a": 1, "nested": {"x": 1, "y": 2}, "keep": "p"}
    override = {"a": 2, "nested": {"y": 9, "z": 3}}
    out = co.deep_merge(base, override)
    assert out == {"a": 2, "nested": {"x": 1, "y": 9, "z": 3}, "keep": "p"}
    # Inputs are not mutated.
    assert base["a"] == 1 and "z" not in base["nested"]


def test_deep_merge_override_replaces_non_dict():
    assert co.deep_merge({"a": {"x": 1}}, {"a": 5}) == {"a": 5}


# --- _read_yaml defensive paths -----------------------------------------

def test_read_yaml_missing_returns_empty(tmp_path: Path):
    assert co._read_yaml(tmp_path / "nope.yaml") == {}


def test_read_yaml_malformed_logs_and_degrades(tmp_path: Path, caplog):
    bad = tmp_path / "bad.yaml"
    bad.write_text("key: [unbalanced\n", encoding="utf-8")
    assert co._read_yaml(bad) == {}


def test_read_yaml_non_dict_returns_empty(tmp_path: Path):
    f = tmp_path / "list.yaml"
    f.write_text("- a\n- b\n", encoding="utf-8")
    assert co._read_yaml(f) == {}


# --- app config: merge + precedence + edit + write ----------------------

def test_app_config_merged_user_overrides_project(layered):
    (layered["project"] / "app.yaml").write_text(
        "app:\n  default_language: en\n  debug: false\n", encoding="utf-8"
    )
    (layered["user_config"] / "app.yaml").write_text(
        "app:\n  default_language: de\n", encoding="utf-8"
    )
    merged = co.read_app_config_merged()
    assert merged["app"]["default_language"] == "de"  # user wins
    assert merged["app"]["debug"] is False  # project value preserved


def test_load_app_config_for_edit_prefers_user_then_project(layered):
    (layered["project"] / "app.yaml").write_text("app:\n  x: 1\n", encoding="utf-8")
    # No user file yet -> project is returned for edit.
    assert co.load_app_config_for_edit() == {"app": {"x": 1}}
    co.write_user_app_config({"app": {"x": 2}})
    assert co.user_app_config_exists() is True
    assert co.load_app_config_for_edit() == {"app": {"x": 2}}  # user wins


def test_load_app_config_for_edit_empty_when_nothing(layered):
    assert co.load_app_config_for_edit() == {}
    assert co.user_app_config_exists() is False


# --- plugin config: merge + edit + write + delete -----------------------

def test_plugin_config_merged_and_edit(layered):
    (layered["project"] / "plugins" / "missions.yaml").write_text(
        "settings:\n  count: 3\n  mix: balanced\n", encoding="utf-8"
    )
    (layered["user_config"] / "plugins" / "missions.yaml").write_text(
        "settings:\n  count: 1\n", encoding="utf-8"
    )
    merged = co.read_plugin_config_merged("missions")
    assert merged["settings"]["count"] == 1  # user wins
    assert merged["settings"]["mix"] == "balanced"  # project preserved
    # for-edit returns the user overlay when present.
    assert co.load_plugin_config_for_edit("missions") == {"settings": {"count": 1}}


def test_plugin_config_for_edit_falls_back_to_project(layered):
    (layered["project"] / "plugins" / "anki.yaml").write_text(
        "settings:\n  deck: Default\n", encoding="utf-8"
    )
    assert co.load_plugin_config_for_edit("anki") == {"settings": {"deck": "Default"}}


def test_plugin_config_for_edit_empty_when_nothing(layered):
    assert co.load_plugin_config_for_edit("ghost") == {}


def test_write_then_delete_user_plugin_config(layered):
    co.write_user_plugin_config("missions", {"settings": {"count": 2}})
    assert co.load_plugin_config_for_edit("missions") == {"settings": {"count": 2}}
    # delete returns True the first time, False when already gone.
    assert co.delete_user_plugin_config("missions") is True
    assert co.delete_user_plugin_config("missions") is False
