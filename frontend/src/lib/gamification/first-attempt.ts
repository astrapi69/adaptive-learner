/**
 * First-attempt detector (Phase 50C / v1.33.0 /
 * D-DEXIE-GAMIFICATION).
 *
 * TypeScript port of ``is_first_attempt_from_step_results``
 * from
 * ``plugins/adaptive-learner-plugin-gamification/
 *   adaptive_learner_gamification/xp_service.py``. Pure function
 * over the JSON-on-Text payload of
 * ``LessonProgress.step_results``. Returns true iff every step
 * recorded ``attempts == 1`` (or omits ``attempts``, which
 * defaults to 1). The Dexie caller in Phase 50D reads the row
 * + passes ``row.step_results`` here; no DB lookup happens in
 * this helper.
 *
 * Conservative on missing / malformed data: returns false when
 * the input is null/empty, the JSON doesn't parse, or the
 * top-level value isn't a non-empty plain object — the +20
 * three-star first-attempt bonus is only awarded with positive
 * evidence.
 *
 * Pinned by the parity fixture at
 * ``tests/fixtures/lesson-xp-parity/input.json``
 * (``first_attempt_cases``) — see ``first-attempt.parity.test.ts``.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" && value !== null && !Array.isArray(value)
    );
}

/**
 * True iff every step in the JSON ``step_results`` payload was
 * cleared on its first try (``attempts == 1`` or absent).
 * Conservative: returns false on null/empty/malformed input so
 * the first-attempt bonus is only awarded on positive evidence.
 */
export function isFirstAttempt(
    step_results: string | null | undefined,
): boolean {
    if (!step_results) {
        return false;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(step_results);
    } catch {
        return false;
    }
    if (!isPlainObject(parsed)) {
        return false;
    }
    const values = Object.values(parsed);
    if (values.length === 0) {
        return false;
    }
    for (const value of values) {
        if (!isPlainObject(value)) {
            // Mirror Python's ``if not isinstance(value, dict): continue``.
            continue;
        }
        // ``value.get("attempts", 1)`` in Python; default to 1 when
        // the key is missing. ``Number.isInteger`` + the explicit
        // typeof check rule out booleans, NaN, floats, and strings
        // — matches the refactored Python guard
        // ``isinstance(attempts, bool): continue`` followed by
        // ``isinstance(attempts, int) and attempts > 1``.
        const attempts = "attempts" in value ? value.attempts : 1;
        if (
            typeof attempts === "number" &&
            Number.isInteger(attempts) &&
            attempts > 1
        ) {
            return false;
        }
    }
    return true;
}
