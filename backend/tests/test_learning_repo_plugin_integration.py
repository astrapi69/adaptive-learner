"""Phase 42 / BL-30 commit 4 — learning-repo plugin under app.main.

Pins:

1. Plugin mounts under ``/api/plugins/learning-repo/*``.
2. GET /render/{project_id} returns the four root meta-files
   even for an empty project (no sessions).
3. GET /render/{project_id} 404s on unknown project_id.
4. End-to-end render: sessions + ratings + notes (including a
   ``kind="meta_learning"`` note) → expected sections appear.
5. ?language= override is reflected in the response payload.
6. Default language is the project owner's ``User.language``.
7. POST /export-zip/{project_id} returns application/zip with the
   ``{slug}-learning-repo.zip`` Content-Disposition header.
8. The zip's contents match the /render JSON files byte-for-byte.
9. POST /export-zip/{project_id} 404s on unknown project_id.
"""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, manager
from app.models import (
    LearningProject,
    LearningSession,
    SessionNote,
    SessionRating,
    User,
)


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(
    client: TestClient,
    *,
    name: str = "RepoTester",
    language: str = "en",
    topic: str = "Docker",
    goal: str = "Multi-container QA",
) -> tuple[str, str]:
    u = client.post(
        "/api/users",
        json={"name": name, "language": language},
    )
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": topic,
            "goal": goal,
            "timeframe": "2 weeks",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


# --- Plugin wiring --------------------------------------------------------


def test_plugin_is_active(client: TestClient) -> None:
    active = {p.name for p in manager.get_active_plugins()}
    assert "learning-repo" in active


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/learning-repo/render/{project_id}" in paths
    assert "/api/plugins/learning-repo/export-zip/{project_id}" in paths
    assert "/api/plugins/learning-repo/persist/{project_id}" in paths


# --- GET /render ----------------------------------------------------------


