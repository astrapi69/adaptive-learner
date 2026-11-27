"""The reset mode of the restore, server half (#3787).

A restore has two modes. The merge adds what the device lacks and deletes
nothing. The reset brings the device exactly to the backup's state: what was
added after the backup goes, what was deleted comes back, what was changed
is undone. The browser half is
``frontend/src/storage/backup/reset/reset-restore.test.ts`` (#2053: one test
per mode).

The fixtures go through the producers: ``create_backup`` writes the backup,
``ContentLoaderService.save_user_set`` and ``store_set`` the sets, as the app
does.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from adaptive_learner_content_loader.cache import cache_path_for_set, store_set
from adaptive_learner_content_loader.schema import Lesson
from adaptive_learner_content_loader.service import (
    USER_GENERATED_SOURCE,
    USER_SET_VERSION,
    ContentLoaderService,
)
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.exceptions import ValidationError
from app.models import (
    LearningProject,
    LearningSession,
    SessionNote,
    Subject,
    Tag,
    User,
    UserSettings,
)
from app.paths import get_cache_dir
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.routers.backup import router as backup_router
from app.routers.users import router as users_router
from app.services.backup_service import create_backup, restore_backup
from app.services.content_backup import CONTENT_LOADER_DIR
from tests.router_test_client import make_client

LESSON_FIXTURE = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "user-set-lesson" / "lesson.json"
)
OWN_SET = "my-set"
DOWNLOADED = ("owner/repo", "fr-a1", "3.0.0")
MANIFEST = "schema_version: '1.0'\ntitle: Test Set\n"


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _repo(db) -> SqlAlchemyBackupRepository:
    return SqlAlchemyBackupRepository(db)


def _project(user: User, topic: str) -> LearningProject:
    return LearningProject(
        user_id=user.id, topic=topic, goal="Master it", timeframe="2 weeks", daily_minutes=30
    )


def _seed(db, name: str = "Aster") -> User:
    """A learner with settings, an AI key and two projects."""
    user = User(name=name, email=None, language="de")
    db.add(user)
    db.flush()
    db.add(
        UserSettings(
            user_id=user.id, active_provider="anthropic", api_key_anthropic="sk-key-of-the-device"
        )
    )
    db.add(_project(user, "Bayes"))
    db.add(_project(user, "Greek"))
    db.commit()
    return user


def _topics(db, user: User) -> list[str]:
    db.expire_all()
    rows = db.query(LearningProject).filter(LearningProject.user_id == user.id).all()
    return sorted(row.topic for row in rows)


def _change_after_the_backup(db, user: User) -> None:
    """Delete one project, rename the other, add a third."""
    projects = {
        row.topic: row
        for row in db.query(LearningProject).filter(LearningProject.user_id == user.id)
    }
    db.delete(projects["Greek"])
    projects["Bayes"].topic = "Bayes, renamed"
    db.add(_project(user, "Added later"))
    db.commit()


def test_reset_removes_what_was_added_brings_back_what_was_deleted_and_undoes_a_change(db):
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)
    _change_after_the_backup(db, user)
    assert _topics(db, user) == ["Added later", "Bayes, renamed"]

    summary = restore_backup(_repo(db), backup, mode="reset")

    assert summary["errors"] == []
    assert _topics(db, user) == ["Bayes", "Greek"]


def test_the_default_is_still_the_merge(db):
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)
    _change_after_the_backup(db, user)

    summary = restore_backup(_repo(db), backup)

    assert summary["errors"] == []
    # Nothing is deleted, the newer change is kept, the deleted row is back.
    assert _topics(db, user) == ["Added later", "Bayes, renamed", "Greek"]


def test_reset_leaves_another_learners_rows(db):
    user = _seed(db)
    other = _seed(db, name="Someone else")
    backup = create_backup(_repo(db), user.id)
    db.add(_project(other, "Added by the other learner"))
    db.commit()

    restore_backup(_repo(db), backup, mode="reset")

    assert _topics(db, other) == ["Added by the other learner", "Bayes", "Greek"]


def test_reset_keeps_the_ai_key_and_overwrites_the_other_settings(db):
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).one()
    settings.api_key_anthropic = "sk-key-entered-after-the-backup"
    settings.active_provider = "openai"
    db.commit()

    restore_backup(_repo(db), backup, mode="reset")

    db.expire_all()
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).one()
    assert settings.api_key_anthropic == "sk-key-entered-after-the-backup"
    assert settings.active_provider == "anthropic"


def test_reset_leaves_the_rows_of_a_table_the_backup_does_not_carry(db):
    """A backup written before a table existed says nothing about it."""
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)
    del backup["data"]["tags"]
    db.add(Tag(user_id=user.id, name="exam-prep"))
    db.commit()

    restore_backup(_repo(db), backup, mode="reset")

    assert [tag.name for tag in db.query(Tag).filter(Tag.user_id == user.id)] == ["exam-prep"]


def test_reset_leaves_a_row_shared_by_all_learners_as_the_installation_has_it(db):
    """The subject taxonomy belongs to every learner; the reset of one of
    them does not undo what was changed in it since."""
    user = _seed(db)
    subject = Subject(name="Mathematics")
    db.add(subject)
    db.commit()
    backup = create_backup(_repo(db), user.id)
    subject.name = "Maths"
    db.commit()

    restore_backup(_repo(db), backup, mode="reset")

    db.expire_all()
    assert db.get(Subject, subject.id).name == "Maths"


def _session_with_note(db, user: User, content: str) -> SessionNote:
    project = db.query(LearningProject).filter(LearningProject.user_id == user.id).first()
    session = LearningSession(project_id=project.id, method="feynman")
    db.add(session)
    db.flush()
    note = SessionNote(session_id=session.id, content=content)
    db.add(note)
    db.commit()
    return note


def _notes(db, user: User) -> list[str]:
    db.expire_all()
    rows = (
        db.query(SessionNote)
        .join(LearningSession, LearningSession.id == SessionNote.session_id)
        .join(LearningProject, LearningProject.id == LearningSession.project_id)
        .filter(LearningProject.user_id == user.id)
        .all()
    )
    return sorted(row.content for row in rows)


def test_reset_covers_the_rows_that_hang_below_a_project(db):
    """Sessions and notes carry no user id; they are the learner's through
    their project. A deleted note comes back, a session added later goes."""
    user = _seed(db)
    note = _session_with_note(db, user, "in the backup")
    backup = create_backup(_repo(db), user.id)
    db.delete(note)
    db.commit()
    _session_with_note(db, user, "added later")
    assert _notes(db, user) == ["added later"]

    summary = restore_backup(_repo(db), backup, mode="reset")

    assert summary["errors"] == []
    assert _notes(db, user) == ["in the backup"]
    assert db.query(LearningSession).count() == 1


def test_reset_keeps_the_ai_key_when_the_settings_row_has_another_id_than_in_the_backup(db):
    """A fresh install seeds its own settings row; the backup's row has another id."""
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)
    db.delete(db.query(UserSettings).filter(UserSettings.user_id == user.id).one())
    db.commit()
    db.add(
        UserSettings(
            user_id=user.id, active_provider="openai", api_key_anthropic="sk-of-this-install"
        )
    )
    db.commit()

    restore_backup(_repo(db), backup, mode="reset")

    db.expire_all()
    rows = db.query(UserSettings).filter(UserSettings.user_id == user.id).all()
    assert [(row.api_key_anthropic, row.active_provider) for row in rows] == [
        ("sk-of-this-install", "anthropic")
    ]


