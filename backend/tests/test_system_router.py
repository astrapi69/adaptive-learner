"""Phase 14A tests for the system-info endpoint.

Asserts SHAPE rather than exact values: the payload's exact
strings depend on the running Python + platform + git state per
environment, so we pin the contract (every section present,
every required key present, types correct, missing dependencies
surface as None).
"""

from __future__ import annotations

import subprocess

import pytest
from fastapi.testclient import TestClient

from app.routers.system import router as system_router
from tests.router_test_client import make_client


@pytest.fixture()
def client() -> TestClient:
    return make_client(system_router)


def test_info_returns_app_section(client: TestClient):
    resp = client.get("/api/system/info")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    app_section = body["app"]
    assert app_section["name"] == "Adaptive Learner"
    assert isinstance(app_section["version"], str)
    assert isinstance(app_section["license"], str)
    assert isinstance(app_section["authors"], list)
    assert (
        app_section["repository_url"]
        == "https://github.com/astrapi69/adaptive-learner"
    )
    assert (
        app_section["issues_url"]
        == "https://github.com/astrapi69/adaptive-learner/issues"
    )
    assert app_section["docs_url"].startswith("https://astrapi69.github.io/")
    assert isinstance(app_section["build_hash"], str)
    assert isinstance(app_section["build_date"], str)


def test_info_returns_runtime_section(client: TestClient):
    body = client.get("/api/system/info").json()
    runtime = body["runtime"]
    # Python major.minor.patch at minimum.
    assert runtime["python_version"].count(".") >= 1
    assert isinstance(runtime["platform_system"], str)
    assert isinstance(runtime["platform_release"], str)
    assert isinstance(runtime["platform_machine"], str)


def test_info_returns_dependencies_section(client: TestClient):
    body = client.get("/api/system/info").json()
    deps = body["dependencies"]
    # Each known dep is either a version string or None (graceful
    # degrade for stripped installs).
    for key in ("fastapi", "sqlalchemy", "pydantic", "pluginforge"):
        assert key in deps
        assert deps[key] is None or isinstance(deps[key], str)
    # The test env has all four installed, so at least fastapi
    # should resolve.
    assert isinstance(deps["fastapi"], str)


def test_info_returns_paths_section(client: TestClient):
    body = client.get("/api/system/info").json()
    paths = body["paths"]
    assert isinstance(paths["database_path"], str)
    assert isinstance(paths["data_directory"], str)
    # The conftest pins ADAPTIVE_LEARNER_DATA_DIR to a tmp path;
    # the database_path should anchor under that data_directory.
    assert paths["database_path"].startswith(paths["data_directory"])


def test_info_build_hash_is_short_or_unknown(client: TestClient):
    body = client.get("/api/system/info").json()
    build_hash = body["app"]["build_hash"]
    # ``git rev-parse --short HEAD`` returns 7-12 hex chars; or
    # the fallback sentinel ``unknown`` when git isn't reachable.
    assert build_hash == "unknown" or (
        len(build_hash) >= 7 and all(c in "0123456789abcdef" for c in build_hash)
    )


def test_info_build_hash_fallback_when_git_unavailable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """When ``subprocess.run`` raises FileNotFoundError (no git),
    build_hash must collapse to the ``unknown`` sentinel."""

    def boom(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess:
        raise FileNotFoundError("no git here")

    monkeypatch.setattr(subprocess, "run", boom)
    body = client.get("/api/system/info").json()
    assert body["app"]["build_hash"] == "unknown"
    # build_date should fall back to "now" — present and ISO-shaped.
    assert "T" in body["app"]["build_date"]


def test_info_endpoint_returns_json_content_type(client: TestClient):
    resp = client.get("/api/system/info")
    assert resp.headers["content-type"].startswith("application/json")
