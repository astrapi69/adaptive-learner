"""Help glossary router (Phase 38).

Serves the educational glossary content authored under
``backend/config/help/*.yaml``. The frontend bundles the same
content via ``make sync-help`` (the JSON files under
``frontend/src/data/help/``) so tooltips render without a network
roundtrip; this endpoint exists as a parallel API surface for
other consumers (future Anki export, NotebookLM study guide,
external tools that want the canonical glossary in JSON).

Per ``code-hygiene.md``: routes stay thin, no business logic
here. The YAML walker lives in ``app.services.help_glossary`` so
it stays unit-testable without FastAPI.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.exceptions import NotFoundError
from app.services.help_glossary import (
    SUPPORTED_LANGS,
    get_entry,
    list_entries,
)

router = APIRouter(prefix="/help", tags=["help"])


def _resolve_lang(lang: str) -> str:
    """Map any lang code to a supported one, falling back to EN
    so a request for an unsupported locale gets the lingua franca
    instead of a 404."""
    if lang in SUPPORTED_LANGS:
        return lang
    base = lang.split("-")[0].lower()
    return base if base in SUPPORTED_LANGS else "en"


@router.get("/glossary")
def get_glossary(
    lang: str = Query("en", description="Language code (ISO 639-1)"),
    category: str | None = Query(
        None,
        description="Optional category filter: concepts | methods | steps | features",
    ),
) -> dict[str, object]:
    """Return every glossary entry for the given language.

    Response shape::

        {"lang": "de", "entries": [{"key", "title", "short",
        "long", "category"}, ...]}
    """
    resolved = _resolve_lang(lang)
    return {
        "lang": resolved,
        "entries": list_entries(resolved, category=category),
    }


@router.get("/glossary/{key}")
def get_glossary_entry(
    key: str,
    lang: str = Query("en", description="Language code (ISO 639-1)"),
) -> dict[str, object]:
    """Return a single glossary entry by stable key.

    Raises ``NotFoundError`` (-> HTTP 404) if the key does not
    exist in the requested language; the global exception
    handler maps it.
    """
    resolved = _resolve_lang(lang)
    entry = get_entry(key, resolved)
    if entry is None:
        raise NotFoundError(f"Glossary entry {key!r} not found")
    return entry
