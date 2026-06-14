"""Tests for the author book-metadata validator (EXP-025 / AUTH-01)."""

from __future__ import annotations

from validate_content import validate_book


def _errors(book: object) -> list[str]:
    errors: list[str] = []
    validate_book({"book": book} if book is not None else {}, errors)
    return errors


def test_no_book_block_is_valid() -> None:
    assert _errors(None) == []


def test_minimal_valid_book() -> None:
    assert (
        _errors(
            {
                "title": "KI für Einsteiger",
                "author": "Asterios Raptis",
                "url": "https://example.com/book",
            }
        )
        == []
    )


def test_optional_fields_accepted() -> None:
    assert (
        _errors(
            {
                "title": "T",
                "author": "A",
                "url": "https://example.com/b",
                "subtitle": "Sub",
                "isbn": "978-3-16-148410-0",
                "edition": "2nd",
                "pages": 320,
                "year": 2026,
                "cover": "cover.png",
            }
        )
        == []
    )


def test_missing_required_fields() -> None:
    errors = _errors({"author": "A", "url": "https://x.de/b"})
    assert any("title" in e for e in errors)


def test_url_must_be_http() -> None:
    errors = _errors({"title": "T", "author": "A", "url": "ftp://x.de/b"})
    assert any("http(s)" in e for e in errors)


def test_affiliate_url_rejected() -> None:
    errors = _errors(
        {"title": "T", "author": "A", "url": "https://www.amazon.de/dp/123?tag=aff-21"}
    )
    assert any("affiliate" in e for e in errors)


def test_non_integer_pages_rejected() -> None:
    errors = _errors({"title": "T", "author": "A", "url": "https://x.de/b", "pages": "lots"})
    assert any("pages" in e for e in errors)


def test_unknown_field_rejected() -> None:
    errors = _errors({"title": "T", "author": "A", "url": "https://x.de/b", "price": "9.99"})
    assert any("unknown" in e for e in errors)
