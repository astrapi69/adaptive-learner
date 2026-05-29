"""Phase 12C integration tests for the imports router."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from app.routers.curriculum import (
    curricula_router,
    lessons_router,
    topics_router,
    users_curricula_router,
)
from app.routers.imports import imports_router, users_imports_router
from app.routers.projects import projects_router, users_projects_router
from app.routers.settings import router as settings_router
from app.routers.users import router as users_router
from app.services.imports import compute_content_hash
from tests.router_test_client import make_client


@dataclass
class _Msg:
    role: str
    content: str


def test_compute_content_hash_pins_canonical_shape():
    """Regression pin: the algorithm is role-lowercase + content-strip,
    joined by '\\n', SHA-256 hex. Title is NOT in the input."""
    msgs = [_Msg("USER", "  what is induction?  "), _Msg("Assistant", "examples to rule.\n")]
    expected = hashlib.sha256(
        b"user:what is induction?\nassistant:examples to rule."
    ).hexdigest()
    assert compute_content_hash(msgs) == expected


def test_compute_content_hash_whitespace_padding_does_not_change_digest():
    a = [_Msg("user", "hello"), _Msg("assistant", "world")]
    b = [_Msg("user", "  hello\n"), _Msg("assistant", "\nworld  ")]
    assert compute_content_hash(a) == compute_content_hash(b)


def test_compute_content_hash_message_order_matters():
    forward = [_Msg("user", "Q"), _Msg("assistant", "A")]
    swapped = [_Msg("assistant", "A"), _Msg("user", "Q")]
    assert compute_content_hash(forward) != compute_content_hash(swapped)


@pytest.fixture()
def client() -> TestClient:
    return make_client(
        users_router,
        users_projects_router,
        projects_router,
        users_imports_router,
        imports_router,
        settings_router,
        # Phase 36 Bug 3 — the imports router now reaches into the
        # curriculum service; tests that exercise the curriculum-
        # link surface need the curricula routers mounted too.
        users_curricula_router,
        curricula_router,
        topics_router,
        lessons_router,
    )


def _make_user(client: TestClient, name: str = "Aster") -> str:
    resp = client.post("/api/users", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _make_project(client: TestClient, user_id: str) -> str:
    resp = client.post(
        f"/api/users/{user_id}/projects",
        json={
            "topic": "Bayes",
            "goal": "Master it",
            "timeframe": "2 weeks",
            "daily_minutes": 30,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _conv_body(**overrides) -> dict:
    base = {
        "source": "chatgpt",
        "title": "Anonymised sample conversation",
        "messages": [
            {"role": "user", "content": "What is induction?"},
            {"role": "assistant", "content": "Induction generalises from examples."},
        ],
    }
    base.update(overrides)
    return base


# --- POST -------------------------------------------------------------------


def test_post_creates_conversation_201(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(f"/api/users/{user_id}/imports", json=_conv_body())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user_id"] == user_id
    assert body["source"] == "chatgpt"
    assert body["message_count"] == 2
    assert body["analyzed"] is False
    assert body["analysis_result"] is None


def test_post_requires_at_least_one_message(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/users/{user_id}/imports",
        json=_conv_body(messages=[]),
    )
    assert resp.status_code == 422


def test_post_404_when_user_missing(client: TestClient):
    resp = client.post("/api/users/stale-id/imports", json=_conv_body())
    assert resp.status_code == 404


def test_post_404_when_project_missing(client: TestClient):
    user_id = _make_user(client)
    resp = client.post(
        f"/api/users/{user_id}/imports",
        json=_conv_body(project_id="bogus"),
    )
    assert resp.status_code == 404


def test_post_400_when_project_belongs_to_other_user(client: TestClient):
    u1 = _make_user(client, "Alice")
    u2 = _make_user(client, "Bob")
    p2 = _make_project(client, u2)
    resp = client.post(
        f"/api/users/{u1}/imports",
        json=_conv_body(project_id=p2),
    )
    assert resp.status_code == 400


# --- GET --------------------------------------------------------------------


def test_list_returns_user_imports_newest_first(client: TestClient):
    user_id = _make_user(client)
    # Distinct message content per call so the Phase 36 Bug 1
    # content-hash dedup doesn't collapse the two imports.
    body_a = _conv_body(
        title="A",
        messages=[
            {"role": "user", "content": "topic A: question one"},
            {"role": "assistant", "content": "answer one"},
        ],
    )
    body_b = _conv_body(
        title="B",
        messages=[
            {"role": "user", "content": "topic B: question two"},
            {"role": "assistant", "content": "answer two"},
        ],
    )
    a = client.post(f"/api/users/{user_id}/imports", json=body_a).json()
    b = client.post(f"/api/users/{user_id}/imports", json=body_b).json()
    listing = client.get(f"/api/users/{user_id}/imports").json()
    assert [c["id"] for c in listing] == [b["id"], a["id"]]


def test_list_404_for_unknown_user(client: TestClient):
    resp = client.get("/api/users/stale/imports")
    assert resp.status_code == 404


def test_get_detail_includes_messages(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.get(f"/api/imports/{created['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == created["id"]
    assert len(body["messages"]) == 2
    assert body["messages"][0]["order_index"] == 0
    assert body["messages"][1]["role"] == "assistant"


def test_get_detail_404_on_unknown_conversation(client: TestClient):
    resp = client.get("/api/imports/bogus")
    assert resp.status_code == 404


# --- PATCH ------------------------------------------------------------------


def test_patch_topic_tag(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.patch(
        f"/api/imports/{created['id']}",
        json={"topic_tag": "philosophy"},
    )
    assert resp.status_code == 200
    assert resp.json()["topic_tag"] == "philosophy"


def test_patch_assign_project(client: TestClient):
    user_id = _make_user(client)
    project_id = _make_project(client, user_id)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.patch(
        f"/api/imports/{created['id']}",
        json={"project_id": project_id},
    )
    assert resp.status_code == 200
    assert resp.json()["project_id"] == project_id


def test_patch_reject_cross_user_project(client: TestClient):
    u1 = _make_user(client, "Alice")
    u2 = _make_user(client, "Bob")
    p2 = _make_project(client, u2)
    created = client.post(f"/api/users/{u1}/imports", json=_conv_body()).json()
    resp = client.patch(
        f"/api/imports/{created['id']}",
        json={"project_id": p2},
    )
    assert resp.status_code == 400


# --- DELETE -----------------------------------------------------------------


def test_delete_returns_204_and_removes(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.delete(f"/api/imports/{created['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/imports/{created['id']}").status_code == 404


# --- Phase 36 Bug 1 — content-hash duplicate detection ----------------------


def test_create_returns_content_hash_on_the_out_dto(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    assert "content_hash" in created
    assert isinstance(created["content_hash"], str)
    # SHA-256 hex is exactly 64 chars.
    assert len(created["content_hash"]) == 64


def test_duplicate_import_returns_409_with_existing_id(client: TestClient):
    """Re-posting the same transcript (even under a different
    title) collapses to 409 + the existing conversation id so the
    frontend can navigate the user back to it."""
    user_id = _make_user(client)
    first = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    # Same messages, different title — duplicate should still trip.
    resp = client.post(
        f"/api/users/{user_id}/imports",
        json=_conv_body(title="Another title for the same chat"),
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()
    assert "existing_id" in body, body
    assert body["existing_id"] == first["id"]
    assert "detail" in body


def test_duplicate_check_is_scoped_per_user(client: TestClient):
    """Two different users importing the same transcript both
    succeed — the dedup is per-user, not global."""
    alice = _make_user(client, "Alice")
    bob = _make_user(client, "Bob")
    a = client.post(f"/api/users/{alice}/imports", json=_conv_body())
    b = client.post(f"/api/users/{bob}/imports", json=_conv_body())
    assert a.status_code == 201
    assert b.status_code == 201
    assert a.json()["content_hash"] == b.json()["content_hash"]
    assert a.json()["id"] != b.json()["id"]


# --- Phase 36 Bug 3 — curriculum-link surface --------------------------------


def test_get_curriculum_for_unlinked_conversation_returns_null(client: TestClient):
    """No curriculum was ever generated → endpoint returns ``null``,
    NOT 404. ImportDetail uses the null answer to keep the CTA on
    "Create curriculum"."""
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.get(f"/api/imports/{created['id']}/curriculum")
    assert resp.status_code == 200
    assert resp.json() is None


def test_get_curriculum_returns_linked_record(client: TestClient):
    """A curriculum created with ``imported_conversation_id`` set
    is returned by the lookup endpoint so the frontend can flip
    the CTA into a navigate-to-existing."""
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    curric_resp = client.post(
        f"/api/users/{user_id}/curricula",
        json={
            "title": "From import",
            "imported_conversation_id": created["id"],
        },
    )
    assert curric_resp.status_code == 201, curric_resp.text
    curric = curric_resp.json()
    assert curric["imported_conversation_id"] == created["id"]

    lookup = client.get(f"/api/imports/{created['id']}/curriculum")
    assert lookup.status_code == 200
    body = lookup.json()
    assert body is not None
    assert body["id"] == curric["id"]
    assert body["imported_conversation_id"] == created["id"]


def test_get_curriculum_404_on_unknown_conversation(client: TestClient):
    resp = client.get("/api/imports/bogus/curriculum")
    assert resp.status_code == 404


# --- Phase 36 Bug 4 — active-session-link surface ----------------------------


def test_get_active_session_returns_null_when_none_exists(client: TestClient):
    """Conversation exists but never started a session → endpoint
    returns ``null``, NOT 404. ImportDetail uses the null answer to
    keep the CTA on "Start session"."""
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.get(f"/api/imports/{created['id']}/active-session")
    assert resp.status_code == 200
    assert resp.json() is None


def test_get_active_session_404_on_unknown_conversation(client: TestClient):
    resp = client.get("/api/imports/bogus/active-session")
    assert resp.status_code == 404


def test_whitespace_only_difference_still_collapses(client: TestClient):
    """The hash strips leading/trailing whitespace per message, so
    pasting the same transcript with extra padding (a common
    real-world Claude.ai paste shape) detects as a duplicate."""
    user_id = _make_user(client)
    client.post(f"/api/users/{user_id}/imports", json=_conv_body()).raise_for_status()
    padded = _conv_body(
        messages=[
            # Same content + role as default _conv_body but with
            # leading/trailing whitespace that strip() removes.
            {"role": "user", "content": "  What is induction?  \n"},
            {"role": "assistant", "content": "\nInduction generalises from examples.\n"},
        ],
    )
    resp = client.post(f"/api/users/{user_id}/imports", json=padded)
    assert resp.status_code == 409


# --- Analysis ---------------------------------------------------------------


def test_save_analysis_persists_blob_and_flips_analyzed(client: TestClient):
    user_id = _make_user(client)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    analysis = {
        "topic": "Induction",
        "user_level": "beginner",
        "strengths": ["clear question"],
        "weaknesses": ["mixes deduction with induction"],
        "recommended_method": "inductive",
    }
    resp = client.post(
        f"/api/imports/{created['id']}/analysis",
        json={"analysis_result": analysis},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["analyzed"] is True
    assert body["analysis_result"]["topic"] == "Induction"
    # Detail endpoint preserves it.
    detail = client.get(f"/api/imports/{created['id']}").json()
    assert detail["analyzed"] is True
    assert detail["analysis_result"]["user_level"] == "beginner"


def test_save_analysis_404_on_unknown_conversation(client: TestClient):
    resp = client.post(
        "/api/imports/bogus/analysis",
        json={"analysis_result": {"topic": "x"}},
    )
    assert resp.status_code == 404


# --- /analyze — server-side AI dispatch -------------------------------------


def _set_api_key(
    client: TestClient, user_id: str, provider: str = "anthropic", key: str = "sk-test-xyz"
) -> None:
    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": provider, "key": key},
    )
    assert resp.status_code == 200, resp.text


def _patch_ai_complete(monkeypatch: pytest.MonkeyPatch, response: str | None) -> dict[str, list]:
    """Stub the ``ai_complete`` hook dispatch with a callable that
    captures every call and returns ``response``. Returns the
    capture dict so the test can assert on arguments."""
    captured: dict[str, list] = {"calls": []}
    from app.main import manager

    def fake_hook(*, messages, model, api_key, max_tokens=None, **kw):
        captured["calls"].append(
            {
                "messages": messages,
                "model": model,
                "api_key": api_key,
                "max_tokens": max_tokens,
            }
        )
        return response

    monkeypatch.setattr(manager._pm.hook, "ai_complete", fake_hook)
    return captured


def test_analyze_dispatches_ai_complete_with_decrypted_key_and_persists(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """End-to-end regression for the post-v1.5.0 API-mode fix:
    paste conversation -> analyze -> analysis_result non-null in
    backend DB. The frontend never sees the cleartext key."""
    user_id = _make_user(client)
    _set_api_key(client, user_id, key="sk-real-secret-key")
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()

    ai_response = json.dumps(
        {
            "topic": "Induction",
            "user_level": "beginner",
            "strengths": ["Concrete examples"],
            "weaknesses": ["Confuses inductive with abductive"],
            "recommended_method": "inductive",
            "summary": "Beginner asking sharp questions about induction.",
        }
    )
    captured = _patch_ai_complete(monkeypatch, ai_response)

    resp = client.post(f"/api/imports/{created['id']}/analyze")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # The conversation was analyzed and the parsed result persisted.
    assert body["analyzed"] is True
    result = body["analysis_result"]
    assert result["topic"] == "Induction"
    assert result["recommended_method"] == "inductive"
    assert result["user_level"] == "beginner"
    assert "Concrete examples" in result["strengths"]

    # The decrypted key reached the hook — proof the server-side
    # path actually replaces the broken Dexie-only frontend shim.
    assert len(captured["calls"]) == 1
    call = captured["calls"][0]
    assert call["api_key"] == "sk-real-secret-key"
    assert call["model"] == "claude-haiku-4-5-20251001"
    # The system prompt + labelled transcript reach the provider.
    assert any(m["role"] == "system" for m in call["messages"])
    user_msg = next(m for m in call["messages"] if m["role"] == "user")
    assert "Learner:" in user_msg["content"]
    assert "AI:" in user_msg["content"]


def test_analyze_404_on_unknown_conversation(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    _patch_ai_complete(monkeypatch, "ignored")
    resp = client.post("/api/imports/bogus/analyze")
    assert resp.status_code == 404


def test_analyze_400_when_no_api_key_configured(client: TestClient):
    user_id = _make_user(client)
    # No key set — settings exists with defaults but api_key_anthropic is NULL.
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    resp = client.post(f"/api/imports/{created['id']}/analyze")
    assert resp.status_code == 400
    assert "API key" in resp.json()["detail"]


def test_analyze_fallback_when_ai_returns_garbage(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """The deterministic fallback still persists the row as
    ``analyzed=True`` so the UI doesn't ask the user to re-run."""
    user_id = _make_user(client)
    _set_api_key(client, user_id)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    _patch_ai_complete(monkeypatch, "totally not parseable text")

    resp = client.post(f"/api/imports/{created['id']}/analyze")
    assert resp.status_code == 200
    body = resp.json()
    assert body["analyzed"] is True
    assert body["analysis_result"]["fallback_used"] is True


