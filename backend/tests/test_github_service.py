"""GitHub community-PR automation: service + router tests.

Covers the token storage (encrypted secrets.yaml round-trip), the token
resolver/source precedence, token verification (mocked httpx), the full
fork -> branch -> commit -> manifest -> PR flow (a scripted fake GitHub
API), and the ``/api/github/*`` routes via TestClient.

No real network: ``httpx.Client`` is replaced with a scripted fake that
dispatches on ``(method, url)``. Every test runs in an isolated
``tmp_path`` config dir so the real ``~/.config`` is never touched.
"""

from __future__ import annotations

import base64

import httpx
import pytest
import yaml
from fastapi.testclient import TestClient

from app.routers.github import router as github_router
from app.services import crypto, github_service, secrets_service
from tests.router_test_client import make_client


@pytest.fixture()
def config_env(tmp_path, monkeypatch):
    """Isolated config dir + no env secret key, so the file-based stable
    key + encrypted secrets.yaml are exercised."""
    monkeypatch.setenv("ADAPTIVE_LEARNER_CONFIG_DIR", str(tmp_path))
    monkeypatch.delenv("ADAPTIVE_LEARNER_SECRET_KEY", raising=False)
    monkeypatch.delenv("ADAPTIVE_LEARNER_GITHUB_TOKEN", raising=False)
    crypto.reset_fernet_cache()
    yield tmp_path
    crypto.reset_fernet_cache()


@pytest.fixture()
def client(config_env) -> TestClient:
    return make_client(github_router)


# --- token storage ----------------------------------------------------------


def test_github_token_roundtrip(config_env):
    assert secrets_service.read_github_token() is None
    secrets_service.write_github_token("ghp_secrettoken123")
    assert secrets_service.read_github_token() == "ghp_secrettoken123"
    # Stored encrypted, never plaintext.
    raw = (config_env / "secrets.yaml").read_text(encoding="utf-8")
    assert "ghp_secrettoken123" not in raw
    assert "token_encrypted" in raw


def test_github_token_clear_is_idempotent(config_env):
    secrets_service.clear_github_token()  # no file yet
    secrets_service.write_github_token("ghp_x")
    secrets_service.clear_github_token()
    assert secrets_service.read_github_token() is None
    secrets_service.clear_github_token()  # again, still fine


def test_github_token_clear_preserves_ai_block(config_env):
    secrets_service.write_api_key("anthropic", "sk-ant-keep")
    secrets_service.write_github_token("ghp_drop")
    secrets_service.clear_github_token()
    assert secrets_service.read_github_token() is None
    assert secrets_service.read_api_key("anthropic") == "sk-ant-keep"


def test_token_source_precedence(config_env, monkeypatch):
    assert github_service.token_source() == "none"
    secrets_service.write_github_token("ghp_fromfile")
    assert github_service.token_source() == "secrets.yaml"
    assert github_service.resolve_token() == "ghp_fromfile"
    monkeypatch.setenv("ADAPTIVE_LEARNER_GITHUB_TOKEN", "ghp_fromenv")
    assert github_service.token_source() == "environment"
    assert github_service.resolve_token() == "ghp_fromenv"


# --- scripted fake GitHub API ----------------------------------------------


class _FakeResponse:
    def __init__(self, status_code: int, json_body=None, headers=None) -> None:
        self.status_code = status_code
        self._json = json_body if json_body is not None else {}
        self.headers = headers or {}
        self.text = str(self._json)

    def json(self):
        return self._json


class _FakeClient:
    """Dispatches on ``(METHOD, url-substring)`` from a handler map.

    Each handler receives ``(json, params)`` and returns a
    ``_FakeResponse``. Records calls for assertions.
    """

    def __init__(self, handlers) -> None:
        self._handlers = handlers
        self.calls: list[tuple[str, str, dict | None]] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def _dispatch(self, method, url, *, json=None, params=None):
        self.calls.append((method, url, json))
        for (m, fragment), handler in self._handlers.items():
            if m == method and fragment in url:
                return handler(json, params)
        raise AssertionError(f"unscripted request: {method} {url}")

    def get(self, url, *, headers=None, params=None):
        return self._dispatch("GET", url, params=params)

    def request(self, method, url, *, headers=None, json=None):
        return self._dispatch(method, url, json=json)


def _install_fake(monkeypatch, handlers):
    fake = _FakeClient(handlers)
    monkeypatch.setattr(github_service.httpx, "Client", lambda *a, **k: fake)
    return fake