def test_reset_is_refused_when_another_learner_holds_a_row_of_the_backup(db):
    """Two learners on one installation can hold the same row ids (one of
    them restored the other's backup). A reset must not take, overwrite or
    silently skip the other learner's rows; it changes nothing instead."""
    user = _seed(db)
    other = _seed(db, name="Someone else")
    note = _session_with_note(db, user, "in the backup")
    backup = create_backup(_repo(db), user.id)
    # After the backup the project, with its session and note, is the other
    # learner's, who edits the note.
    project = db.get(LearningSession, note.session_id).project_id
    db.get(LearningProject, project).user_id = other.id
    note.content = "edited by the other learner"
    db.commit()
    mine_before = _topics(db, user)

    with pytest.raises(ValidationError, match="not applied"):
        restore_backup(_repo(db), backup, mode="reset")

    assert _notes(db, other) == ["edited by the other learner"]
    assert _topics(db, user) == mine_before


def test_reset_is_refused_for_the_backup_of_another_learner(db):
    """A reset with it would turn the active learner into a copy of the
    other one; such a backup can only be merged."""
    user = _seed(db)
    other = _seed(db, name="Someone else")
    db.add(_project(other, "Only the other learner has this"))
    db.commit()
    backup = create_backup(_repo(db), user.id)
    before = _topics(db, other)

    # The message names the reason, not only the refusal.
    with pytest.raises(ValidationError, match="would replace everything of the active learner"):
        restore_backup(_repo(db), backup, target_user_id=other.id, mode="reset")

    assert _topics(db, other) == before


