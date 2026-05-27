/**
 * Client-side element-error store for Dexie / GitHub Pages
 * mode (Phase 46B / C7 / P-129).
 *
 * Mirrors the backend service
 * (``app.services.element_errors``) 1:1 — same transition
 * matrix, same MASTERY_THRESHOLD constant, same lesson-
 * scoped composite key. GH-Pages users get the same SRS
 * feedback loop without a backend roundtrip.
 *
 * Single Dexie table (``elementErrors``) keyed by the
 * composite ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}``
 * shape so a user has exactly one row per element —
 * matching the backend UNIQUE constraint.
 */

import {getDb} from "./db";
import type {ElementErrorRow} from "./db";
import type {ElementAttempt, ElementError} from "./types";

/** Phase 46 D4: 3 consecutive correct → mastered. Same
 *  constant as ``backend/app/services/element_errors.py``;
 *  intrinsic to the SRS semantics, not a config knob. */
export const MASTERY_THRESHOLD = 3;

function rowKey(userId: string, attempt: ElementAttempt): string {
    return [
        userId,
        attempt.set_id,
        attempt.lesson_id,
        attempt.exercise_id,
        attempt.element_key,
    ].join("#");
}

function rowToWire(row: ElementErrorRow): ElementError {
    return {
        id: row.id,
        user_id: row.user_id,
        set_id: row.set_id,
        lesson_id: row.lesson_id,
        exercise_id: row.exercise_id,
        element_key: row.element_key,
        element_type: row.element_type,
        user_answer: row.user_answer,
        correct_answer: row.correct_answer,
        error_count: row.error_count,
        correct_streak: row.correct_streak,
        last_error_at: row.last_error_at,
        last_attempt_at: row.last_attempt_at,
        mastered: row.mastered,
        mastered_at: row.mastered_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function applyTransition(
    existing: ElementErrorRow | undefined,
    userId: string,
    attempt: ElementAttempt,
    nowIso: string,
): ElementErrorRow {
    if (!existing) {
        // First sighting of this element.
        return {
            id: rowKey(userId, attempt),
            user_id: userId,
            set_id: attempt.set_id,
            lesson_id: attempt.lesson_id,
            exercise_id: attempt.exercise_id,
            element_key: attempt.element_key,
            element_type: attempt.element_type ?? "vocabulary",
            user_answer: attempt.user_answer ?? "",
            correct_answer: attempt.correct_answer ?? "",
            error_count: attempt.correct ? 0 : 1,
            correct_streak: attempt.correct ? 1 : 0,
            last_error_at: attempt.correct ? null : nowIso,
            last_attempt_at: nowIso,
            mastered: false,
            mastered_at: null,
            created_at: nowIso,
            updated_at: nowIso,
        };
    }

    // Mutate a shallow copy so callers see the post-state.
    const next: ElementErrorRow = {...existing};
    if (attempt.element_type) next.element_type = attempt.element_type;
    next.user_answer = attempt.user_answer ?? "";
    next.correct_answer = attempt.correct_answer ?? "";
    next.last_attempt_at = nowIso;
    next.updated_at = nowIso;

    if (attempt.correct) {
        next.correct_streak += 1;
        if (next.correct_streak >= MASTERY_THRESHOLD && !next.mastered) {
            next.mastered = true;
            next.mastered_at = nowIso;
        }
    } else {
        // Pedagogical demotion: a wrong answer on a mastered
        // element flips it back so SRS re-schedules. Mirrors
        // the backend service's contract.
        if (next.mastered) {
            next.mastered = false;
            next.mastered_at = null;
        }
        next.correct_streak = 0;
        next.error_count += 1;
        next.last_error_at = nowIso;
    }
    return next;
}

export async function recordElementAttemptsDexie(
    userId: string,
    attempts: readonly ElementAttempt[],
): Promise<ElementError[]> {
    if (attempts.length === 0) return [];
    const db = getDb();
    const result: ElementErrorRow[] = [];
    // Sequential await loop so intra-call compounding works:
    // 3 corrects on the same key in one bulk call still
    // flip mastered, because each iteration reads the
    // post-state of the previous put().
    for (const attempt of attempts) {
        const key = rowKey(userId, attempt);
        const existing = await db.elementErrors.get(key);
        const nowIso = new Date().toISOString();
        const next = applyTransition(existing, userId, attempt, nowIso);
        await db.elementErrors.put(next);
        result.push(next);
    }
    return result.map(rowToWire);
}

export interface ListElementErrorsOpts {
    setId?: string;
    /** Default true — pass false to exclude mastered elements
     *  (the C11 review-queue path). */
    includeMastered?: boolean;
}

export async function listElementErrorsDexie(
    userId: string,
    opts: ListElementErrorsOpts = {},
): Promise<ElementError[]> {
    const db = getDb();
    let rows: ElementErrorRow[];
    if (opts.setId !== undefined) {
        rows = await db.elementErrors
            .where("[user_id+set_id]")
            .equals([userId, opts.setId])
            .toArray();
    } else {
        rows = await db.elementErrors
            .where("user_id")
            .equals(userId)
            .toArray();
    }
    if (opts.includeMastered === false) {
        rows = rows.filter((r) => !r.mastered);
    }
    rows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return rows.map(rowToWire);
}