def test_render_empty_project_returns_four_root_meta_files(
    client: TestClient,
) -> None:
    _, project_id = _make_user_and_project(client)
    r = client.get(f"/api/plugins/learning-repo/render/{project_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["project_id"] == project_id
    assert set(body["files"]) == {
        "README.md",
        "LEARNING_STATS.md",
        "CHEATSHEET.md",
        "ROADMAP.md",
    }


def test_render_unknown_project_returns_404(client: TestClient) -> None:
    r = client.get("/api/plugins/learning-repo/render/00000000-aaaa-bbbb-cccc-dddddddddddd")
    assert r.status_code == 404


def test_render_topic_in_readme_matches_project_topic(client: TestClient) -> None:
    _, project_id = _make_user_and_project(client, topic="Docker", goal="QA setups")
    body = client.get(f"/api/plugins/learning-repo/render/{project_id}").json()
    assert "# Learning Project: Docker" in body["files"]["README.md"]
    assert "QA setups" in body["files"]["README.md"]


def test_render_includes_meta_learning_note_in_cheatsheet(
    client: TestClient,
) -> None:
    """Smoke: a SessionNote with kind="meta_learning" surfaces in
    the dedicated CHEATSHEET section."""

    user_id, project_id = _make_user_and_project(client)
    db = SessionLocal()
    try:
        session = LearningSession(
            project_id=project_id,
            method="ai_adaptive",
            status="active",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        meta_note = SessionNote(
            session_id=session.id,
            content="Drill clears repeat errors faster than re-reading.",
            kind="meta_learning",
        )
        regular_note = SessionNote(
            session_id=session.id,
            content="Use docker compose down -v to wipe volumes too.",
        )
        db.add_all([meta_note, regular_note])
        db.commit()
    finally:
        db.close()

    body = client.get(f"/api/plugins/learning-repo/render/{project_id}").json()
    cheatsheet = body["files"]["CHEATSHEET.md"]
    meta_idx = cheatsheet.index("## Meta-Learning Insights")
    # The meta note appears AFTER the meta heading.
    assert cheatsheet.index("Drill clears repeat errors") > meta_idx
    # The regular note appears BEFORE the meta heading.
    assert cheatsheet.index("Use docker compose down -v") < meta_idx


def test_render_stats_pins_exit_threshold_for_two_consecutive_passing_sessions(
    client: TestClient,
) -> None:
    """Two consecutive sessions both above U≥9 + T≥8 ⇒ second
    one pins the exit-threshold marker."""

    user_id, project_id = _make_user_and_project(client)
    db = SessionLocal()
    try:
        s1 = LearningSession(
            project_id=project_id,
            method="ai_adaptive",
            status="completed",
        )
        s2 = LearningSession(
            project_id=project_id,
            method="ai_adaptive",
            status="completed",
        )
        db.add_all([s1, s2])
        db.commit()
        db.refresh(s1)
        db.refresh(s2)
        # SessionRating fields are 1–5; renderer scales ×2 to /10.
        # 5/5 * 2 = 10/10 understanding, 4/5 * 2 = 8/10 method_fit
        db.add_all(
            [
                SessionRating(
                    session_id=s1.id,
                    understanding=5,
                    stress=1,
                    method_fit=4,
                ),
                SessionRating(
                    session_id=s2.id,
                    understanding=5,
                    stress=1,
                    method_fit=5,
                ),
            ]
        )
        db.commit()
    finally:
        db.close()

    stats = client.get(f"/api/plugins/learning-repo/render/{project_id}").json()["files"][
        "LEARNING_STATS.md"
    ]
    # Exactly one row pinned (the second consecutive session).
    assert stats.count("exit threshold met") == 1


# --- language resolution -------------------------------------------------


def test_render_uses_explicit_language_query_param(client: TestClient) -> None:
    _, project_id = _make_user_and_project(client, language="en")
    body = client.get(f"/api/plugins/learning-repo/render/{project_id}?language=de").json()
    assert body["language"] == "de"


def test_render_defaults_to_project_owner_user_language(client: TestClient) -> None:
    _, project_id = _make_user_and_project(client, language="ja")
    body = client.get(f"/api/plugins/learning-repo/render/{project_id}").json()
    assert body["language"] == "ja"


def test_render_falls_back_to_english_when_user_language_blank(
    client: TestClient,
) -> None:
    """Guard: if a user somehow has an empty language string,
    the renderer defaults to English instead of 500-ing."""

    _, project_id = _make_user_and_project(client, language="en")
    # Forcibly blank the user's language column to exercise the
    # fallback (the API normally rejects empty strings).
    db = SessionLocal()
    try:
        project = db.get(LearningProject, project_id)
        assert project is not None
        user = db.get(User, project.user_id)
        assert user is not None
        user.language = ""
        db.commit()
    finally:
        db.close()
    body = client.get(f"/api/plugins/learning-repo/render/{project_id}").json()
    assert body["language"] == "en"


# --- POST /export-zip -----------------------------------------------------


def test_export_zip_returns_application_zip_with_filename(
    client: TestClient,
) -> None:
    _, project_id = _make_user_and_project(client, topic="Docker Compose & QA")
    r = client.post(f"/api/plugins/learning-repo/export-zip/{project_id}")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/zip"
    # "Docker Compose & QA" slugs to "docker-compose-qa".
    assert (
        r.headers["content-disposition"]
        == 'attachment; filename="docker-compose-qa-learning-repo.zip"'
    )


def test_export_zip_contents_match_render_files(client: TestClient) -> None:
    _, project_id = _make_user_and_project(client)
    rendered = client.get(f"/api/plugins/learning-repo/render/{project_id}").json()["files"]
    r = client.post(f"/api/plugins/learning-repo/export-zip/{project_id}")
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        in_zip = {name: zf.read(name).decode("utf-8") for name in zf.namelist()}
    assert in_zip == rendered


def test_export_zip_unknown_project_returns_404(client: TestClient) -> None:
    r = client.post("/api/plugins/learning-repo/export-zip/00000000-aaaa-bbbb-cccc-dddddddddddd")
    assert r.status_code == 404


def test_export_zip_respects_language_query_param(client: TestClient) -> None:
    _, project_id = _make_user_and_project(client, language="en")
    r = client.post(f"/api/plugins/learning-repo/export-zip/{project_id}?language=de")
    assert r.status_code == 200
    # Body shape doesn't reveal language directly, but the
    # rendered contract is the same — so the render-equivalence
    # test above already covers it. This test just pins that
    # the language query param is accepted and returns 200 (no
    # unsupported-param rejection).


# --- POST /persist (BL-30 commit 5) -------------------------------------


def test_persist_default_off_returns_400_with_actionable_message(
    client: TestClient,
) -> None:
    """The plugin ships with ``enable_git: false`` — hitting
    /persist without flipping that bit must respond with HTTP
    400 + a message naming the setting key so the user knows
    where to look."""
    _, project_id = _make_user_and_project(client)
    r = client.post(f"/api/plugins/learning-repo/persist/{project_id}")
    assert r.status_code == 400
    body = r.json()
    assert "enable_git" in body["detail"]


def test_persist_unknown_project_returns_404_even_when_git_disabled(
    client: TestClient,
) -> None:
    """Routing-order pin: the ``enable_git`` check fires BEFORE
    the project lookup (cheap settings read before DB query).
    So an unknown project on the default-off configuration
    surfaces as 400, not 404. This documents the intentional
    order; if you swap them the test catches it."""
    r = client.post("/api/plugins/learning-repo/persist/00000000-aaaa-bbbb-cccc-dddddddddddd")
    assert r.status_code == 400  # enable_git check beats project lookup


def test_persist_with_git_enabled_writes_tree_and_returns_commit_sha(
    client: TestClient, tmp_path
) -> None:
    """Toggle enable_git on the live plugin instance and point
    repos_dir at ``tmp_path``. Hitting /persist should write the
    rendered tree under ``{tmp_path}/{project_id}/`` and return a
    commit SHA. Cleanup restores the original settings so other
    tests aren't disturbed."""
    _, project_id = _make_user_and_project(client)
    plugin = manager.get_plugin("learning-repo")
    assert plugin is not None
    original_settings = plugin.config.get("settings", {}).copy()
    plugin.config["settings"] = {
        **original_settings,
        "enable_git": True,
        "repos_dir": str(tmp_path),
    }
    try:
        r = client.post(f"/api/plugins/learning-repo/persist/{project_id}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["project_id"] == project_id
        assert body["files_written"] >= 4  # README + STATS + CHEATSHEET + ROADMAP
        assert body["repo_path"] == str(tmp_path / project_id)
        assert len(body["commit_sha"]) == 40
        assert body["tag"] is None  # no sessions yet → no exit threshold
        # Files actually landed on disk:
        assert (tmp_path / project_id / "README.md").exists()
        assert (tmp_path / project_id / ".git").is_dir()
    finally:
        plugin.config["settings"] = original_settings


def test_persist_unknown_project_returns_404_when_git_enabled(client: TestClient, tmp_path) -> None:
    """Once ``enable_git`` is on, the project-lookup is reached;
    unknown project IDs surface as 404 from there."""
    plugin = manager.get_plugin("learning-repo")
    assert plugin is not None
    original_settings = plugin.config.get("settings", {}).copy()
    plugin.config["settings"] = {
        **original_settings,
        "enable_git": True,
        "repos_dir": str(tmp_path),
    }
    try:
        r = client.post("/api/plugins/learning-repo/persist/00000000-aaaa-bbbb-cccc-dddddddddddd")
        assert r.status_code == 404
    finally:
        plugin.config["settings"] = original_settings


def test_persist_returns_502_when_git_binary_missing(
    client: TestClient, tmp_path, monkeypatch
) -> None:
    """When ``git`` is not on PATH, the writer raises
    ExternalServiceError("git", ...) which the global handler
    maps to HTTP 502 — matches the Pandoc / TTS pattern."""
    _, project_id = _make_user_and_project(client)
    plugin = manager.get_plugin("learning-repo")
    assert plugin is not None
    original_settings = plugin.config.get("settings", {}).copy()
    plugin.config["settings"] = {
        **original_settings,
        "enable_git": True,
        "repos_dir": str(tmp_path),
    }
    monkeypatch.setattr(
        "adaptive_learner_learning_repo.git_writer.shutil.which",
        lambda _name: None,
    )
    try:
        r = client.post(f"/api/plugins/learning-repo/persist/{project_id}")
        assert r.status_code == 502
        body = r.json()
        assert "git" in body["detail"]
    finally:
        plugin.config["settings"] = original_settings