# --- verify_token -----------------------------------------------------------


def test_verify_token_ok(monkeypatch):
    _install_fake(
        monkeypatch,
        {("GET", "/user"): lambda j, p: _FakeResponse(200, {"login": "octocat"})},
    )
    result = github_service.verify_token("ghp_good")
    assert result.valid is True
    assert result.username == "octocat"
    assert result.kind == "ok"


def test_verify_token_no_token():
    result = github_service.verify_token("")
    assert result.kind == "no_token"
    assert result.valid is False


def test_verify_token_invalid(monkeypatch):
    _install_fake(
        monkeypatch,
        {("GET", "/user"): lambda j, p: _FakeResponse(401, {"message": "Bad creds"})},
    )
    result = github_service.verify_token("ghp_bad")
    assert result.valid is False
    assert result.kind == "invalid"


def test_verify_token_rate_limited(monkeypatch):
    _install_fake(
        monkeypatch,
        {
            ("GET", "/user"): lambda j, p: _FakeResponse(
                403, {"message": "rate"}, {"x-ratelimit-remaining": "0"}
            )
        },
    )
    result = github_service.verify_token("ghp_throttled")
    assert result.kind == "rate_limit"


def test_verify_token_network_failure(monkeypatch):
    class _Boom:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def get(self, *a, **k):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(github_service.httpx, "Client", lambda *a, **k: _Boom())
    result = github_service.verify_token("ghp_x")
    assert result.kind == "network"


# --- full create_lesson_pr flow ---------------------------------------------


def _pr_handlers(*, with_manifest: bool):
    """Scripted happy-path GitHub responses for the full flow."""
    manifest_yaml = yaml.safe_dump(
        {
            "name": "Set",
            "metadata": {"author": "x", "lessons": ["01-intro.json"]},
        }
    )
    state = {"manifest_commits": 0, "lesson_commits": 0}

    def fork(j, p):
        return _FakeResponse(
            202,
            {"full_name": "octocat/content", "owner": {"login": "octocat"}},
        )

    def fork_ref(j, p):
        return _FakeResponse(200, {"object": {"sha": "basesha123"}})

    def create_ref(j, p):
        assert j["ref"] == "refs/heads/add-intro-2026-06-03"
        assert j["sha"] == "basesha123"
        return _FakeResponse(201, {"ref": j["ref"]})

    def contents_get(j, p):
        # manifest.yaml exists; lesson file does not.
        return _FakeResponse(
            200,
            {
                "sha": "manifestsha",
                "content": base64.b64encode(manifest_yaml.encode("utf-8")).decode("ascii"),
            },
        )

    def contents_put(j, p):
        if "manifest.yaml" in j["message"] or "list" in j["message"]:
            state["manifest_commits"] += 1
        else:
            state["lesson_commits"] += 1
        return _FakeResponse(201, {"content": {"sha": "newsha"}})

    def create_pr(j, p):
        assert j["head"] == "octocat:add-intro-2026-06-03"
        assert j["base"] == "main"
        return _FakeResponse(201, {"html_url": "https://github.com/up/content/pull/7", "number": 7})

    handlers = {
        ("POST", "/forks"): fork,
        ("GET", "/git/ref/heads/main"): fork_ref,
        ("POST", "/git/refs"): create_ref,
        ("GET", "/contents/"): contents_get,
        ("PUT", "/contents/"): contents_put,
        ("POST", "/pulls"): create_pr,
    }
    return handlers, state


def test_create_lesson_pr_full_flow(monkeypatch):
    handlers, state = _pr_handlers(with_manifest=True)
    _install_fake(monkeypatch, handlers)
    result = github_service.create_lesson_pr(
        "ghp_token",
        github_service.LessonPrRequest(
            upstream="up/content",
            base_branch="main",
            branch_name="add-intro-2026-06-03",
            file_path="sets/de/es-a1/lessons/16-intro.json",
            file_content='{"id":"x"}',
            commit_message="content: Intro",
            pr_title="content: Intro",
            pr_body="body",
            manifest_update=github_service.ManifestUpdate(
                set_path="sets/de/es-a1", lesson_filename="16-intro.json"
            ),
        ),
    )
    assert result.url == "https://github.com/up/content/pull/7"
    assert result.number == 7
    assert result.manifest_updated is True
    assert state["lesson_commits"] == 1
    assert state["manifest_commits"] == 1


