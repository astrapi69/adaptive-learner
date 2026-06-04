"""Programmatic GitHub pull-request creation for community sharing.

Replaces the old "open a pre-filled GitHub URL and hope the content
survives" approach (URL-length limits + browser differences left users
with empty PRs) with a real, token-authenticated flow that COMMITS the
lesson file and opens the pull request via the GitHub REST API:

    1. resolve the authenticated user (``GET /user``)
    2. fork the upstream content repo (idempotent — reuses an existing
       fork; ``POST /repos/{owner}/{repo}/forks``)
    3. create a branch on the fork from its base-branch HEAD
    4. commit the lesson JSON at the correct tree path
    5. best-effort: append the lesson filename to the set manifest's
       ``metadata.lessons`` list (skipped on any failure — the
       maintainer / CI can fix it)
    6. open the pull request fork -> upstream

This is the API-mode (server) implementation: the GitHub token is read
from the env > secrets.yaml chain and never leaves the backend. The
Dexie-mode (GitHub Pages) build runs the equivalent flow browser-direct
in ``frontend/src/lib/github/github-api.ts``.

All provider HTTP calls go through ``httpx`` (already a backend
dependency, same pattern as ``api_key_test`` / ``model_discovery``).
Failures surface as :class:`app.exceptions.ExternalServiceError` so the
global handler maps them to HTTP 502 with an actionable detail.
"""

from __future__ import annotations

import base64
import logging
import os
import time
from dataclasses import dataclass

import httpx
import yaml

from app.exceptions import ExternalServiceError, ValidationError
from app.services import secrets_service

logger = logging.getLogger(__name__)

_GITHUB_API = "https://api.github.com"
_HTTP_TIMEOUT_SECONDS = 20.0
#: GitHub Personal Access Token env override (highest precedence).
_TOKEN_ENV = "ADAPTIVE_LEARNER_GITHUB_TOKEN"
#: Forking is asynchronous; poll the fork's base ref until it appears.
_FORK_POLL_ATTEMPTS = 10
_FORK_POLL_INTERVAL_SECONDS = 2.0


@dataclass
class GitHubVerifyResult:
    """Outcome of a token verification. ``kind`` is a stable machine
    code the frontend maps to a localized message (mirrors
    ``ApiKeyTestOut.kind``): ok / invalid / rate_limit / network /
    error / no_token."""

    valid: bool
    username: str | None
    kind: str


@dataclass
class ManifestUpdate:
    """Best-effort manifest patch: append ``lesson_filename`` to the set
    manifest at ``{set_path}/manifest.yaml`` -> ``metadata.lessons``."""

    set_path: str
    lesson_filename: str


@dataclass
class CreatePrResult:
    """Result of a successful PR creation."""

    url: str
    number: int
    manifest_updated: bool


def resolve_token() -> str | None:
    """Resolve the GitHub token: env override first, then secrets.yaml."""
    env_token = os.environ.get(_TOKEN_ENV)
    if env_token and env_token.strip():
        return env_token.strip()
    return secrets_service.read_github_token()


def token_source() -> str:
    """Where the active token comes from: ``environment`` /
    ``secrets.yaml`` / ``none`` (for the Settings source display)."""
    env_token = os.environ.get(_TOKEN_ENV)
    if env_token and env_token.strip():
        return "environment"
    if secrets_service.read_github_token() is not None:
        return "secrets.yaml"
    return "none"


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _classify_status(status_code: int) -> str:
    if status_code in (401, 403):
        # 403 is also GitHub's rate-limit status; distinguish below.
        return "invalid"
    if status_code == 429:
        return "rate_limit"
    return "error"


def verify_token(token: str | None) -> GitHubVerifyResult:
    """Verify a GitHub token via ``GET /user``. Returns the login on
    success. Never raises — classifies the failure instead."""
    if not token or not token.strip():
        return GitHubVerifyResult(False, None, "no_token")
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            resp = client.get(f"{_GITHUB_API}/user", headers=_headers(token.strip()))
    except httpx.HTTPError as exc:
        logger.warning("GitHub token verify failed (network): %s", exc)
        return GitHubVerifyResult(False, None, "network")
    if 200 <= resp.status_code < 300:
        username = resp.json().get("login")
        return GitHubVerifyResult(True, username, "ok")
    # A 403 with a rate-limit marker is throttling, not a bad token.
    if resp.status_code == 403 and resp.headers.get("x-ratelimit-remaining") == "0":
        return GitHubVerifyResult(False, None, "rate_limit")
    return GitHubVerifyResult(False, None, _classify_status(resp.status_code))


