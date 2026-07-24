"""Backend mirror of the adaptive-lesson error analyzer
(Phase 53A / v1.36.0 / EXP-013 / P-131, P-133, P-134).

The canonical implementation runs client-side in
``frontend/src/lib/adaptive/error-analyzer.ts`` because the
generator must work in Dexie mode (GitHub Pages, no backend).
This module is the Python parity port: same algorithm, same
output, pinned by the shared fixture at
``tests/fixtures/adaptive-lesson-parity/``.

Pure functions only — no DB access, no I/O. Higher-level code
that wants to call the analyzer from an API route reads
``ElementError`` rows via ``element_errors_service.list_for_user``
and passes them to :func:`analyze_errors` as plain dataclasses.

Mirrors the TS implementation 1:1:

- Excludes mastered + zero-error rows
- Recency weight: 1.0 / 0.8 / 0.5 / 0.3 bands
- Cluster minimum: 3 elements sharing the key
- Cluster types: ``element_type``, ``lesson``
- Weakness profile rounded to 3 decimals
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime

DEFAULT_FOCUS_COUNT = 3
CLUSTER_MIN = 3
SECONDS_PER_DAY = 60 * 60 * 24


@dataclass(frozen=True)
class ElementErrorInput:
    """Input shape for :func:`analyze_errors`.

    Matches the front-end ``ElementError`` type. Callers
    constructed from the SQLAlchemy ORM map ``last_error_at``
    and ``last_attempt_at`` to ISO-8601 strings before passing
    them in (the analyzer is wire-format-agnostic, but the
    parity fixture pins the ISO-string flavour).
    """

    element_key: str
    set_id: str
    lesson_id: str
    exercise_id: str
    element_type: str
    user_answer: str
    correct_answer: str
    error_count: int
    correct_streak: int
    last_error_at: str | None
    last_attempt_at: str
    mastered: bool


@dataclass(frozen=True)
class PrioritizedElement:
    element_key: str
    set_id: str
    lesson_id: str
    exercise_id: str
    element_type: str
    error_count: int
    correct_streak: int
    last_error_at: str | None
    last_attempt_at: str
    user_answer: str
    correct_answer: str
    recency_weight: float
    priority_score: float


@dataclass(frozen=True)
class ErrorCluster:
    cluster_type: str  # "element_type" | "lesson"
    key: str
    element_keys: list[str]
    error_count_total: int


@dataclass
class ErrorAnalysis:
    prioritized_elements: list[PrioritizedElement] = field(default_factory=list)
    error_clusters: list[ErrorCluster] = field(default_factory=list)
    weakness_profile: dict[str, float] = field(default_factory=dict)
    suggested_focus: list[PrioritizedElement] = field(default_factory=list)
    total_errors: int = 0
    active_elements: int = 0


def _parse_iso(ts: str) -> datetime | None:
    """Parse an ISO-8601 string with the TS ``Date.parse``
    semantics we need: trailing-``Z`` UTC + ``+HH:MM`` offsets.
    Returns ``None`` on any parse failure so the caller can
    apply the 0.3 fallback."""
    try:
        # Python 3.11+ datetime.fromisoformat handles "Z" since 3.11.
        # We replace it anyway for older-runtime safety.
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def recency_weight(last_error_at: str | None, now: datetime) -> float:
    """Map the age in days to a recency weight per the
    Phase 53 spec. Pure function — no clock access."""
    if last_error_at is None:
        return 0.3
    parsed = _parse_iso(last_error_at)
    if parsed is None:
        return 0.3
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    age_seconds = (now - parsed).total_seconds()
    age_days = age_seconds / SECONDS_PER_DAY
    if age_days < 1:
        return 1.0
    if age_days < 2:
        return 0.8
    if age_days < 7:
        return 0.5
    return 0.3


def _prioritize(
    err: ElementErrorInput,
    now: datetime,
) -> PrioritizedElement:
    weight = recency_weight(err.last_error_at, now)
    return PrioritizedElement(
        element_key=err.element_key,
        set_id=err.set_id,
        lesson_id=err.lesson_id,
        exercise_id=err.exercise_id,
        element_type=err.element_type or "vocabulary",
        error_count=err.error_count,
        correct_streak=err.correct_streak,
        last_error_at=err.last_error_at,
        last_attempt_at=err.last_attempt_at,
        user_answer=err.user_answer,
        correct_answer=err.correct_answer,
        recency_weight=weight,
        priority_score=err.error_count * weight,
    )


def _prioritized_sort_key(p: PrioritizedElement) -> tuple[float, str, str]:
    """Sort: priority_score DESC, then last_attempt_at DESC,
    then element_key ASC. Negate the timestamp via a min-prefix
    trick: we sort with key tuple and reverse=False — so we
    invert the score (negate) and invert the timestamp by
    sorting *ascending* on the negation. For strings the trick
    is awkward, so we sort in two passes."""
    return (-p.priority_score, p.last_attempt_at, p.element_key)


def _compare_prioritized(items: list[PrioritizedElement]) -> list[PrioritizedElement]:
    # Python sort is stable. Apply the tie-break in passes from
    # least to most significant: element_key asc, then
    # last_attempt_at desc, then priority_score desc.
    items.sort(key=lambda p: p.element_key)
    items.sort(key=lambda p: p.last_attempt_at, reverse=True)
    items.sort(key=lambda p: p.priority_score, reverse=True)
    return items


def _cluster_by(
    active: list[ElementErrorInput],
    cluster_type: str,
    key_of,
) -> list[ErrorCluster]:
    groups: dict[str, list[ElementErrorInput]] = {}
    for err in active:
        k = key_of(err)
        groups.setdefault(k, []).append(err)
    out: list[ErrorCluster] = []
    for key, errors in groups.items():
        if len(errors) < CLUSTER_MIN:
            continue
        element_keys = sorted(e.element_key for e in errors)
        out.append(
            ErrorCluster(
                cluster_type=cluster_type,
                key=key,
                element_keys=element_keys,
                error_count_total=sum(e.error_count for e in errors),
            ),
        )
    return out


def _detect_clusters(active: list[ElementErrorInput]) -> list[ErrorCluster]:
    clusters: list[ErrorCluster] = []
    clusters.extend(
        _cluster_by(active, "element_type", lambda e: e.element_type or "vocabulary"),
    )
    clusters.extend(_cluster_by(active, "lesson", lambda e: e.lesson_id))
    clusters.sort(key=lambda c: (c.cluster_type, c.key))
    clusters.sort(key=lambda c: c.error_count_total, reverse=True)
    return clusters


def _compute_weakness_profile(
    active: list[ElementErrorInput],
) -> dict[str, float]:
    totals: dict[str, int] = {}
    grand_total = 0
    for err in active:
        t = err.element_type or "vocabulary"
        totals[t] = totals.get(t, 0) + err.error_count
        grand_total += err.error_count
    if grand_total == 0:
        return {}
    profile: dict[str, float] = {}
    for key in sorted(totals.keys()):
        share = totals[key] / grand_total
        profile[key] = round(share * 1000) / 1000
    return profile


def analyze_errors(
    element_errors: list[ElementErrorInput],
    *,
    now: datetime,
    focus_count: int = DEFAULT_FOCUS_COUNT,
) -> ErrorAnalysis:
    """Run the analysis. Pure - same input + same ``now``
    always produces the same output. The caller supplies
    ``now`` so tests stay deterministic; production routes
    pass ``datetime.now(UTC)``."""
    active = [e for e in element_errors if not e.mastered and e.error_count > 0]
    prioritized = [_prioritize(e, now) for e in active]
    prioritized = _compare_prioritized(prioritized)
    clusters = _detect_clusters(active)
    weakness_profile = _compute_weakness_profile(active)
    total_errors = sum(e.error_count for e in active)
    return ErrorAnalysis(
        prioritized_elements=prioritized,
        error_clusters=clusters,
        weakness_profile=weakness_profile,
        suggested_focus=prioritized[:focus_count],
        total_errors=total_errors,
        active_elements=len(active),
    )


def analysis_to_dict(analysis: ErrorAnalysis) -> dict:
    """Stable JSON-serialisable shape for cross-language
    parity. Used by the parity test and the API response
    shape (when an endpoint surfaces the analysis to the
    frontend in API mode)."""
    return {
        "prioritized_elements": [asdict(p) for p in analysis.prioritized_elements],
        "error_clusters": [asdict(c) for c in analysis.error_clusters],
        "weakness_profile": dict(sorted(analysis.weakness_profile.items())),
        "suggested_focus": [asdict(p) for p in analysis.suggested_focus],
        "total_errors": analysis.total_errors,
        "active_elements": analysis.active_elements,
    }
