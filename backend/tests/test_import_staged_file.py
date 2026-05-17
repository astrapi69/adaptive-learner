# TEMPLATE: This test is included as adaptable example.
# Replace with your domain logic when project domain is finalized.

"""Tests for GET /api/import/staged/{temp_ref}/file.

Serves staged preview assets (cover thumbnails + any other image)
so the wizard's Step 3 CoverThumbnail can render the actual image
before the user commits the import.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def test_staged_file_rejects_path_traversal(client: TestClient) -> None:
    resp = client.get(
        "/api/import/staged/imp-nonexistent/file",
        params={"path": "../../etc/passwd"},
    )
    assert resp.status_code == 400


def test_staged_file_rejects_unknown_temp_ref(client: TestClient) -> None:
    resp = client.get(
        "/api/import/staged/imp-does-not-exist/file",
        params={"path": "assets/covers/cover.png"},
    )
    assert resp.status_code == 404