def _request(
    client: httpx.Client,
    method: str,
    url: str,
    token: str,
    *,
    json: dict | None = None,
    ok_statuses: tuple[int, ...] = (200, 201),
) -> httpx.Response:
    """Make an authenticated GitHub request, raising
    :class:`ExternalServiceError` on an unexpected status."""
    try:
        resp = client.request(method, url, headers=_headers(token), json=json)
    except httpx.HTTPError as exc:
        raise ExternalServiceError("github", f"network error: {exc}") from exc
    if resp.status_code not in ok_statuses:
        detail = _error_detail(resp)
        raise ExternalServiceError("github", f"{method} {url} -> HTTP {resp.status_code}: {detail}")
    return resp


def _error_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return resp.text[:200]
    if isinstance(body, dict):
        message = body.get("message", "")
        errors = body.get("errors")
        if errors:
            return f"{message} ({errors})"
        return str(message)
    return str(body)[:200]


def _parse_repo(full_name: str) -> tuple[str, str]:
    parts = full_name.split("/")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValidationError(f"Invalid repo (expected 'owner/repo'): {full_name!r}")
    return parts[0], parts[1]


def _ensure_fork(
    client: httpx.Client, token: str, upstream: str, base_branch: str
) -> tuple[str, str]:
    """Fork ``upstream`` (idempotent) and return ``(fork_full_name,
    fork_owner)``. Polls until the fork's base ref is readable so the
    subsequent branch-create does not race the async fork."""
    owner, repo = _parse_repo(upstream)
    resp = _request(
        client,
        "POST",
        f"{_GITHUB_API}/repos/{owner}/{repo}/forks",
        token,
        ok_statuses=(200, 201, 202),
    )
    body = resp.json()
    fork_full_name = body["full_name"]
    fork_owner = body["owner"]["login"]
    # Wait for the fork's base branch to be readable (new forks are
    # provisioned asynchronously; existing forks resolve immediately).
    for _ in range(_FORK_POLL_ATTEMPTS):
        ref = client.get(
            f"{_GITHUB_API}/repos/{fork_full_name}/git/ref/heads/{base_branch}",
            headers=_headers(token),
        )
        if 200 <= ref.status_code < 300:
            return fork_full_name, fork_owner
        time.sleep(_FORK_POLL_INTERVAL_SECONDS)
    raise ExternalServiceError("github", f"fork {fork_full_name} not ready after polling")


def _base_sha(client: httpx.Client, token: str, fork: str, base_branch: str) -> str:
    resp = _request(
        client,
        "GET",
        f"{_GITHUB_API}/repos/{fork}/git/ref/heads/{base_branch}",
        token,
    )
    return str(resp.json()["object"]["sha"])


def _create_branch(client: httpx.Client, token: str, fork: str, branch: str, from_sha: str) -> None:
    _request(
        client,
        "POST",
        f"{_GITHUB_API}/repos/{fork}/git/refs",
        token,
        json={"ref": f"refs/heads/{branch}", "sha": from_sha},
    )


def _b64(content: str) -> str:
    return base64.b64encode(content.encode("utf-8")).decode("ascii")


def _get_file_sha(
    client: httpx.Client, token: str, fork: str, path: str, branch: str
) -> str | None:
    """Return the blob SHA of an existing file, or ``None`` if absent."""
    resp = client.get(
        f"{_GITHUB_API}/repos/{fork}/contents/{path}",
        headers=_headers(token),
        params={"ref": branch},
    )
    if 200 <= resp.status_code < 300:
        body = resp.json()
        if isinstance(body, dict):
            return body.get("sha")
    return None


