"""Spaced-repetition action recommendations (v0.4.0).

The :func:`build_spaced_recommendations` pure function takes a
``profile`` (the six method-weights) plus a ``recency`` map
(``method -> days_since_last_commit`` or ``None`` when there is
no commit for that method) and produces 0-N actionable cards
ordered by urgency.

The cards are NOT tool suggestions (those still come from
:mod:`adaptive_learner_tools.catalogue`); they are short
"do this next" prompts driven by:

  - the user's strongest methods (high profile weight first), and
  - how long it's been since the user practised that method.

Five-band interval policy:

    last commit was…       → recommend at interval_days
    never                  → 1   ("First practice in M.")
    > 14 days              → 1   ("Refresh M.")
    7-14 days              → 3   ("Review M.")
    3-7 days               → 7   ("Practice M.")
    < 3 days               → 14  ("Maintain M.")

The boundary days are inclusive at the low end of each band
so a commit exactly 7 days old lands in the "Review M." band.
Each card carries a stable ``id`` so the frontend can persist
"dismissed today" without server-side state.

The pure function takes no DB / clock dependencies — the route
layer feeds it pre-computed ``recency`` + the catalogue's
profile dict. Tests cover every band + the
"only-non-zero-weight" filter in isolation.
"""

from __future__ import annotations

from typing import TypedDict

from .catalogue import METHODS

# Weight at or below this is treated as "the learner doesn't
# use this method" and the method is skipped. Anything strictly
# greater produces a card. The threshold matches the assessment
# plugin's "low weight" floor; tightening it later (e.g. to 0.1)
# only requires touching this constant.
WEIGHT_FLOOR: float = 0.0

DEFAULT_LIMIT = 5


class SpacedRecommendation(TypedDict):
    id: str
    method: str
    interval_days: int
    action: str
    title_de: str
    title_en: str
    # Lower urgency value -> shown first. Computed from interval
    # (shorter interval = more urgent) and the profile weight
    # (stronger method = surfaces above weaker matches at the
    # same interval).
    urgency: float


# Five bands, ordered most-urgent first. Each band defines:
#   - lo_inclusive: the lowest days-since-last value that still
#     belongs to this band (inclusive).
#   - interval_days: the spacing the card recommends.
#   - kind: a stable key used for the id + localised title lookup.
_BANDS: tuple[tuple[float, int, str], ...] = (
    # never-practised: lo_inclusive is sentinel-large so the
    # caller's None-recency path can never accidentally land here.
    (float("inf"), 1, "first"),
    (14.0, 1, "refresh"),
    (7.0, 3, "review"),
    (3.0, 7, "practice"),
    (0.0, 14, "maintain"),
)


def _band_for_recency(days: float | None) -> tuple[int, str]:
    """Pick ``(interval_days, kind)`` for ``days``."""
    if days is None:
        # No commit ever in this method.
        return 1, "first"
    for lo, interval, kind in _BANDS[1:]:
        if days >= lo:
            return interval, kind
    return _BANDS[-1][1], _BANDS[-1][2]


_TITLES: dict[str, tuple[str, str]] = {
    # kind -> (de, en); the method name is substituted via str.format
    "first": (
        "Erste Übung in {method_de}.",
        "First practice in {method_en}.",
    ),
    "refresh": (
        "Auffrischung in {method_de} — länger als zwei Wochen her.",
        "Refresh {method_en} — over two weeks since the last session.",
    ),
    "review": (
        "Wiederholung {method_de}.",
        "Review {method_en}.",
    ),
    "practice": (
        "Übung in {method_de}.",
        "Practice {method_en}.",
    ),
    "maintain": (
        "Pflege deine {method_de}-Routine.",
        "Maintain your {method_en} routine.",
    ),
}

# Method-key -> (de label, en label) for the title template.
_METHOD_LABELS: dict[str, tuple[str, str]] = {
    "deductive": ("Deduktion", "deduction"),
    "inductive": ("Induktion", "induction"),
    "error_based": ("Fehlerlernen", "error-based learning"),
    "dialogic": ("Dialog", "dialogue"),
    "contextual": ("Kontextlernen", "contextual learning"),
    "ai_adaptive": ("KI-adaptivem Lernen", "AI-adaptive learning"),
}


def build_spaced_recommendations(
    profile: dict[str, float],
    recency: dict[str, float | None],
    *,
    limit: int = DEFAULT_LIMIT,
) -> list[SpacedRecommendation]:
    """Return up to ``limit`` cards ordered by urgency.

    ``profile`` is the canonical six-weight dict. Methods with a
    weight at or below :data:`WEIGHT_FLOOR` are skipped — the
    learner doesn't lean on them so spaced-repetition is moot.

    ``recency`` maps each method to ``days_since_last_commit``
    or ``None`` when there is no commit. The caller computes
    this from ``ProgressCommit.committed_at``.

    Stable ``id`` so the frontend can persist dismissals across
    reloads without server-side state.
    """
    cards: list[SpacedRecommendation] = []
    for method in METHODS:
        weight = float(profile.get(method, 0.0) or 0.0)
        if weight <= WEIGHT_FLOOR:
            continue
        days = recency.get(method)
        interval, kind = _band_for_recency(days)
        de_label, en_label = _METHOD_LABELS.get(method, (method, method))
        title_de_tmpl, title_en_tmpl = _TITLES[kind]
        # Urgency: lower is higher priority. Shorter interval
        # dominates; within an interval band, the strongest
        # method surfaces first (we subtract weight so a
        # stronger method has a SMALLER urgency value).
        urgency = float(interval) - weight
        cards.append(
            SpacedRecommendation(
                id=f"sr-{method}-{kind}",
                method=method,
                interval_days=interval,
                action="session",
                title_de=title_de_tmpl.format(method_de=de_label),
                title_en=title_en_tmpl.format(method_en=en_label),
                urgency=round(urgency, 4),
            )
        )
    cards.sort(key=lambda c: c["urgency"])
    return cards[:limit]


def localise(card: SpacedRecommendation, lang: str) -> dict[str, object]:
    """Project a card to the wire shape — a single ``title``
    instead of the bilingual ``title_de`` / ``title_en`` columns.
    """
    key = "de" if isinstance(lang, str) and lang.startswith("de") else "en"
    return {
        "id": card["id"],
        "method": card["method"],
        "interval_days": card["interval_days"],
        "action": card["action"],
        "title": card[f"title_{key}"],  # type: ignore[literal-required]
        "urgency": card["urgency"],
    }
