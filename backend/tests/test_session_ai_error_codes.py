"""The tutor exchange classifies a failed AI turn (#3376).

API mode used to return only English ``ai_error`` text, so the no-key
guidance and every other friendly message existed only in browser mode.
Both the JSON ``/message`` and the SSE ``/message/stream`` path now carry
``ai_error_code``; the Dexie half is pinned in
``frontend/src/storage/ai/session-flow.ai-error-code.test.ts``.
"""

from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
from adaptive_learner_session import ai_error_codes
from adaptive_learner_session.ai_error_codes import classify_provider_exception
from fastapi.testclient import TestClient

from app.exceptions import ExternalServiceError
from app.main import app
from tests.test_session_plugin_integration import _make_user_and_project, _parse_sse


class _SdkStatusError(Exception):
    def __init__(self, status_code: int) -> None:
        super().__init__(f"HTTP {status_code}")
        self.status_code = status_code


class _ProviderConnectionError(Exception):
    """Named like the SDK connection errors (anthropic.APIConnectionError)."""


def _wrapped(cause: BaseException) -> ExternalServiceError:
    try:
        raise ExternalServiceError("anthropic", str(cause)) from cause
    except ExternalServiceError as exc:
        return exc


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _session_with_key(client: TestClient, *, key: bool) -> str:
    user_id, project_id = _make_user_and_project(client)
    if key:
        client.post(f"/api/settings/{user_id}/api-key", json={"provider": "anthropic", "key": "sk-test"})
    return client.post(
        "/api/plugins/session/start", json={"project_id": project_id, "method": "deductive"}
    ).json()["session"]["id"]


@pytest.mark.parametrize(
    ("cause", "code"),
    [
        (_SdkStatusError(401), ai_error_codes.PROVIDER_AUTH),
        (_SdkStatusError(403), ai_error_codes.PROVIDER_AUTH),
        (_SdkStatusError(429), ai_error_codes.PROVIDER_RATE_LIMITED),
        (_SdkStatusError(503), ai_error_codes.PROVIDER_UNAVAILABLE),
        (_ProviderConnectionError("refused"), ai_error_codes.PROVIDER_UNAVAILABLE),
        (httpx.ConnectTimeout("slow"), ai_error_codes.PROVIDER_UNAVAILABLE),
        (_SdkStatusError(400), ai_error_codes.PROVIDER_ERROR),
        (ValueError("bad payload"), ai_error_codes.PROVIDER_ERROR),
    ],
    ids=["401", "403", "429", "503", "connection-class", "httpx-timeout", "400", "plain"],
)
def test_classify_reads_the_provider_cause_not_the_wrapper(cause: BaseException, code: str) -> None:
    # The wrapper's own status_code (502) must not decide the class.
    assert classify_provider_exception(_wrapped(cause)) == code


def test_message_without_a_key_says_no_api_key(client: TestClient) -> None:
    sess_id = _session_with_key(client, key=False)
    body = client.post(
        f"/api/plugins/session/{sess_id}/message", json={"role": "user", "content": "Hi"}
    ).json()
    assert body["ai_error"]
    assert body["ai_error_code"] == ai_error_codes.NO_API_KEY


def test_stream_without_a_key_says_no_api_key(client: TestClient) -> None:
    sess_id = _session_with_key(client, key=False)
    resp = client.post(
        f"/api/plugins/session/{sess_id}/message/stream", json={"role": "user", "content": "Hi"}
    )
    done = _parse_sse(resp.text)[-1]["data"]
    assert done["ai_error_code"] == ai_error_codes.NO_API_KEY


def test_message_with_a_rejected_key_says_provider_auth(client: TestClient) -> None:
    sess_id = _session_with_key(client, key=True)
    with patch("adaptive_learner_ai_anthropic.plugin._complete", side_effect=_SdkStatusError(401)):
        body = client.post(
            f"/api/plugins/session/{sess_id}/message", json={"role": "user", "content": "Hi"}
        ).json()
    assert body["assistant_message"] is None
    assert body["ai_error_code"] == ai_error_codes.PROVIDER_AUTH


def test_stream_hitting_a_rate_limit_says_rate_limited(client: TestClient) -> None:
    sess_id = _session_with_key(client, key=True)

    async def failing_stream(messages, model, api_key, **kwargs):  # noqa: ARG001
        raise _SdkStatusError(429)
        yield ""  # pragma: no cover - makes this an async generator

    with patch("adaptive_learner_ai_anthropic.plugin._stream", side_effect=failing_stream):
        resp = client.post(
            f"/api/plugins/session/{sess_id}/message/stream", json={"role": "user", "content": "Hi"}
        )
    done = _parse_sse(resp.text)[-1]["data"]
    assert done["assistant_message"] is None
    assert done["ai_error_code"] == ai_error_codes.PROVIDER_RATE_LIMITED


def test_a_successful_turn_has_no_code(client: TestClient) -> None:
    sess_id = _session_with_key(client, key=True)
    with patch(
        "adaptive_learner_ai_anthropic.plugin._complete",
        return_value='{"advance":false,"confidence":0.5,"reason":"x","suggested_step":1}',
    ):
        body = client.post(
            f"/api/plugins/session/{sess_id}/message", json={"role": "user", "content": "Hi"}
        ).json()
    assert body["ai_error"] is None
    assert body["ai_error_code"] is None
