"""Help glossary service (Phase 38).

Reads the authoring YAML files under
``backend/config/help/{category}.{lang}.yaml`` and exposes a
lookup API consumed by ``app.routers.help``.

The frontend has its own copy of the same content under
``frontend/src/data/help/`` (regenerated via ``make sync-help``),
so this service is the API-side mirror, not the only source.
Both paths read from the same authoring YAML at build / runtime
respectively.

Module-level cache: the YAML files are read once on first access
and held in process memory. Test isolation requires
``clear_cache()`` to be called between tests that monkeypatch
the config directory (per
``lessons-learned.md`` § "Module-level caches survive test
boundaries").
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

# Languages with native content. Other ISO codes get resolved
# to ``en`` by the router (lingua-franca fallback) until a
# proper translation lands; ES / FR / EL / PT / TR / JA receive
# EN-passthrough copies in 38F so the parity tests stay green.
SUPPORTED_LANGS = frozenset({"en", "de", "es", "fr", "el", "pt", "tr", "ja"})

CATEGORIES = ("concepts", "methods", "steps", "features")

_DEFAULT_HELP_DIR = Path(__file__).resolve().parent.parent.parent / "config" / "help"


def _help_dir() -> Path:
    """Authoring directory. Override via ``app.paths`` later if
    Adaptive Learner ever splits config across paths; today this
    is a single deterministic location next to the i18n YAMLs."""
    return _DEFAULT_HELP_DIR


@lru_cache(maxsize=64)
def _load_category(category: str, lang: str) -> list[dict[str, object]]:
    """Return the ``entries`` list for one category × language,
    or an empty list if the YAML file does not exist (intended
    for languages that haven't received content yet)."""
    if category not in CATEGORIES:
        return []
    if lang not in SUPPORTED_LANGS:
        return []
    path = _help_dir() / f"{category}.{lang}.yaml"
    if not path.exists():
        return []
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    entries = raw.get("entries") or []
    out: list[dict[str, object]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        out.append(
            {
                "key": entry.get("key", ""),
                "title": entry.get("title", ""),
                "short": entry.get("short", ""),
                "long": entry.get("long", ""),
                "category": category,
            }
        )
    return out


def list_entries(lang: str, *, category: str | None = None) -> list[dict[str, object]]:
    """Return every entry for the language, optionally filtered
    by category. The ordering is stable: category order
    (concepts -> methods -> steps -> features), then the order
    inside each YAML file."""
    out: list[dict[str, object]] = []
    cats = (category,) if category else CATEGORIES
    for cat in cats:
        if cat not in CATEGORIES:
            continue
        out.extend(_load_category(cat, lang))
    return out


def get_entry(key: str, lang: str) -> dict[str, object] | None:
    """Find an entry by key (across all categories). Returns
    ``None`` if the key is missing in the requested language."""
    for cat in CATEGORIES:
        for entry in _load_category(cat, lang):
            if entry.get("key") == key:
                return entry
    return None


def clear_cache() -> None:
    """Drop the YAML cache. Test-only - production never calls
    this, but tests that monkeypatch ``_help_dir`` or rewrite
    files must call this in both setup and teardown per the
    "Module-level caches survive test boundaries" rule."""
    _load_category.cache_clear()