# --- the sets ---------------------------------------------------------------


def _cache_root() -> Path:
    return get_cache_dir() / CONTENT_LOADER_DIR


def _lesson(lesson_id: str, title: str) -> Lesson:
    raw = json.loads(LESSON_FIXTURE.read_text(encoding="utf-8"))
    return Lesson.model_validate({**raw, "id": lesson_id, "title": title})


def _save_own_set(set_id: str, lessons: list[Lesson]) -> None:
    ContentLoaderService(cache_root=_cache_root(), sources=[]).save_user_set(
        set_id=set_id,
        title="My set",
        target_language="es",
        level="A1",
        origin="imported",
        lessons=lessons,
    )


def _store_downloaded(source: str, set_id: str, version: str, lessons: dict[str, str]) -> None:
    store_set(_cache_root(), source, set_id, version, manifest_yaml=MANIFEST, lessons=lessons)


def _sets_on_disk() -> dict[str, dict[str, str]]:
    """Every cached set with its lesson files and their content."""
    found: dict[str, dict[str, str]] = {}
    root = _cache_root()
    if not root.is_dir():
        return found
    for lessons_dir in sorted(root.glob("*/*/v*/lessons")):
        label = "/".join(lessons_dir.parts[-4:-1])
        found[label] = {
            path.name: path.read_text(encoding="utf-8") for path in sorted(lessons_dir.iterdir())
        }
    return found


def _own_titles() -> dict[str, str]:
    lessons_dir = (
        cache_path_for_set(_cache_root(), USER_GENERATED_SOURCE, OWN_SET, USER_SET_VERSION)
        / "lessons"
    )
    return {
        path.name: json.loads(path.read_text(encoding="utf-8"))["title"]
        for path in sorted(lessons_dir.iterdir())
    }


def _seed_sets() -> None:
    _save_own_set(OWN_SET, [_lesson("l-1", "One"), _lesson("l-2", "Two")])
    _store_downloaded(*DOWNLOADED, lessons={"01.json": "{}", "02.json": "{}"})


def _change_the_sets_after_the_backup() -> None:
    """Edit and shrink the own set, add an own and a downloaded set, cut a lesson."""
    _save_own_set(OWN_SET, [_lesson("l-1", "One, edited")])
    _save_own_set("added-own", [_lesson("l-9", "Nine")])
    _store_downloaded("owner/repo", "es-a1", "1.0.0", lessons={"01.json": "{}"})
    (cache_path_for_set(_cache_root(), *DOWNLOADED) / "lessons" / "02.json").unlink()


def test_reset_brings_the_sets_exactly_to_the_backup_own_and_downloaded_alike(db):
    user = _seed(db)
    _seed_sets()
    backup = create_backup(_repo(db), user.id)
    at_backup = _sets_on_disk()
    _change_the_sets_after_the_backup()
    assert _sets_on_disk() != at_backup

    summary = restore_backup(_repo(db), backup, mode="reset")

    assert summary["content_sets"]["errors"] == []
    assert _sets_on_disk() == at_backup
    assert _own_titles() == {"l-1.json": "One", "l-2.json": "Two"}
    # Neither the staging directory nor the cache put aside is left.
    assert sorted(
        path.name
        for path in _cache_root().parent.iterdir()
        if path.name.startswith(CONTENT_LOADER_DIR)
    ) == [CONTENT_LOADER_DIR]


def test_reset_leaves_the_sets_when_the_backup_has_no_set_block(db):
    user = _seed(db)
    _seed_sets()
    backup = create_backup(_repo(db), user.id)
    del backup["content_sets"]
    _change_the_sets_after_the_backup()
    after_the_changes = _sets_on_disk()

    restore_backup(_repo(db), backup, mode="reset")

    assert _sets_on_disk() == after_the_changes


# --- all or nothing ---------------------------------------------------------


def _unusable(backup: dict[str, Any]) -> dict[str, Any]:
    """The backup with one record no restore can write: a tag without an id."""
    data = {**backup["data"], "tags": [*backup["data"].get("tags", []), {"name": "no id"}]}
    return {**backup, "data": data}


