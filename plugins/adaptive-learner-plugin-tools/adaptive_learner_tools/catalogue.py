"""Static tool catalogue + ranking algorithm.

Five tools cover the six methods well enough for v0.1.0 (the
three baselines from project-reference §3.4 — Anki, NotebookLM,
adaptive-AI-prompt — plus Excalidraw + Obsidian to round out the
contextual / inductive coverage). Each entry's ``weight_keys``
declares the methods the tool best serves; ranking sums the
user's profile weights across those keys.

DE + EN inline; anything outside ``de*`` falls back to EN.
"""

from __future__ import annotations

from typing import Any, TypedDict

METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)

DEFAULT_LIMIT = 5


class _Tool(TypedDict):
    name: str
    url: str
    why_de: str
    why_en: str
    weight_keys: list[str]


# Order doesn't matter — :func:`rank_tools` sorts by relevance.
TOOLS: list[_Tool] = [
    {
        "name": "Anki",
        "url": "https://apps.ankiweb.net/",
        "why_de": (
            "Spaced-Repetition-Karteikarten — ideal um Regeln und Fehlerkorrekturen "
            "langfristig zu festigen."
        ),
        "why_en": (
            "Spaced-repetition flashcards — great for cementing rules and "
            "error-corrections long-term."
        ),
        "weight_keys": ["deductive", "error_based"],
    },
    {
        "name": "NotebookLM",
        "url": "https://notebooklm.google.com/",
        "why_de": (
            "Aktiver Wissensaufbau aus eigenen Quellen — passend wenn Beispiele "
            "und Kontext deine Methode sind."
        ),
        "why_en": (
            "Active knowledge-building from your own sources — fits when "
            "examples and context are your method."
        ),
        "weight_keys": ["inductive", "contextual"],
    },
    {
        "name": "Adaptive AI Prompt",
        "url": "https://claude.ai/",
        "why_de": (
            "Ein dialogischer KI-Assistent passt Tempo und Methode an deinen jeweiligen Stand an."
        ),
        "why_en": ("A dialogic AI assistant adapts pace and method to where you currently are."),
        "weight_keys": ["ai_adaptive", "dialogic"],
    },
    {
        "name": "Excalidraw",
        "url": "https://excalidraw.com/",
        "why_de": (
            "Visuelles Skizzieren — gut um Beispiele zu strukturieren oder "
            "Alltagssituationen zu modellieren."
        ),
        "why_en": (
            "Visual sketching — good for structuring examples or modelling everyday situations."
        ),
        "weight_keys": ["contextual", "inductive"],
    },
    {
        "name": "Obsidian",
        "url": "https://obsidian.md/",
        "why_de": (
            "Wissensgraph aus verlinkten Notizen — Theorie und Beispiele "
            "wandern in dieselbe Struktur."
        ),
        "why_en": (
            "Linked-notes knowledge graph — theory and examples land in the same structure."
        ),
        "weight_keys": ["deductive", "inductive"],
    },
]


def _lang_key(lang: str) -> str:
    return "de" if isinstance(lang, str) and lang.startswith("de") else "en"


def _score(tool: _Tool, profile: dict[str, Any]) -> float:
    """Sum the user's profile weights across the tool's
    weight_keys. Missing / non-numeric weights contribute 0.
    """
    total = 0.0
    for key in tool["weight_keys"]:
        val = profile.get(key)
        if isinstance(val, (int, float)):
            total += float(val)
    return total


def rank_tools(
    profile: dict[str, Any],
    lang: str,
    *,
    limit: int = DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    """Return the catalogue, scored + sorted by relevance.

    Empty / missing profile: all tools score 0; output keeps the
    catalogue's authored order so the dashboard still shows the
    baseline three. Tied scores keep stable order
    (Python's sort is stable) so the catalogue's authored ranking
    breaks ties.
    """
    key = _lang_key(lang)
    scored = [(_score(tool, profile or {}), tool) for tool in TOOLS]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    out: list[dict[str, Any]] = []
    for score, tool in scored[:limit]:
        out.append(
            {
                "name": tool["name"],
                "url": tool["url"],
                "why": tool[f"why_{key}"],  # type: ignore[literal-required]
                "weight_keys": list(tool["weight_keys"]),
                "score": round(score, 4),
            }
        )
    return out
