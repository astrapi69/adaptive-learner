"""GitHub raw-URL adapter (Phase 43 / EXP-002 / 2C-github - P-106).

Thin async wrapper around ``httpx.AsyncClient`` that fetches
files from public GitHub repos via the raw.githubusercontent.com
CDN. Public repos work tokenless; private repos accept an
optional token via the three-layer secrets chain
(env > secrets.yaml > Fernet DB), resolved by the caller —
this module just takes a ``token`` parameter.

Why raw.githubusercontent.com and not the GitHub API:

- No rate limits for unauthenticated requests on public
  repos (the API caps at 60/h tokenless).
- Public assets are CDN-cached by GitHub — much faster
  globally.
- The bytes returned are EXACTLY the file content (no JSON
  envelope, no base64 wrapping), so the cache layer can
  hash them and trust the hash.

The adapter is intentionally low-level: it fetches text or
bytes from a URL. Manifest parsing, schema validation, and
cache-version reconciliation are higher-layer concerns that
live in commit 5 (cache + manifest parser).
"""

from __future__ import annotations

from typing import Any

import httpx
import yaml

from .exceptions import (
    ContentAuthError,
    ContentFetchError,
    ContentNetworkError,
    ContentNotFoundError,
)

DEFAULT_TIMEOUT_SECONDS = 20.0
RAW_BASE = "https://raw.githubusercontent.com"


def build_raw_url(source: str, branch: str, path: str) -> str:
    """Build the canonical raw.githubusercontent.com URL.

    Args:
        source: GitHub ``owner/name`` slug
            (e.g. ``astrapi69/adaptive-learner-content``).
        branch: branch / tag / commit SHA to read from.
        path: repo-relative file path (``manifest.yaml``,
            ``sets/fr-a1/lessons/01-greetings.json``).

    Returns:
        Full HTTPS URL. The caller is responsible for
        URL-escaping any spaces in the path (content authors
        should avoid those, but the adapter does not enforce).
    """
    safe_path = path.lstrip("/")
    return f"{RAW_BASE}/{source}/{branch}/{safe_path}"


def _auth_headers(token: str | None) -> dict[str, str]:
    if not token:
        return {}
    # raw.githubusercontent.com accepts both classic "token X"
    # and fine-grained "Bearer X" auth on this exact host.
    # Match the GitHub docs default ("token X") so classic PATs
    # work without extra config.
    return {"Authorization": f"token {token}"}


def _wrap_http_error(
    url: str,
    err: httpx.HTTPStatusError,
) -> ContentNotFoundError | ContentAuthError | ContentFetchError:
    status = err.response.status_code
    if status == 404:
        return ContentNotFoundError(
            f"Not found on upstream: {url}",
            detail=f"GitHub returned 404 for {url}",
        )
    if status in (401, 403):
        return ContentAuthError(
            f"Authentication failed for {url}",
            detail=(
                f"GitHub returned {status} for {url} "
                "(token missing, expired, or insufficient "
                "scope for this repo)"
            ),
        )
    return ContentFetchError(
        f"Upstream HTTP {status} for {url}",
        detail=f"GitHub returned {status} for {url}: "
        f"{err.response.text[:200]}",
    )


class GitHubRawAdapter:
    """Async fetcher for files from public + private GitHub repos.

    Stateless aside from the optional token. Reuse a single
    instance per request (or per app lifetime) to amortise
    httpx connection pooling.
    """

    def __init__(
        self,
        *,
        token: str | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._token = token
        self._timeout = timeout_seconds

    @property
    def has_token(self) -> bool:
        """True iff a token was supplied at construction.

        The Settings UI surfaces this so the user knows
        whether they're hitting public or private repos.
        """
        return bool(self._token)

    async def fetch_bytes(
        self,
        source: str,
        branch: str,
        path: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> bytes:
        """Fetch a single file as raw bytes.

        Args:
            source / branch / path: as for ``build_raw_url``.
            client: optional shared ``httpx.AsyncClient`` so
                the cache layer can batch multiple file
                fetches over one TCP connection. When None,
                a per-call client is created and closed.

        Raises:
            ContentNotFoundError, ContentAuthError,
            ContentFetchError, ContentNetworkError.
        """
        url = build_raw_url(source, branch, path)
        headers = _auth_headers(self._token)

        owns_client = client is None
        if client is None:
            client = httpx.AsyncClient(timeout=self._timeout)
        try:
            try:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
            except httpx.HTTPStatusError as err:
                raise _wrap_http_error(url, err) from err
            except (httpx.ConnectError, httpx.ReadTimeout) as err:
                raise ContentNetworkError(
                    f"Network error fetching {url}",
                    detail=str(err),
                ) from err
            return response.content
        finally:
            if owns_client:
                await client.aclose()

    async def fetch_text(
        self,
        source: str,
        branch: str,
        path: str,
        *,
        client: httpx.AsyncClient | None = None,
        encoding: str = "utf-8",
    ) -> str:
        """Fetch a single file as decoded text.

        UTF-8 by default; content authors should ship every
        manifest + lesson file in UTF-8 (the BACKLOG sets
        this convention).
        """
        payload = await self.fetch_bytes(
            source, branch, path, client=client,
        )
        return payload.decode(encoding)

    async def fetch_yaml(
        self,
        source: str,
        branch: str,
        path: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> Any:
        """Fetch + YAML-parse. Returns whatever the YAML document is.

        Used for manifest.yaml fetches. The caller passes the
        result to Pydantic for validation.
        """
        text = await self.fetch_text(source, branch, path, client=client)
        return yaml.safe_load(text)

    async def fetch_json(
        self,
        source: str,
        branch: str,
        path: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> Any:
        """Fetch + JSON-parse. Used for lesson .json fetches."""
        import json

        text = await self.fetch_text(source, branch, path, client=client)
        return json.loads(text)