def test_reset_is_all_or_nothing(db):
    """A reset deletes before it writes, so a backup it cannot apply in full
    must leave the device as it was: rows and sets."""
    user = _seed(db)
    _seed_sets()
    backup = create_backup(_repo(db), user.id)
    _change_after_the_backup(db, user)
    _change_the_sets_after_the_backup()
    sets_before = _sets_on_disk()

    with pytest.raises(ValidationError, match="not applied"):
        restore_backup(_repo(db), _unusable(backup), mode="reset")

    assert _topics(db, user) == ["Added later", "Bayes, renamed"]
    assert _sets_on_disk() == sets_before
    # No staging directory is left beside the cache.
    leftovers = [
        path.name
        for path in _cache_root().parent.iterdir()
        if path.name.startswith(CONTENT_LOADER_DIR) and path.name != CONTENT_LOADER_DIR
    ]
    assert leftovers == []


def test_reset_is_all_or_nothing_when_it_has_nothing_to_delete(db):
    """The learner only renamed and deleted since the backup. The reset then
    starts with writes, not with a delete, and still has to undo every one
    of them when a later table cannot be written."""
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)
    projects = {
        row.topic: row
        for row in db.query(LearningProject).filter(LearningProject.user_id == user.id)
    }
    db.delete(projects["Greek"])
    projects["Bayes"].topic = "Bayes, renamed"
    db.commit()

    with pytest.raises(ValidationError, match="not applied"):
        restore_backup(_repo(db), _unusable(backup), mode="reset")

    # A second connection sees what was committed, not what a session holds.
    other_session = SessionLocal()
    try:
        assert _topics(other_session, user) == ["Bayes, renamed"]
    finally:
        other_session.close()


def test_reset_is_all_or_nothing_for_a_set_it_cannot_write(db):
    user = _seed(db)
    _seed_sets()
    backup = create_backup(_repo(db), user.id)
    _change_after_the_backup(db, user)
    sets_before = _sets_on_disk()
    backup["content_sets"][0]["files"].append(
        {"filename": "../../escape.json", "body": "{}", "encoding": "text"}
    )

    with pytest.raises(ValidationError, match="not applied"):
        restore_backup(_repo(db), backup, mode="reset")

    assert _topics(db, user) == ["Added later", "Bayes, renamed"]
    assert _sets_on_disk() == sets_before


def test_a_merge_still_collects_what_it_cannot_write(db):
    """A merge deletes nothing, so it keeps reporting such rows as errors."""
    user = _seed(db)
    backup = create_backup(_repo(db), user.id)

    summary = restore_backup(_repo(db), _unusable(backup))

    assert summary["errors"] == ["tags: record missing 'id'"]


# --- the endpoint -----------------------------------------------------------


@pytest.fixture()
def client() -> TestClient:
    return make_client(users_router, backup_router)


def _user_via_api(client: TestClient) -> str:
    response = client.post("/api/users", json={"name": "Aster"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_import_endpoint_resets_when_asked(client: TestClient, db):
    user_id = _user_via_api(client)
    backup = client.get("/api/backup/export", params={"user_id": user_id}).json()
    db.add(Tag(user_id=user_id, name="added after the backup"))
    db.commit()

    response = client.post(
        "/api/backup/import", params={"user_id": user_id, "mode": "reset"}, json=backup
    )

    assert response.status_code == 200, response.text
    assert db.query(Tag).filter(Tag.user_id == user_id).count() == 0


def test_import_endpoint_answers_400_and_changes_nothing_for_a_reset_it_cannot_apply(
    client: TestClient, db
):
    user_id = _user_via_api(client)
    backup = client.get("/api/backup/export", params={"user_id": user_id}).json()
    db.add(Tag(user_id=user_id, name="added after the backup"))
    db.commit()

    response = client.post(
        "/api/backup/import", params={"user_id": user_id, "mode": "reset"}, json=_unusable(backup)
    )

    assert response.status_code == 400, response.text
    assert "not applied" in response.json()["detail"]
    assert db.query(Tag).filter(Tag.user_id == user_id).count() == 1


def test_import_endpoint_merges_without_a_mode(client: TestClient, db):
    user_id = _user_via_api(client)
    backup = client.get("/api/backup/export", params={"user_id": user_id}).json()
    db.add(Tag(user_id=user_id, name="added after the backup"))
    db.commit()

    response = client.post("/api/backup/import", params={"user_id": user_id}, json=backup)

    assert response.status_code == 200, response.text
    assert db.query(Tag).filter(Tag.user_id == user_id).count() == 1


def test_import_endpoint_rejects_an_unknown_mode(client: TestClient):
    user_id = _user_via_api(client)
    backup = client.get("/api/backup/export", params={"user_id": user_id}).json()

    response = client.post(
        "/api/backup/import", params={"user_id": user_id, "mode": "wipe"}, json=backup
    )

    assert response.status_code == 422
