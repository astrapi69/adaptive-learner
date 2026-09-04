"""SpeechRecording model + router pins (engine#68 idea 3: speak-and-record).

Tests under TestClient - the lifespan must fire so the Alembic head
includes the new ``speech_recordings`` table the 0038 migration adds.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.openapi_metadata import iter_api_routes


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _make_user(client: TestClient, *, name: str = "Tester") -> str:
    response = client.post(
        "/api/users",
        json={"name": name, "language": "en"},
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


SOURCE = "astrapi69/adaptive-learner-content"
SOURCE_SLUG = "astrapi69--adaptive-learner-content"
SET_ID = "language-fr-a1"
LESSON = "01-greetings.json"
EXERCISE_ID = "ex-speak-1"
AUDIO_B64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEA"  # tiny WAV header, arbitrary bytes


def _upsert_body(**overrides: object) -> dict:
    body = {
        "source": SOURCE,
        "set_id": SET_ID,
        "lesson_filename": LESSON,
        "exercise_id": EXERCISE_ID,
        "audio_base64": AUDIO_B64,
        "mime_type": "audio/webm",
        "duration_ms": 2500,
    }
    body.update(overrides)
    return body


# --- Router wiring -----------------------------------------------------


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in iter_api_routes(app)}
    assert (
        "/api/users/{user_id}/speech-recordings/{source_slug}/"
        "{set_id}/{lesson_filename}/{exercise_id}"
    ) in paths
    assert "/api/users/{user_id}/speech-recordings" in paths


# --- 404 paths -----------------------------------------------------------


def test_get_missing_recording_returns_404(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.get(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/{EXERCISE_ID}",
    )
    assert r.status_code == 404


def test_get_for_unknown_user_returns_404(client: TestClient) -> None:
    r = client.get(
        f"/api/users/no-such-user/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/{EXERCISE_ID}",
    )
    assert r.status_code == 404


def test_delete_missing_recording_returns_404(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.delete(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/{EXERCISE_ID}",
    )
    assert r.status_code == 404


# --- Upsert + overwrite ---------------------------------------------------


def test_upsert_creates_new_row(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_id"] == user_id
    assert body["exercise_id"] == EXERCISE_ID
    assert body["audio_base64"] == AUDIO_B64
    assert body["duration_ms"] == 2500


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"audio_base64": ""}, id="audio_base64-empty"),
        pytest.param({"audio_base64": "x" * 400_001}, id="audio_base64-over-400kb-ceiling"),
        pytest.param({"source": ""}, id="source-empty"),
        pytest.param({"source": "x" * 201}, id="source-over-200-chars"),
        pytest.param({"set_id": ""}, id="set_id-empty"),
        pytest.param({"lesson_filename": ""}, id="lesson_filename-empty"),
        pytest.param({"exercise_id": ""}, id="exercise_id-empty"),
        pytest.param({"exercise_id": "x" * 121}, id="exercise_id-over-120-chars"),
        pytest.param({"mime_type": ""}, id="mime_type-empty"),
        pytest.param({"duration_ms": -1}, id="duration_ms-negative"),
    ],
)
def test_upsert_rejects_invalid_field(client: TestClient, overrides: dict) -> None:
    user_id = _make_user(client)
    r = client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(**overrides),
    )
    assert r.status_code == 422, r.text


def test_upsert_accepts_audio_base64_at_exactly_the_400kb_ceiling(client: TestClient) -> None:
    user_id = _make_user(client)
    r = client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(audio_base64="x" * 400_000),
    )
    assert r.status_code == 200, r.text


def test_upsert_then_get_round_trips(client: TestClient) -> None:
    user_id = _make_user(client)
    client.put(f"/api/users/{user_id}/speech-recordings", json=_upsert_body())
    r = client.get(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/{EXERCISE_ID}",
    )
    assert r.status_code == 200
    assert r.json()["mime_type"] == "audio/webm"


def test_re_recording_overwrites_the_same_row(client: TestClient) -> None:
    user_id = _make_user(client)
    first = client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(duration_ms=1000),
    ).json()
    second = client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(duration_ms=3000, audio_base64="c2Vjb25kIGNsaXA="),
    ).json()
    # Same row (id unchanged), new content - upsert, not a second clip.
    assert second["id"] == first["id"]
    assert second["duration_ms"] == 3000
    assert second["audio_base64"] == "c2Vjb25kIGNsaXA="


def test_two_exercises_in_the_same_lesson_get_independent_rows(
    client: TestClient,
) -> None:
    user_id = _make_user(client)
    client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(exercise_id="ex-speak-1"),
    )
    client.put(
        f"/api/users/{user_id}/speech-recordings",
        json=_upsert_body(exercise_id="ex-speak-2", duration_ms=500),
    )
    r1 = client.get(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/ex-speak-1",
    )
    r2 = client.get(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/ex-speak-2",
    )
    assert r1.json()["duration_ms"] == 2500
    assert r2.json()["duration_ms"] == 500


# --- Delete ----------------------------------------------------------------


def test_delete_removes_the_recording(client: TestClient) -> None:
    user_id = _make_user(client)
    client.put(f"/api/users/{user_id}/speech-recordings", json=_upsert_body())
    r = client.delete(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/{EXERCISE_ID}",
    )
    assert r.status_code == 204
    after = client.get(
        f"/api/users/{user_id}/speech-recordings/{SOURCE_SLUG}/{SET_ID}/{LESSON}/{EXERCISE_ID}",
    )
    assert after.status_code == 404
