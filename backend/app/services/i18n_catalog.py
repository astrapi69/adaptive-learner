"""i18n catalogs for ``GET /api/i18n/{lang}``, parsed once per file version (#3716).

``pluginforge.config.load_i18n`` parses the whole YAML catalog on every call,
and the frontend asks for a catalog on every app start and language switch.
This module caches the parsed result in process, keyed by language and the
file's ``st_mtime_ns``, so an edited catalog (``make sync-i18n``, a hand edit
in development) is read again on the next request without a restart.

The language code is validated first, as ``load_i18n`` does, and the
modification-time lookup never builds a path from it at all: it picks the
catalog file out of the directory listing by name, so no ``stat()`` sees a
path made from request input (CodeQL ``py/path-injection`` does not count
``validate_plugin_name`` as a sanitizer). Everything else is ``load_i18n``
unchanged: the same answer, ``{}`` for a missing file, the same error for an
invalid code.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pluginforge.config import load_i18n
from pluginforge.security import validate_plugin_name


def _mtime_ns(i18n_dir: Path, lang: str) -> int | None:
    """Modification time of ``<lang>.yaml`` in ``i18n_dir``, ``None`` when absent.

    The file is taken from the directory listing, never built from ``lang``.
    """
    try:
        catalog = next(
            (entry for entry in i18n_dir.iterdir() if entry.name == f"{lang}.yaml"), None
        )
        return catalog.stat().st_mtime_ns if catalog is not None else None
    except OSError:
        return None


@lru_cache(maxsize=32)
def _parsed(config_dir: str, lang: str, mtime_ns: int | None) -> dict[str, Any]:
    """Parse one catalog; ``mtime_ns`` only keys the cache."""
    return load_i18n(Path(config_dir), lang)


def load_catalog(config_dir: Path, lang: str) -> dict[str, Any]:
    """Return the i18n catalog of ``lang``, parsed once per file version.

    Args:
        config_dir: The config directory holding ``i18n/<lang>.yaml``.
        lang: Language code, validated before any path is built.

    Returns:
        A shallow copy of the parsed catalog; ``{}`` when the file is missing.

    Raises:
        InvalidPluginNameError: when ``lang`` is not a plain code, as
            ``load_i18n`` raises it.

    Example:
        >>> load_catalog(BASE_DIR / "config", "de")["nav"]  # doctest: +SKIP
    """
    validate_plugin_name(lang)
    mtime_ns = _mtime_ns(config_dir / "i18n", lang)
    return dict(_parsed(str(config_dir), lang, mtime_ns))


def clear_cache() -> None:
    """Drop every cached catalog (tests)."""
    _parsed.cache_clear()
