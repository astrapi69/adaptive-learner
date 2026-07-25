"""Learning-data delete endpoint pins (#1821).

The repo-removal opt-in delete (#1445 Part B) was Dexie-only; server
mode silently deleted nothing. This endpoint gives API mode parity:
one atomic, user-scoped delete spanning lesson-progress rows (by id)
and element-error/SRS rows (by set id).

Integration tests through TestClient, real rows created via the
existing upsert endpoints (real-shape fixtures per the #1816
lessons-learned rule).
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app

DELETE_PATH = "/api/users/{user_id}/learning-data/delete"


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def _create_user(client: TestClient, name: str) -> str:
    response = client.post("/api/users", json={"name": name, "language": "en"})
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


@pytest.fixture()
def user_id(client: TestClient) -> str:
    return _create_user(client, "LearningDataOwner")


def _upsert_progress(client: TestClient, user_id: str, *, set_id: str, filename: str) -> str:
    response = client.post(
        f"/api/users/{user_id}/lesson-progress",
        json={
            "source": "jane/repo",
            "set_id": set_id,
            "lesson_filename": filename,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _upsert_attempt(client: TestClient, user_id: str, *, set_id: str) -> None:
    response = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {
                    "set_id": set_id,
                    "lesson_id": "01-intro.json",
                    "exercise_id": "ex-1",
                    "element_key": f"word-{set_id}",
                    "element_type": "vocabulary",
                    "user_answer": "wrong",
                    "correct_answer": "right",
                    "correct": False,
                }
            ]
        },
    )
    assert response.status_code == 200, response.text


def _list_progress(client: TestClient, user_id: str) -> list[dict]:
    response = client.get(f"/api/users/{user_id}/lesson-progress")
    assert response.status_code == 200, response.text
    return response.json()


def _list_errors(client: TestClient, user_id: str) -> list[dict]:
    response = client.get(f"/api/users/{user_id}/element-errors")
    assert response.status_code == 200, response.text
    return response.json()


def test_deletes_given_progress_rows_and_set_cards(client: TestClient, user_id: str) -> None:
    keep_progress = _upsert_progress(client, user_id, set_id="keep-set", filename="01.json")
    drop_progress = _upsert_progress(client, user_id, set_id="drop-set", filename="01.json")
    _upsert_attempt(client, user_id, set_id="keep-set")
    _upsert_attempt(client, user_id, set_id="drop-set")

    response = client.post(
        DELETE_PATH.format(user_id=user_id),
        json={"lesson_progress_ids": [drop_progress], "set_ids": ["drop-set"]},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"lessons_deleted": 1, "cards_deleted": 1}

    remaining_progress = _list_progress(client, user_id)
    assert [row["id"] for row in remaining_progress] == [keep_progress]
    remaining_errors = _list_errors(client, user_id)
    assert {row["set_id"] for row in remaining_errors} == {"keep-set"}


def test_never_touches_another_users_rows(client: TestClient, user_id: str) -> None:
    other_id = _create_user(client, "OtherLearner")
    other_progress = _upsert_progress(client, other_id, set_id="shared-set", filename="01.json")
    _upsert_attempt(client, other_id, set_id="shared-set")

    response = client.post(
        DELETE_PATH.format(user_id=user_id),
        json={
            "lesson_progress_ids": [other_progress],
            "set_ids": ["shared-set"],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"lessons_deleted": 0, "cards_deleted": 0}

    assert [row["id"] for row in _list_progress(client, other_id)] == [other_progress]
    assert len(_list_errors(client, other_id)) == 1


def test_unknown_ids_are_a_zero_count_no_op(client: TestClient, user_id: str) -> None:
    response = client.post(
        DELETE_PATH.format(user_id=user_id),
        json={
            "lesson_progress_ids": ["no-such-row"],
            "set_ids": ["no-such-set"],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"lessons_deleted": 0, "cards_deleted": 0}


def test_empty_deletion_is_a_valid_no_op(client: TestClient, user_id: str) -> None:
    response = client.post(
        DELETE_PATH.format(user_id=user_id),
        json={"lesson_progress_ids": [], "set_ids": []},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"lessons_deleted": 0, "cards_deleted": 0}


def _upsert_attempt_lesson(
    client: TestClient, user_id: str, *, set_id: str, lesson_id: str, element_key: str
) -> None:
    response = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {
                    "set_id": set_id,
                    "lesson_id": lesson_id,
                    "exercise_id": "ex-1",
                    "element_key": element_key,
                    "element_type": "vocabulary",
                    "user_answer": "wrong",
                    "correct_answer": "right",
                    "correct": False,
                }
            ]
        },
    )
    assert response.status_code == 200, response.text


def test_lesson_cards_delete_only_the_target_lesson(client: TestClient, user_id: str) -> None:
    """#2064 — a single-lesson delete removes one lesson's cards, keeping siblings."""
    drop_progress = _upsert_progress(client, user_id, set_id="book42", filename="01-intro.json")
    _upsert_progress(client, user_id, set_id="book42", filename="02-body.json")
    _upsert_attempt_lesson(
        client, user_id, set_id="book42", lesson_id="01-intro.json", element_key="a"
    )
    _upsert_attempt_lesson(
        client, user_id, set_id="book42", lesson_id="02-body.json", element_key="b"
    )

    response = client.post(
        DELETE_PATH.format(user_id=user_id),
        json={
            "lesson_progress_ids": [drop_progress],
            "set_ids": [],
            "lesson_cards": [{"set_id": "book42", "lesson_id": "01-intro.json"}],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"lessons_deleted": 1, "cards_deleted": 1}

    remaining_progress = _list_progress(client, user_id)
    assert [row["lesson_filename"] for row in remaining_progress] == ["02-body.json"]
    remaining_errors = _list_errors(client, user_id)
    assert {row["lesson_id"] for row in remaining_errors} == {"02-body.json"}


def test_unknown_user_returns_404(client: TestClient) -> None:
    response = client.post(
        DELETE_PATH.format(user_id="no-such-user"),
        json={"lesson_progress_ids": [], "set_ids": []},
    )
    assert response.status_code == 404
