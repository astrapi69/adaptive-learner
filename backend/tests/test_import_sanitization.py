# TEMPLATE: This test is included as adaptable example.
# Replace with your domain logic when project domain is finalized.

"""Tests for M-12: auto-sanitization during import via content_pre_import hook."""

from fastapi.testclient import TestClient

from app.main import app
from app.services.backup.markdown_utils import sanitize_import_markdown


def _cleanup(client: TestClient, book_id: str) -> None:
    client.delete(f"/api/books/{book_id}")
    client.delete(f"/api/books/trash/{book_id}")


def test_sanitize_import_markdown_passthrough_when_clean():
    """Clean content passes through unchanged."""
    with TestClient(app):
        clean = "# Titel\n\nEin sauberer Absatz."
        assert sanitize_import_markdown(clean, "de") == clean


def test_sanitize_import_markdown_handles_empty():
    assert sanitize_import_markdown("", "de") == ""