def test_create_lesson_pr_without_manifest_update(monkeypatch):
    handlers, state = _pr_handlers(with_manifest=False)
    _install_fake(monkeypatch, handlers)
    result = github_service.create_lesson_pr(
        "ghp_token",
        github_service.LessonPrRequest(
            upstream="up/content",
            base_branch="main",
            branch_name="add-intro-2026-06-03",
            file_path="sets/de/es-a1/lessons/16-intro.json",
            file_content='{"id":"x"}',
            commit_message="content: Intro",
            pr_title="content: Intro",
            pr_body="body",
            manifest_update=None,
        ),
    )
    assert result.manifest_updated is False
    assert state["manifest_commits"] == 0


def test_create_lesson_pr_manifest_failure_is_non_fatal(monkeypatch):
    handlers, _ = _pr_handlers(with_manifest=True)
    # Manifest GET returns 404 (new set, no manifest) -> skipped, PR still opens.
    handlers[("GET", "/contents/")] = lambda j, p: _FakeResponse(404, {})
    _install_fake(monkeypatch, handlers)
    result = github_service.create_lesson_pr(
        "ghp_token",
        github_service.LessonPrRequest(
            upstream="up/content",
            base_branch="main",
            branch_name="add-intro-2026-06-03",
            file_path="sets/de/es-a1/lessons/16-intro.json",
            file_content='{"id":"x"}',
            commit_message="content: Intro",
            pr_title="content: Intro",
            pr_body="body",
            manifest_update=github_service.ManifestUpdate(
                set_path="sets/de/es-a1", lesson_filename="16-intro.json"
            ),
        ),
    )
    assert result.number == 7
    assert result.manifest_updated is False


def test_create_lesson_pr_rejects_empty_token():
    from app.exceptions import ValidationError

    with pytest.raises(ValidationError):
        github_service.create_lesson_pr(
            "",
            github_service.LessonPrRequest(
                upstream="up/content",
                base_branch="main",
                branch_name="b",
                file_path="p.json",
                file_content="{}",
                commit_message="m",
                pr_title="t",
                pr_body="b",
            ),
        )


def test_create_lesson_pr_github_error_maps_to_502(monkeypatch):
    from app.exceptions import ExternalServiceError

    handlers, _ = _pr_handlers(with_manifest=True)
    handlers[("POST", "/forks")] = lambda j, p: _FakeResponse(403, {"message": "no scope"})
    _install_fake(monkeypatch, handlers)
    with pytest.raises(ExternalServiceError):
        github_service.create_lesson_pr(
            "ghp_token",
            github_service.LessonPrRequest(
                upstream="up/content",
                base_branch="main",
                branch_name="b",
                file_path="p.json",
                file_content="{}",
                commit_message="m",
                pr_title="t",
                pr_body="b",
            ),
        )


# --- router -----------------------------------------------------------------


def test_route_token_status_lifecycle(client):
    assert client.get("/api/github/token").json() == {
        "configured": False,
        "source": "none",
    }
    resp = client.post("/api/github/token", json={"token": "ghp_abc"})
    assert resp.status_code == 200
    assert resp.json() == {"configured": True, "source": "secrets.yaml"}
    assert client.get("/api/github/token").json()["configured"] is True
    assert client.request("DELETE", "/api/github/token").json()["configured"] is False


def test_route_verify_token(client, monkeypatch):
    _install_fake(
        monkeypatch,
        {("GET", "/user"): lambda j, p: _FakeResponse(200, {"login": "aster"})},
    )
    resp = client.post("/api/github/verify-token", json={"token": "ghp_x"})
    assert resp.status_code == 200
    assert resp.json() == {"valid": True, "username": "aster", "kind": "ok"}


def test_route_create_pr(client, config_env, monkeypatch):
    secrets_service.write_github_token("ghp_stored")
    handlers, _ = _pr_handlers(with_manifest=True)
    _install_fake(monkeypatch, handlers)
    resp = client.post(
        "/api/github/create-pr",
        json={
            "upstream": "up/content",
            "base_branch": "main",
            "branch_name": "add-intro-2026-06-03",
            "file_path": "sets/de/es-a1/lessons/16-intro.json",
            "file_content": '{"id":"x"}',
            "commit_message": "content: Intro",
            "pr_title": "content: Intro",
            "pr_body": "body",
            "manifest_update": {
                "set_path": "sets/de/es-a1",
                "lesson_filename": "16-intro.json",
            },
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "url": "https://github.com/up/content/pull/7",
        "number": 7,
        "manifest_updated": True,
    }
