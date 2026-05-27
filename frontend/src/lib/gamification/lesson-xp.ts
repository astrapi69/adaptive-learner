/**
 * Lesson-XP rule (Phase 50B / v1.33.0 / D-DEXIE-GAMIFICATION).
 *
 * TypeScript port of the Python ``calculate_lesson_session_xp``
 * + ``compute_stars`` functions at
 * ``plugins/adaptive-learner-plugin-gamification/
 *   adaptive_learner_gamification/xp_service.py``. The Python
 * source is the canonical formula; this module mirrors it
 * line-by-line so the byte-for-byte parity test at
 * ``frontend/src/lib/gamification/lesson-xp.parity.test.ts``
 * passes. Any drift between this file and the Python source IS
 * a bug in THIS file unless the spec explicitly changed.
 *
 * Used in Dexie mode (no backend, no on_session_complete hook)
 * to award XP locally when a LessonProgress row flips to
 * status=completed. In API mode the Python implementation
 * runs server-side and this module is unused.
 *
 * Snake_case throughout to match the Python contract and the
 * parity fixture JSON shape at
 * ``tests/fixtures/lesson-xp-parity/``. Same convention as the
 * Phase 49 RenderContext types in ``../learning-repo/``.
 */

// Bands match the Python ``_STAR_BAND_*`` constants exactly.
const STAR_BAND_3 = 0.9;
const STAR_BAND_2 = 0.75;
const STAR_BAND_1 = 0.5;

/**
 * Subset of fields that may appear in an ``XPAward.breakdown``.
 * All optional — only the keys whose values are non-zero get
 * emitted (matches Python's behaviour: ``breakdown[key] = v``
 * only when the helper computed a positive value).
 */
export interface XPBreakdown {
    base: number;
    star_bonus?: number;
    first_attempt_3star_bonus?: number;
    streak_multiplier_pct?: number;
}

/**
 * Pure calculator output. Mirrors Python's ``XPAward``
 * dataclass with the fields the calculator populates.
 * ``xp_total``, ``level``, and ``level_up`` are excluded
 * because they're set by the persistence wrapper (the Python
 * side does that in ``award_xp_for_lesson_session``; the TS
 * equivalent lives in Phase 50D's Dexie wiring).
 */
export interface XPAward {
    xp_earned: number;
    multiplier: number;
    breakdown: XPBreakdown;
    reason: string;
}

export interface CalculateLessonSessionXpInput {
    stars: number;
    first_attempt: boolean;
    streak_days: number;
}

/**
 * 0-3 stars from a correct/total score. Bands: ``< 50%`` -> 0,
 * ``< 75%`` -> 1, ``< 90%`` -> 2, ``>= 90%`` -> 3. Zero or
 * negative ``total`` returns 0 (consistent with the unattempted-
 * lesson behaviour and the zero-division guard).
 */
export function computeStars(correct: number, total: number): number {
    if (total <= 0) {
        return 0;
    }
    const pct = correct / total;
    if (pct >= STAR_BAND_3) return 3;
    if (pct >= STAR_BAND_2) return 2;
    if (pct >= STAR_BAND_1) return 1;
    return 0;
}

/**
 * Banker's rounding (round half to even) to match Python's
 * built-in ``round()`` on positive floats. JavaScript's
 * ``Math.round`` rounds half-away-from-zero, which diverges
 * from Python on values like 0.5 -> JS 1 / Python 0 and
 * 2.5 -> JS 3 / Python 2. The lesson-XP formula multiplies
 * a positive integer by a multiplier in {1.0, 1.25, ..., 2.75},
 * so the product is always a positive multiple of 0.25 and
 * the only divergence cases are exact ``N.5`` results where
 * ``N`` is even — Python rounds down to ``N``, JS would round
 * up to ``N + 1``. This helper keeps the parity contract
 * regardless of which fixture cases land on ``.5``.
 */
function pythonRound(x: number): number {
    const floor = Math.floor(x);
    const diff = x - floor;
    if (diff < 0.5) {
        return floor;
    }
    if (diff > 0.5) {
        return floor + 1;
    }
    return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Compute XP for a content-lesson completion. Mirrors the spec:
 *
 * - Base: 30 XP
 * - Per-star bonus: 10 × clamp(stars, 0, 3)
 * - First-attempt 3-star bonus: +20 (stars==3 AND first_attempt)
 * - Streak multiplier: +25%/day capped at 7 days
 *
 * Caller resolves the DB-derived inputs (``streak_days`` from
 * ``current_streak_days`` over the activity-date set,
 * ``first_attempt`` from the LessonProgress step_results JSON).
 * Phase 50C ships those resolvers; Phase 50D wires them through
 * DexieStorage on the lesson-completion path.
 */
export function calculateLessonSessionXp(
    input: CalculateLessonSessionXpInput,
): XPAward {
    const base = 30;
    const breakdown: XPBreakdown = {base};

    const clamped_stars = Math.max(0, Math.min(3, input.stars));
    const star_bonus = 10 * clamped_stars;
    if (star_bonus > 0) {
        breakdown.star_bonus = star_bonus;
    }

    if (clamped_stars === 3 && input.first_attempt) {
        breakdown.first_attempt_3star_bonus = 20;
    }

    // pre_multiplier = sum(breakdown.values()) in Python.
    const pre_multiplier =
        (breakdown.base ?? 0) +
        (breakdown.star_bonus ?? 0) +
        (breakdown.first_attempt_3star_bonus ?? 0);

    const capped_days = Math.min(input.streak_days, 7);
    const multiplier = 1.0 + 0.25 * capped_days;
    const xp_earned = pythonRound(pre_multiplier * multiplier);
    if (input.streak_days > 0) {
        breakdown.streak_multiplier_pct = pythonRound((multiplier - 1.0) * 100);
    }

    return {
        xp_earned,
        multiplier,
        breakdown,
        reason: "lesson_complete",
    };
}
