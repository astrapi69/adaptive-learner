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
import type {
    AttemptRecord,
    ElementAttempt,
    ElementError,
    ReviewQueueItem,
} from "./types";

/** Phase 46 D4: 3 consecutive correct → mastered. Same
 *  constant as ``backend/app/services/element_errors.py``;
 *  intrinsic to the SRS semantics, not a config knob. */
export const MASTERY_THRESHOLD = 3;

/** EXP-018 / Phase 62: a recorded attempt is always a concrete
 *  direction. Fall back to receptive (the pre-62 implicit
 *  behaviour) when the caller omits it. */
function directionOf(attempt: ElementAttempt): string {
    return attempt.direction ?? "target_to_source";
}

function rowKey(userId: string, attempt: ElementAttempt): string {
    return [
        userId,
        attempt.set_id,
        attempt.lesson_id,
        attempt.exercise_id,
        attempt.element_key,
        // EXP-018 / Phase 62: sixth segment keeps the receptive and
        // productive rows of one card distinct. Mirrors the backend
        // UNIQUE(user, set, lesson, exercise, element_key, direction).
        directionOf(attempt),
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
        direction: row.direction ?? "target_to_source",
        element_type: row.element_type,
        user_answer: row.user_answer,
        correct_answer: row.correct_answer,
        error_count: row.error_count,
        correct_streak: row.correct_streak,
        last_error_at: row.last_error_at,
        last_attempt_at: row.last_attempt_at,
        mastered: row.mastered,
        mastered_at: row.mastered_at,
        hint_used: row.hint_used ?? false,
        hint_used_count: row.hint_used_count ?? 0,
        attempt_count: row.attempt_count ?? 0,
        attempt_history: row.attempt_history ?? [],
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/** #603 Smart Review Queue — keep the last N attempts per element. */
export const MAX_ATTEMPT_HISTORY = 10;

function appendAttemptHistory(
    existing: AttemptRecord[] | undefined,
    attempt: ElementAttempt,
    nowIso: string,
): AttemptRecord[] {
    const next = [...(existing ?? [])];
    next.push({
        correct: attempt.correct,
        hint_used: attempt.hint_used ?? false,
        at: nowIso,
    });
    return next.slice(-MAX_ATTEMPT_HISTORY);
}

/** First sighting of an element: seed a fresh SRS row from one attempt. */
function createElementRow(
    userId: string,
    attempt: ElementAttempt,
    nowIso: string,
): ElementErrorRow {
    return {
        id: rowKey(userId, attempt),
        user_id: userId,
        set_id: attempt.set_id,
        lesson_id: attempt.lesson_id,
        exercise_id: attempt.exercise_id,
        element_key: attempt.element_key,
        direction: directionOf(attempt),
        element_type: attempt.element_type ?? "vocabulary",
        user_answer: attempt.user_answer ?? "",
        correct_answer: attempt.correct_answer ?? "",
        error_count: attempt.correct ? 0 : 1,
        correct_streak: attempt.correct ? 1 : 0,
        last_error_at: attempt.correct ? null : nowIso,
        last_attempt_at: nowIso,
        mastered: false,
        mastered_at: null,
        // #594 Hint Economy — latest hint flag + lifetime count.
        hint_used: attempt.hint_used ?? false,
        hint_used_count: attempt.hint_used ? 1 : 0,
        // #603 Smart Review Queue — first attempt + history seed.
        attempt_count: 1,
        attempt_history: appendAttemptHistory(undefined, attempt, nowIso),
        created_at: nowIso,
        updated_at: nowIso,
    };
}

/** Fold one correct/wrong attempt into the SRS streak + mastery state. */
function applyScoreOutcome(
    next: ElementErrorRow,
    attempt: ElementAttempt,
    nowIso: string,
): void {
    if (attempt.correct) {
        next.correct_streak += 1;
        if (next.correct_streak >= MASTERY_THRESHOLD && !next.mastered) {
            next.mastered = true;
            next.mastered_at = nowIso;
        }
        return;
    }
    // Pedagogical demotion: a wrong answer on a mastered element flips it
    // back so SRS re-schedules. Mirrors the backend service's contract.
    if (next.mastered) {
        next.mastered = false;
        next.mastered_at = null;
    }
    next.correct_streak = 0;
    next.error_count += 1;
    next.last_error_at = nowIso;
}

/** Advance an existing element's SRS row by one attempt (shallow copy so
 *  callers see the post-state). */
function advanceElementRow(
    existing: ElementErrorRow,
    attempt: ElementAttempt,
    nowIso: string,
): ElementErrorRow {
    const next: ElementErrorRow = {...existing};
    if (attempt.element_type) next.element_type = attempt.element_type;
    next.user_answer = attempt.user_answer ?? "";
    next.correct_answer = attempt.correct_answer ?? "";
    next.last_attempt_at = nowIso;
    next.updated_at = nowIso;
    // #594 Hint Economy — latest attempt's hint flag drives the SRS
    // interval; the count accumulates for the statistic.
    next.hint_used = attempt.hint_used ?? false;
    if (attempt.hint_used) {
        next.hint_used_count = (next.hint_used_count ?? 0) + 1;
    }
    // #603 Smart Review Queue — bump the attempt count + ring buffer.
    next.attempt_count = (next.attempt_count ?? 0) + 1;
    next.attempt_history = appendAttemptHistory(
        next.attempt_history,
        attempt,
        nowIso,
    );
    applyScoreOutcome(next, attempt, nowIso);
    return next;
}

function applyTransition(
    existing: ElementErrorRow | undefined,
    userId: string,
    attempt: ElementAttempt,
    nowIso: string,
): ElementErrorRow {
    return existing
        ? advanceElementRow(existing, attempt, nowIso)
        : createElementRow(userId, attempt, nowIso);
}

export async function recordElementAttemptsDexie(
    userId: string,
    attempts: readonly ElementAttempt[],
): Promise<ElementError[]> {
    if (attempts.length === 0) return [];
    const db = getDb();
    const result: ElementErrorRow[] = [];
    // #390 Class A: wrap the whole bulk call in one rw transaction so
    // the get -> transition -> put for each key is atomic against a
    // concurrent ``recordElementAttemptsDexie`` touching the same
    // element (e.g. an error-replay overlapping the main lesson). A
    // ``table.modify`` would not suffice here: the first-sighting path
    // INSERTS a new row, which modify can't do. The transaction also
    // preserves the intra-call compounding (3 corrects on one key in a
    // single call still flip ``mastered``), because each iteration
    // reads the post-state of the previous put within the same tx.
    await db.transaction("rw", db.elementErrors, async () => {
        for (const attempt of attempts) {
            const key = rowKey(userId, attempt);
            const existing = await db.elementErrors.get(key);
            const nowIso = new Date().toISOString();
            const next = applyTransition(existing, userId, attempt, nowIso);
            await db.elementErrors.put(next);
            result.push(next);
        }
    });
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

// --- Phase 46C / C12: SRS review-queue computation ---------------------

/** Map a correct-streak count to the next-review interval
 *  in days. Mirrors ``app.services.element_srs.
 *  interval_days_for_streak``: streak 0 → 1d, 1 → 3d, 2 →
 *  7d, 3+ (mastered) → 7d as safe fallback. */
export function intervalDaysForStreak(correctStreak: number): number {
    if (correctStreak <= 0) return 1;
    if (correctStreak === 1) return 3;
    return 7;
}

/** #594 Hint Economy — a hint-assisted answer is weaker, so the next
 *  review comes sooner. The base interval is multiplied by this factor
 *  when the element's last attempt used a hint. Mirrors the backend
 *  ``element_srs.HINT_INTERVAL_FACTOR``. */
export const HINT_INTERVAL_FACTOR = 0.5;

function _addDays(iso: string, days: number): string {
    // Millisecond arithmetic so fractional days (the #594 hint factor
    // shortens an interval to e.g. 0.5d) are honoured exactly.
    const d = new Date(new Date(iso).getTime() + days * 86_400_000);
    return d.toISOString();
}

function _projectReviewItem(
    row: ElementErrorRow,
    nowIso: string,
): ReviewQueueItem {
    const interval =
        intervalDaysForStreak(row.correct_streak) *
        (row.hint_used ? HINT_INTERVAL_FACTOR : 1.0);
    const suggested = _addDays(row.last_attempt_at, interval);
    return {
        id: row.id,
        user_id: row.user_id,
        set_id: row.set_id,
        lesson_id: row.lesson_id,
        exercise_id: row.exercise_id,
        element_key: row.element_key,
        direction: row.direction ?? "target_to_source",
        element_type: row.element_type,
        user_answer: row.user_answer,
        correct_answer: row.correct_answer,
        error_count: row.error_count,
        correct_streak: row.correct_streak,
        last_error_at: row.last_error_at,
        last_attempt_at: row.last_attempt_at,
        suggested_review_at: suggested,
        overdue: suggested <= nowIso,
        attempt_count: row.attempt_count ?? 0,
        attempt_history: row.attempt_history ?? [],
    };
}

export interface ComputeReviewQueueOpts {
    setId?: string;
    /** Injectable clock for deterministic tests. Defaults
     *  to ``new Date().toISOString()``. */
    nowIso?: string;
    /** #603 — cap the returned list (a review session passes 20). */
    limit?: number;
}

export async function computeReviewQueueDexie(
    userId: string,
    opts: ComputeReviewQueueOpts = {},
): Promise<ReviewQueueItem[]> {
    const nowIso = opts.nowIso ?? new Date().toISOString();
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
    rows = rows.filter((r) => !r.mastered);
    const items = rows.map((r) => _projectReviewItem(r, nowIso));
    // Sort (mirrors the backend ``element_srs._sort_key``, #603):
    // overdue first → weakness tier (wrong > almost-right > correct) →
    // weighted error frequency desc → OLDEST error first. EXP-018:
    // productive errors are weighted 1.2x (harder, needs more practice).
    items.sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        const ta = weaknessTier(a);
        const tb = weaknessTier(b);
        if (ta !== tb) return tb - ta;
        const pa = _priorityScore(a);
        const pb = _priorityScore(b);
        if (pa !== pb) return pb - pa;
        // Oldest error first: ascending last_error_at (no error → last).
        const lhs = a.last_error_at ?? "￿";
        const rhs = b.last_error_at ?? "￿";
        if (lhs === rhs) return 0;
        return lhs < rhs ? -1 : 1;
    });
    if (opts.limit !== undefined && opts.limit >= 0) {
        return items.slice(0, opts.limit);
    }
    return items;
}

/** EXP-018 / Phase 62: productive (source_to_target) drills are
 *  harder, so their error count is weighted up. Mirrors the backend
 *  ``element_srs._PRODUCTIVE_WEIGHT``. */
export const PRODUCTIVE_WEIGHT = 1.2;

function _priorityScore(item: ReviewQueueItem): number {
    const weight =
        item.direction === "source_to_target" ? PRODUCTIVE_WEIGHT : 1.0;
    return item.error_count * weight;
}

/** #603 Smart Review Queue — weakness tier so the queue orders
 *  ``wrong > almost-right > correct``. Mirrors the backend
 *  ``element_srs.weakness_tier``:
 *  2 = wrong (streak 0), 1 = almost-right (recovered after errors),
 *  0 = clean. */
export function weaknessTier(item: ReviewQueueItem): number {
    if (item.correct_streak === 0) return 2;
    if (item.error_count > 0) return 1;
    return 0;
}
