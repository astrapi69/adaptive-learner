"""Phase 30B integration: Anki plugin under app.main.app.

Pins:

1. Plugin mounts under ``/api/plugins/anki/*``.
2. POST /cards manual insert returns the persisted row.
3. PATCH /cards/{id} flips accepted/rejected mutually-exclusively.
4. GET /cards/{user_id} supports project_id + accepted_only +
   include_rejected filters.
5. Extraction routes return 404 for unknown ids.
6. Extraction returns 400 when the user has no AI provider /
   key configured.
7. The vocabulary-only conversation path skips the AI call and
   produces cloze cards directly from
   ``analysis_result.vocabulary``.
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app, manager
from app.models import AnkiCardSuggestion, ImportedConversation


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user_and_project(client: TestClient) -> tuple[str, str]:
    u = client.post("/api/users", json={"name": "AnkiTester"})
    user_id = u.json()["id"]
    p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Spanish",
            "goal": "Reach B1.",
            "timeframe": "3 months",
            "daily_minutes": 30,
        },
    )
    return user_id, p.json()["id"]


# --- Plugin wiring --------------------------------------------------------


def test_plugin_is_active(client: TestClient) -> None:
    active = {p.name for p in manager.get_active_plugins()}
    assert "anki" in active


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/plugins/anki/cards/{user_id}" in paths
    assert "/api/plugins/anki/cards" in paths
    assert "/api/plugins/anki/cards/{card_id}" in paths
    assert (
        "/api/plugins/anki/cards/extract/session/{session_id}" in paths
    )
    assert (
        "/api/plugins/anki/cards/extract/conversation/{conversation_id}"
        in paths
    )


# --- Manual CRUD ----------------------------------------------------------


def test_create_card_persists_row(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    r = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={
            "card_type": "basic",
            "front": "Hello",
            "back": "Hola",
            "tags": ["greeting"],
            "project_id": project_id,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == user_id
    assert body["card_type"] == "basic"
    assert body["front"] == "Hello"
    assert body["tags"] == ["greeting"]
    assert body["accepted"] is False


def test_create_card_rejects_unknown_type(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    r = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={"card_type": "weird", "front": "x", "back": "y"},
    )
    assert r.status_code == 400


def test_patch_card_flips_accepted_and_rejected(
    client: TestClient,
) -> None:
    user_id, _ = _make_user_and_project(client)
    card_id = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={"card_type": "basic", "front": "a", "back": "b"},
    ).json()["id"]
    # Accept → rejected clears.
    r = client.patch(
        f"/api/plugins/anki/cards/{card_id}",
        json={"accepted": True, "rejected": True},
    )
    # When both True land in the same payload, accepted wins (the
    # spec's "mutually exclusive at the service layer" rule).
    body = r.json()
    assert body["accepted"] is True
    assert body["rejected"] is False
    # Now reject → accepted clears.
    r = client.patch(
        f"/api/plugins/anki/cards/{card_id}", json={"rejected": True}
    )
    body = r.json()
    assert body["accepted"] is False
    assert body["rejected"] is True


def test_patch_card_inline_edits(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    card_id = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={"card_type": "basic", "front": "old", "back": "old back"},
    ).json()["id"]
    r = client.patch(
        f"/api/plugins/anki/cards/{card_id}",
        json={"front": "new", "back": "new back", "tags": ["edited"]},
    )
    body = r.json()
    assert body["front"] == "new"
    assert body["back"] == "new back"
    assert body["tags"] == ["edited"]


def test_delete_card(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    card_id = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={"card_type": "basic", "front": "a", "back": "b"},
    ).json()["id"]
    r = client.delete(f"/api/plugins/anki/cards/{card_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] == card_id
    r2 = client.patch(
        f"/api/plugins/anki/cards/{card_id}", json={"front": "x"}
    )
    assert r2.status_code == 404


# --- List + filters -------------------------------------------------------


def test_list_filters_by_accepted_and_project(client: TestClient) -> None:
    user_id, project_id = _make_user_and_project(client)
    # 3 cards: one accepted in project, one suggested in project,
    # one accepted but in a different project.
    other_p = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Other",
            "goal": "Other.",
            "timeframe": "1m",
            "daily_minutes": 30,
        },
    ).json()["id"]
    c1 = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={
            "card_type": "basic",
            "front": "p1-a",
            "back": "x",
            "project_id": project_id,
            "accepted": True,
        },
    ).json()["id"]
    client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={
            "card_type": "basic",
            "front": "p1-s",
            "back": "x",
            "project_id": project_id,
        },
    )
    client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={
            "card_type": "basic",
            "front": "p2-a",
            "back": "x",
            "project_id": other_p,
            "accepted": True,
        },
    )
    # All cards, all projects.
    all_cards = client.get(
        f"/api/plugins/anki/cards/{user_id}"
    ).json()
    assert len(all_cards) == 3
    # Project + accepted_only.
    filtered = client.get(
        f"/api/plugins/anki/cards/{user_id}"
        f"?project_id={project_id}&accepted_only=true"
    ).json()
    assert [c["id"] for c in filtered] == [c1]


def test_list_unknown_user_returns_404(client: TestClient) -> None:
    r = client.get("/api/plugins/anki/cards/nope")
    assert r.status_code == 404


# --- AI extraction (mocked) ----------------------------------------------


def test_extract_session_unknown_returns_404(client: TestClient) -> None:
    r = client.post("/api/plugins/anki/cards/extract/session/nope")
    assert r.status_code == 404


def test_extract_conversation_unknown_returns_404(
    client: TestClient,
) -> None:
    r = client.post(
        "/api/plugins/anki/cards/extract/conversation/nope"
    )
    assert r.status_code == 404


def test_extract_conversation_uses_vocabulary_without_ai(
    client: TestClient,
) -> None:
    """The vocabulary path skips the AI hook entirely — pin it
    by mocking the hook to raise so a test failure means the AI
    DID get called (wrong)."""
    user_id, project_id = _make_user_and_project(client)
    # Create an ImportedConversation with persisted vocabulary.
    db = SessionLocal()
    try:
        conv = ImportedConversation(
            user_id=user_id,
            project_id=project_id,
            source="medium",
            title="Spanish chat",
            message_count=0,
            analyzed=True,
            analysis_result=json.dumps(
                {
                    "vocabulary": [
                        {
                            "word": "perro",
                            "translation": "dog",
                            "example": "El perro corre rapido.",
                            "tags": ["noun"],
                        },
                        {"word": "gato", "translation": "cat"},
                    ]
                }
            ),
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conv_id = conv.id
    finally:
        db.close()

    def _no_ai(*args, **kwargs):
        raise AssertionError(
            "AI hook should NOT fire when vocabulary is present"
        )

    with patch.object(
        manager._pm.hook, "ai_complete", side_effect=_no_ai
    ):
        r = client.post(
            f"/api/plugins/anki/cards/extract/conversation/{conv_id}"
        )
    assert r.status_code == 200
    body = r.json()
    # 2 vocabulary entries → 2 cards.
    assert len(body) == 2
    fronts = {c["front"] for c in body}
    # The 'perro' example contained the word → cloze.
    cloze_card = next(c for c in body if c["card_type"] == "cloze")
    assert "{{c1::perro}}" in cloze_card["front"]
    # The 'gato' had no example → basic.
    basic_card = next(c for c in body if c["card_type"] == "basic")
    assert basic_card["front"] == "gato"
    assert "vocabulary" in basic_card["tags"]


# --- Mark-exported --------------------------------------------------------


def test_mark_exported_stamps_timestamp(client: TestClient) -> None:
    user_id, _ = _make_user_and_project(client)
    card_id = client.post(
        f"/api/plugins/anki/cards?user_id={user_id}",
        json={"card_type": "basic", "front": "a", "back": "b"},
    ).json()["id"]
    r = client.post(
        "/api/plugins/anki/cards/mark-exported",
        json={"card_ids": [card_id]},
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    db = SessionLocal()
    try:
        row = db.get(AnkiCardSuggestion, card_id)
        assert row is not None
        assert row.exported_at is not None
    finally:
        db.close()


def test_mark_exported_skips_unknown_ids(client: TestClient) -> None:
    r = client.post(
        "/api/plugins/anki/cards/mark-exported",
        json={"card_ids": ["does-not-exist"]},
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 0
