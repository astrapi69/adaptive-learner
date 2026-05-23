"""Adaptive Learner Anki plugin (Phase 30).

Extracts flashcard candidates from completed sessions + imported
conversations (via the existing ``ai_complete`` hook), persists
them as ``anki_card_suggestions`` rows, and serves them through
``/api/plugins/anki/*`` so the frontend export page can review +
accept + edit + bundle into a .apkg.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-anki")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