def test_analyze_uses_model_override_when_set(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    user_id = _make_user(client)
    _set_api_key(client, user_id)
    # Override via PATCH /settings.
    patch_resp = client.patch(
        f"/api/settings/{user_id}",
        json={"model_override_anthropic": "claude-sonnet-4-20250514"},
    )
    assert patch_resp.status_code == 200
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    captured = _patch_ai_complete(monkeypatch, json.dumps({"topic": "ok", "summary": "ok"}))

    resp = client.post(f"/api/imports/{created['id']}/analyze")
    assert resp.status_code == 200, resp.text
    assert captured["calls"][0]["model"] == "claude-sonnet-4-20250514"


# --- Phase 36 Bug 2 — analysis-language passthrough -------------------------


def test_analyze_threads_user_language_into_system_prompt(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """The analyze endpoint must read the user's display language
    and include the matching directive in the system prompt sent
    to the AI provider. Reproduction for the Phase 36 manual-test
    bug: user.language=de yet analysis came back in English."""
    # Create a user with language="es" to differentiate from the
    # default ("de") and prove the field — not the default — is
    # what reaches the prompt.
    resp = client.post("/api/users", json={"name": "Aster", "language": "es"})
    assert resp.status_code == 201, resp.text
    user_id = resp.json()["id"]

    _set_api_key(client, user_id)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    captured = _patch_ai_complete(monkeypatch, json.dumps({"topic": "Inducción", "summary": "ok"}))

    resp = client.post(f"/api/imports/{created['id']}/analyze")
    assert resp.status_code == 200, resp.text

    system_msg = next(m for m in captured["calls"][0]["messages"] if m["role"] == "system")
    assert "LANGUAGE — IMPORTANT" in system_msg["content"]
    assert "IN Spanish" in system_msg["content"]


def test_analyze_uses_default_language_when_user_has_de(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """Sanity-check the default path: a user created via _make_user
    (which does not pass language) carries User.language='de' from
    the model default. The analyze endpoint must still honour it."""
    user_id = _make_user(client)
    _set_api_key(client, user_id)
    created = client.post(f"/api/users/{user_id}/imports", json=_conv_body()).json()
    captured = _patch_ai_complete(monkeypatch, json.dumps({"topic": "Induktion", "summary": "ok"}))

    resp = client.post(f"/api/imports/{created['id']}/analyze")
    assert resp.status_code == 200, resp.text
    system_msg = next(m for m in captured["calls"][0]["messages"] if m["role"] == "system")
    assert "IN German" in system_msg["content"]
