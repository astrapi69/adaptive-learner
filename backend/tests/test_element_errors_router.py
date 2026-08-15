"""Element-error router pins (Phase 46B / C6 / P-129).

Integration tests through TestClient. Service-level
transition matrix is already pinned by
``test_element_errors_service.py`` — these tests focus on
the route surface: paths mount, payloads validate, user
404 surfaces correctly, response shape matches
``ElementErrorOut``, the bulk-upsert response preserves
input order.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.openapi_metadata import iter_api_routes


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user_id(client: TestClient) -> str:
    r = client.post(
        "/api/users",
        json={"name": "ElementHTTP", "language": "en"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _attempt_payload(
    *,
    element_key: str = "merci",
    correct: bool,
    lesson_id: str = "01-greetings.json",
) -> dict:
    return {
        "set_id": "language-fr-a1",
        "lesson_id": lesson_id,
        "exercise_id": "ex-thanks",
        "element_key": element_key,
        "element_type": "vocabulary",
        "user_answer": "salut" if not correct else "merci",
        "correct_answer": "Merci",
        "correct": correct,
    }


# --- Router wiring ----------------------------------------------------------


def test_routes_mounted(client: TestClient) -> None:
    paths = {r.path for r in iter_api_routes(app)}
    assert "/api/users/{user_id}/element-errors" in paths


# --- 404 paths --------------------------------------------------------------


def test_list_unknown_user_returns_404(client: TestClient) -> None:
    r = client.get("/api/users/no-such-user/element-errors")
    assert r.status_code == 404


def test_post_unknown_user_returns_404(client: TestClient) -> None:
    r = client.post(
        "/api/users/no-such-user/element-errors",
        json={"attempts": [_attempt_payload(correct=False)]},
    )
    assert r.status_code == 404


# --- Empty list -------------------------------------------------------------


def test_list_empty_for_fresh_user(
    client: TestClient,
    user_id: str,
) -> None:
    r = client.get(f"/api/users/{user_id}/element-errors")
    assert r.status_code == 200
    assert r.json() == []


# --- Bulk upsert + response shape ------------------------------------------


def test_post_records_one_attempt_returns_row(
    client: TestClient,
    user_id: str,
) -> None:
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={"attempts": [_attempt_payload(correct=False)]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 1
    row = body[0]
    assert row["element_key"] == "merci"
    assert row["element_type"] == "vocabulary"
    assert row["error_count"] == 1
    assert row["correct_streak"] == 0
    assert row["mastered"] is False
    assert row["last_error_at"] is not None
    assert row["user_answer"] == "salut"
    assert row["correct_answer"] == "Merci"


def test_post_bulk_preserves_order(
    client: TestClient,
    user_id: str,
) -> None:
    keys = ["alpha", "beta", "gamma"]
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={"attempts": [_attempt_payload(element_key=k, correct=False) for k in keys]},
    )
    assert r.status_code == 200, r.text
    assert [row["element_key"] for row in r.json()] == keys


def test_post_compounds_state_across_calls(
    client: TestClient,
    user_id: str,
) -> None:
    """3 separate POSTs with correct=True on the same element
    flip mastered — pins the route layer commits each call
    correctly so subsequent calls see the post-state row."""
    for _ in range(3):
        r = client.post(
            f"/api/users/{user_id}/element-errors",
            json={"attempts": [_attempt_payload(correct=True)]},
        )
        assert r.status_code == 200, r.text
    listing = client.get(f"/api/users/{user_id}/element-errors")
    rows = listing.json()
    assert len(rows) == 1
    assert rows[0]["mastered"] is True
    assert rows[0]["correct_streak"] == 3


# --- Query-string filters ---------------------------------------------------


def test_list_filters_by_set_id(
    client: TestClient,
    user_id: str,
) -> None:
    client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {**_attempt_payload(correct=False), "set_id": "set-a"},
                {**_attempt_payload(correct=False), "set_id": "set-b"},
            ]
        },
    )
    r = client.get(
        f"/api/users/{user_id}/element-errors",
        params={"set_id": "set-a"},
    )
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["set_id"] == "set-a"


def test_list_include_mastered_false_excludes_mastered(
    client: TestClient,
    user_id: str,
) -> None:
    # Master one element.
    for _ in range(3):
        client.post(
            f"/api/users/{user_id}/element-errors",
            json={"attempts": [_attempt_payload(correct=True)]},
        )
    # And leave another active (wrong-only).
    client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                _attempt_payload(element_key="bonjour", correct=False),
            ]
        },
    )
    r = client.get(
        f"/api/users/{user_id}/element-errors",
        params={"include_mastered": "false"},
    )
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["element_key"] == "bonjour"
    assert rows[0]["mastered"] is False


# --- Pydantic validation rejects garbage ------------------------------------


def test_post_rejects_empty_attempts_list(
    client: TestClient,
    user_id: str,
) -> None:
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={"attempts": []},
    )
    assert r.status_code == 422


def test_post_rejects_oversize_bulk(
    client: TestClient,
    user_id: str,
) -> None:
    """C4 schema caps the bulk body at 100 attempts."""
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [_attempt_payload(element_key=f"k-{i}", correct=False) for i in range(101)]
        },
    )
    assert r.status_code == 422


def test_post_rejects_missing_required_field(
    client: TestClient,
    user_id: str,
) -> None:
    bad = {
        "set_id": "x",
        "lesson_id": "y",
        "exercise_id": "z",
        # missing element_key + correct
    }
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={"attempts": [bad]},
    )
    assert r.status_code == 422


# --- Review-queue endpoint (Phase 46C / C11) -------------------------------


def test_review_queue_route_mounted(client: TestClient) -> None:
    paths = {r.path for r in iter_api_routes(app)}
    assert "/api/users/{user_id}/element-errors/review-queue" in paths


def test_review_queue_unknown_user_returns_404(client: TestClient) -> None:
    r = client.get(
        "/api/users/no-such-user/element-errors/review-queue",
    )
    assert r.status_code == 404


def test_review_queue_empty_for_fresh_user(
    client: TestClient,
    user_id: str,
) -> None:
    r = client.get(
        f"/api/users/{user_id}/element-errors/review-queue",
    )
    assert r.status_code == 200
    assert r.json() == []


def test_review_queue_returns_active_elements_with_scheduling(
    client: TestClient,
    user_id: str,
) -> None:
    client.post(
        f"/api/users/{user_id}/element-errors",
        json={"attempts": [_attempt_payload(correct=False)]},
    )
    r = client.get(
        f"/api/users/{user_id}/element-errors/review-queue",
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    item = body[0]
    assert item["element_key"] == "merci"
    # Scheduling fields present in the wire shape.
    assert "suggested_review_at" in item
    assert "overdue" in item


def test_review_queue_excludes_mastered_elements(
    client: TestClient,
    user_id: str,
) -> None:
    # Master one element + leave another active.
    for _ in range(3):
        client.post(
            f"/api/users/{user_id}/element-errors",
            json={"attempts": [_attempt_payload(correct=True)]},
        )
    client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                _attempt_payload(element_key="bonjour", correct=False),
            ]
        },
    )
    r = client.get(
        f"/api/users/{user_id}/element-errors/review-queue",
    )
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["element_key"] == "bonjour"


def test_review_queue_filters_by_set_id(
    client: TestClient,
    user_id: str,
) -> None:
    client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {**_attempt_payload(correct=False), "set_id": "set-a"},
                {**_attempt_payload(correct=False), "set_id": "set-b"},
            ]
        },
    )
    r = client.get(
        f"/api/users/{user_id}/element-errors/review-queue",
        params={"set_id": "set-a"},
    )
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["set_id"] == "set-a"


# --- #2161 one-off recovery remap -------------------------------------------


def _record(client: TestClient, user_id: str, *, element_key: str) -> None:
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {
                    "set_id": "ja-a1-from-de",
                    "lesson_id": "01-begruessungen.json",
                    "exercise_id": "ex-match-begruessung",
                    "element_key": element_key,
                    "element_type": "vocabulary",
                    "user_answer": "x",
                    "correct_answer": element_key,
                    "correct": False,
                }
            ]
        },
    )
    assert r.status_code in (200, 201), r.text


def _keys(client: TestClient, user_id: str) -> list[str]:
    r = client.get(f"/api/users/{user_id}/element-errors")
    return sorted(row["element_key"] for row in r.json())


_REMAP = {
    "set_id": "ja-a1-from-de",
    "lesson_id": "01-begruessungen.json",
    "exercise_id": "ex-match-begruessung",
    "old": "こんにちは",
    "new": "こんにちは (konnichiwa)",
}


def test_remap_rewrites_orphaned_key(client: TestClient, user_id: str) -> None:
    _record(client, user_id, element_key="こんにちは")
    r = client.post(
        f"/api/users/{user_id}/element-errors/remap",
        json={"remaps": [_REMAP]},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"applied": 1, "skipped": 0}
    assert _keys(client, user_id) == ["こんにちは (konnichiwa)"]


def test_remap_is_idempotent(client: TestClient, user_id: str) -> None:
    _record(client, user_id, element_key="こんにちは")
    first = client.post(
        f"/api/users/{user_id}/element-errors/remap",
        json={"remaps": [_REMAP]},
    ).json()
    second = client.post(
        f"/api/users/{user_id}/element-errors/remap",
        json={"remaps": [_REMAP]},
    ).json()
    assert first == {"applied": 1, "skipped": 0}
    # Second run: the old-key row is gone -> nothing to apply, same state.
    assert second == {"applied": 0, "skipped": 0}
    assert _keys(client, user_id) == ["こんにちは (konnichiwa)"]


def test_remap_skips_when_target_exists_no_double_map(
    client: TestClient,
    user_id: str,
) -> None:
    # The learner has progress on BOTH the old and the (already) new key.
    _record(client, user_id, element_key="こんにちは")
    _record(client, user_id, element_key="こんにちは (konnichiwa)")
    r = client.post(
        f"/api/users/{user_id}/element-errors/remap",
        json={"remaps": [_REMAP]},
    ).json()
    # The old row is left alone (no collapse onto the existing new row).
    assert r == {"applied": 0, "skipped": 1}
    assert _keys(client, user_id) == ["こんにちは", "こんにちは (konnichiwa)"]


def test_remap_is_atomic_on_mid_batch_failure(
    client: TestClient,
    user_id: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Force a failure AFTER the first remap has mutated its row: nothing must
    # persist (all-or-nothing per call).
    _record(client, user_id, element_key="こんにちは")
    _record(client, user_id, element_key="さようなら")
    from app.repositories import element_errors_repo as repo_mod

    real_find = repo_mod.SqlAlchemyElementErrorsRepository.find
    calls = {"n": 0}

    def boom(self, **kw):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        if calls["n"] >= 2:
            raise RuntimeError("forced mid-batch failure")
        return real_find(self, **kw)

    monkeypatch.setattr(
        repo_mod.SqlAlchemyElementErrorsRepository,
        "find",
        boom,
    )
    # TestClient re-raises unhandled server exceptions; the point is that the
    # request dies mid-batch AFTER the first row was mutated in-memory.
    with pytest.raises(RuntimeError, match="forced mid-batch failure"):
        client.post(
            f"/api/users/{user_id}/element-errors/remap",
            json={
                "remaps": [
                    _REMAP,
                    {**_REMAP, "old": "さようなら", "new": "さようなら (sayounara)"},
                ]
            },
        )
    monkeypatch.undo()
    # No commit happened -> both rows keep their ORIGINAL keys (all-or-nothing).
    assert _keys(client, user_id) == ["こんにちは", "さようなら"]


# --- #2130 stable_id key switch: exercise-id remap ---------------------------


def _record_ex(
    client: TestClient,
    user_id: str,
    *,
    exercise_id: str,
    element_key: str,
    direction: str = "target_to_source",
) -> None:
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {
                    "set_id": "ja-a1-from-de",
                    "lesson_id": "01-begruessungen.json",
                    "exercise_id": exercise_id,
                    "element_key": element_key,
                    "direction": direction,
                    "element_type": "vocabulary",
                    "user_answer": "x",
                    "correct_answer": element_key,
                    "correct": False,
                }
            ]
        },
    )
    assert r.status_code in (200, 201), r.text


def _exercise_ids(client: TestClient, user_id: str) -> list[str]:
    r = client.get(f"/api/users/{user_id}/element-errors")
    return sorted(row["exercise_id"] for row in r.json())


_EX_REMAP = {
    "set_id": "ja-a1-from-de",
    "lesson_id": "01-begruessungen.json",
    "old": "ex-match-begruessung",
    "new": "greetings-match-x7",
}


def test_remap_exercise_ids_moves_every_row_of_the_exercise(
    client: TestClient,
    user_id: str,
) -> None:
    # Two element_keys + one row in the OTHER drill direction: all three rows
    # belong to the same exercise identity and must move together.
    _record_ex(client, user_id, exercise_id="ex-match-begruessung", element_key="こんにちは")
    _record_ex(client, user_id, exercise_id="ex-match-begruessung", element_key="さようなら")
    _record_ex(
        client,
        user_id,
        exercise_id="ex-match-begruessung",
        element_key="こんにちは",
        direction="source_to_target",
    )
    r = client.post(
        f"/api/users/{user_id}/element-errors/remap-exercise-ids",
        json={"remaps": [_EX_REMAP]},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"applied": 3, "skipped": 0}
    assert _exercise_ids(client, user_id) == ["greetings-match-x7"] * 3
    # element_keys survive untouched.
    assert _keys(client, user_id) == ["こんにちは", "こんにちは", "さようなら"]


def test_remap_exercise_ids_is_idempotent(client: TestClient, user_id: str) -> None:
    _record_ex(client, user_id, exercise_id="ex-match-begruessung", element_key="こんにちは")
    first = client.post(
        f"/api/users/{user_id}/element-errors/remap-exercise-ids",
        json={"remaps": [_EX_REMAP]},
    ).json()
    second = client.post(
        f"/api/users/{user_id}/element-errors/remap-exercise-ids",
        json={"remaps": [_EX_REMAP]},
    ).json()
    assert first == {"applied": 1, "skipped": 0}
    assert second == {"applied": 0, "skipped": 0}
    assert _exercise_ids(client, user_id) == ["greetings-match-x7"]


def test_remap_exercise_ids_skips_when_target_row_exists(
    client: TestClient,
    user_id: str,
) -> None:
    # A row already keyed by the NEW exercise id (same element_key + direction)
    # must never be collapsed onto.
    _record_ex(client, user_id, exercise_id="ex-match-begruessung", element_key="こんにちは")
    _record_ex(client, user_id, exercise_id="greetings-match-x7", element_key="こんにちは")
    r = client.post(
        f"/api/users/{user_id}/element-errors/remap-exercise-ids",
        json={"remaps": [_EX_REMAP]},
    ).json()
    assert r == {"applied": 0, "skipped": 1}
    assert _exercise_ids(client, user_id) == [
        "ex-match-begruessung",
        "greetings-match-x7",
    ]


def test_remap_exercise_ids_scopes_to_lesson_and_set(
    client: TestClient,
    user_id: str,
) -> None:
    # Same exercise id string in ANOTHER lesson stays untouched.
    _record_ex(client, user_id, exercise_id="ex-match-begruessung", element_key="こんにちは")
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {
                    "set_id": "ja-a1-from-de",
                    "lesson_id": "02-zahlen.json",
                    "exercise_id": "ex-match-begruessung",
                    "element_key": "いち",
                    "element_type": "vocabulary",
                    "user_answer": "x",
                    "correct_answer": "いち",
                    "correct": False,
                }
            ]
        },
    )
    assert r.status_code in (200, 201)
    res = client.post(
        f"/api/users/{user_id}/element-errors/remap-exercise-ids",
        json={"remaps": [_EX_REMAP]},
    ).json()
    assert res == {"applied": 1, "skipped": 0}
    assert _exercise_ids(client, user_id) == [
        "ex-match-begruessung",
        "greetings-match-x7",
    ]


# --- #2188 retired_ids archival ----------------------------------------------


def _archive(client: TestClient, user_id: str, retired_ids: list[str]) -> dict:
    r = client.post(
        f"/api/users/{user_id}/element-errors/archive-retired",
        json={"set_id": "ja-a1-from-de", "retired_ids": retired_ids},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_archive_retired_marks_every_row_of_the_exercise(
    client: TestClient,
    user_id: str,
) -> None:
    _record_ex(client, user_id, exercise_id="greetings-match-x7", element_key="こんにちは")
    _record_ex(client, user_id, exercise_id="greetings-match-x7", element_key="さようなら")
    _record_ex(client, user_id, exercise_id="numbers-pic-b2", element_key="いち")
    assert _archive(client, user_id, ["greetings-match-x7"]) == {"archived": 2}
    # Archived rows leave the default list (review scheduling + due counts).
    r = client.get(f"/api/users/{user_id}/element-errors")
    assert sorted(row["exercise_id"] for row in r.json()) == ["numbers-pic-b2"]
    # ... but stay readable for the archive view.
    r = client.get(
        f"/api/users/{user_id}/element-errors",
        params={"include_retired": "true"},
    )
    rows = r.json()
    assert len(rows) == 3
    retired = [row for row in rows if row["exercise_id"] == "greetings-match-x7"]
    assert all(row["retired_at"] is not None for row in retired)


def test_archive_retired_is_idempotent(client: TestClient, user_id: str) -> None:
    _record_ex(client, user_id, exercise_id="greetings-match-x7", element_key="こんにちは")
    assert _archive(client, user_id, ["greetings-match-x7"]) == {"archived": 1}
    assert _archive(client, user_id, ["greetings-match-x7"]) == {"archived": 0}


def test_archive_retired_scopes_to_set(client: TestClient, user_id: str) -> None:
    _record_ex(client, user_id, exercise_id="greetings-match-x7", element_key="こんにちは")
    r = client.post(
        f"/api/users/{user_id}/element-errors",
        json={
            "attempts": [
                {
                    "set_id": "OTHER-set",
                    "lesson_id": "01.json",
                    "exercise_id": "greetings-match-x7",
                    "element_key": "hallo",
                    "element_type": "vocabulary",
                    "user_answer": "x",
                    "correct_answer": "hallo",
                    "correct": False,
                }
            ]
        },
    )
    assert r.status_code in (200, 201)
    assert _archive(client, user_id, ["greetings-match-x7"]) == {"archived": 1}
    r = client.get(f"/api/users/{user_id}/element-errors")
    remaining = [(row["set_id"], row["exercise_id"]) for row in r.json()]
    assert remaining == [("OTHER-set", "greetings-match-x7")]


def test_archived_rows_leave_the_review_queue(
    client: TestClient,
    user_id: str,
) -> None:
    _record_ex(client, user_id, exercise_id="greetings-match-x7", element_key="こんにちは")
    _archive(client, user_id, ["greetings-match-x7"])
    r = client.get(f"/api/users/{user_id}/element-errors/review-queue")
    assert r.json() == []
