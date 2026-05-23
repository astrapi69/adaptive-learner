"""Adaptive Learner Anki plugin (Phase 30).

Extracts flashcard candidates from completed sessions + imported
conversations (via the existing ``ai_complete`` hook), persists
them as ``anki_card_suggestions`` rows, and serves them through
``/api/plugins/anki/*`` so the frontend export page can review +
accept + edit + bundle into a .apkg.
"""

__version__ = "1.24.0"