def _commit_file(
    client: httpx.Client,
    token: str,
    fork: str,
    branch: str,
    path: str,
    content: str,
    message: str,
    *,
    sha: str | None = None,
) -> None:
    payload: dict = {
        "message": message,
        "content": _b64(content),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    _request(
        client,
        "PUT",
        f"{_GITHUB_API}/repos/{fork}/contents/{path}",
        token,
        json=payload,
    )


def _try_update_manifest(
    client: httpx.Client,
    token: str,
    fork: str,
    branch: str,
    update: ManifestUpdate,
) -> bool:
    """Best-effort: append the lesson filename to the set manifest's
    ``metadata.lessons``. Returns True only when the manifest existed and
    was updated. Never raises — a missing manifest (new set) or any error
    means the maintainer / CI handles the listing instead."""
    manifest_path = f"{update.set_path.rstrip('/')}/manifest.yaml"
    try:
        resp = client.get(
            f"{_GITHUB_API}/repos/{fork}/contents/{manifest_path}",
            headers=_headers(token),
            params={"ref": branch},
        )
        if not (200 <= resp.status_code < 300):
            return False
        body = resp.json()
        sha = body.get("sha")
        raw = base64.b64decode(body.get("content", "")).decode("utf-8")
        manifest = yaml.safe_load(raw)
        if not isinstance(manifest, dict):
            return False
        metadata = manifest.setdefault("metadata", {})
        if not isinstance(metadata, dict):
            return False
        lessons = metadata.get("lessons")
        if not isinstance(lessons, list):
            lessons = []
        if update.lesson_filename in lessons:
            return False  # already listed; nothing to do
        lessons.append(update.lesson_filename)
        metadata["lessons"] = lessons
        new_raw = yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True)
        _commit_file(
            client,
            token,
            fork,
            branch,
            manifest_path,
            new_raw,
            f"content: list {update.lesson_filename} in manifest",
            sha=sha,
        )
        return True
    except (httpx.HTTPError, ExternalServiceError, ValueError, yaml.YAMLError) as exc:
        logger.info("Manifest update skipped (%s): %s", manifest_path, exc)
        return False


def _create_pull_request(
    client: httpx.Client,
    token: str,
    upstream: str,
    head: str,
    base_branch: str,
    title: str,
    body: str,
) -> CreatePrResult:
    resp = _request(
        client,
        "POST",
        f"{_GITHUB_API}/repos/{upstream}/pulls",
        token,
        json={"title": title, "body": body, "head": head, "base": base_branch},
    )
    pr = resp.json()
    return CreatePrResult(url=pr["html_url"], number=pr["number"], manifest_updated=False)


def create_lesson_pr(
    token: str,
    *,
    upstream: str,
    base_branch: str,
    branch_name: str,
    file_path: str,
    file_content: str,
    commit_message: str,
    pr_title: str,
    pr_body: str,
    manifest_update: ManifestUpdate | None = None,
) -> CreatePrResult:
    """Run the full fork -> branch -> commit -> (manifest) -> PR flow.

    Raises :class:`ValidationError` on a malformed token / repo and
    :class:`ExternalServiceError` (HTTP 502) on any GitHub failure.
    """
    if not token or not token.strip():
        raise ValidationError("A GitHub token is required to create a pull request.")
    token = token.strip()
    _parse_repo(upstream)  # validate early

    with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS) as client:
        fork_full_name, fork_owner = _ensure_fork(client, token, upstream, base_branch)
        base_sha = _base_sha(client, token, fork_full_name, base_branch)
        _create_branch(client, token, fork_full_name, branch_name, base_sha)
        _commit_file(
            client,
            token,
            fork_full_name,
            branch_name,
            file_path,
            file_content,
            commit_message,
        )
        manifest_updated = False
        if manifest_update is not None:
            manifest_updated = _try_update_manifest(
                client, token, fork_full_name, branch_name, manifest_update
            )
        result = _create_pull_request(
            client,
            token,
            upstream,
            f"{fork_owner}:{branch_name}",
            base_branch,
            pr_title,
            pr_body,
        )
    result.manifest_updated = manifest_updated
    return result


__all__ = [
    "CreatePrResult",
    "GitHubVerifyResult",
    "ManifestUpdate",
    "create_lesson_pr",
    "resolve_token",
    "token_source",
    "verify_token",
]
