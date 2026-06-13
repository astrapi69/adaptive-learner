/**
 * Client-side lesson-progress store for Dexie / GitHub Pages
 * mode (Phase 44 / EXP-002 / P-109).
 *
 * Mirrors the backend service
 * (``app.services.lesson_progress``) 1:1: per-user upsert
 * with merged ``step_results``, recomputed aggregate score,
 * and a ``mark_completed`` flag for the lesson-summary
 * screen.
 *
 * Single Dexie table (``lessonProgress``) keyed by the
 * composite ``{user_id}#{source-slug}#{set_id}#{filename}``
 * shape so a user has exactly one row per lesson — matching
 * the backend UniqueConstraint.
 */

import type {
    LessonProgress,
    LessonProgressUpsertBody,
} from "./types";
import {getDb} from "./db";
import type {LessonProgressRow} from "./db";

function slugifySource(source: string): string {
    return source.replace(/\//g, "--");
}

function rowKey(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
): string {
    return `${userId}#${slugifySource(source)}#${setId}#${lessonFilename}`;
}

function rowToWire(row: LessonProgressRow): LessonProgress {
    return {
        id: row.id,
        user_id: row.user_id,
        source: row.source,
        set_id: row.set_id,
        lesson_filename: row.lesson_filename,
        status: row.status,
        step_results: row.step_results,
        score_correct: row.score_correct,
        score_total: row.score_total,
        time_spent_seconds: row.time_spent_seconds,
        // BUG #41 — coalesce undefined → 0 so pre-feature rows
        // resume at the start (the old behaviour).
        current_step: row.current_step ?? 0,
        started_at: row.started_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        // Phase 63A — coalesce undefined → null so pre-Phase-63
        // Dexie rows present the same wire shape as freshly
        // written ones. Dexie does not require a schema bump for
        // non-indexed nullable fields; old rows simply return
        // undefined here.
        paused_at: row.paused_at ?? null,
        abandoned_at: row.abandoned_at ?? null,
    };
}

function recomputeScore(
    results: LessonProgressRow["step_results"],
): {correct: number; total: number} {
    let correct = 0;
    let total = 0;
    for (const value of Object.values(results)) {
        correct += value.correct;
        total += value.total;
    }
    return {correct, total};
}

export async function listLessonProgressDexie(
    userId: string,
): Promise<LessonProgress[]> {
    const db = getDb();
    const rows = await db.lessonProgress
        .where("user_id")
        .equals(userId)
        .toArray();
    rows.sort((a, b) =>
        a.updated_at < b.updated_at ? 1 : -1,
    );
    return rows.map(rowToWire);
}

export async function getLessonProgressDexie(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
): Promise<LessonProgress | null> {
    const db = getDb();
    const row = await db.lessonProgress.get(
        rowKey(userId, source, setId, lessonFilename),
    );
    return row ? rowToWire(row) : null;
}

export async function upsertLessonProgressDexie(
    userId: string,
    body: LessonProgressUpsertBody,
): Promise<LessonProgress> {
    const db = getDb();
    const key = rowKey(userId, body.source, body.set_id, body.lesson_filename);
    const now = new Date().toISOString();

    // Phase 63A/C — guard the one-hot lifecycle flag invariant.
    // At most one of the five mark_* flags may be set; multiple
    // flags is a programming error in the caller.
    const lifecycleCount =
        (body.mark_completed ? 1 : 0) +
        (body.mark_paused ? 1 : 0) +
        (body.mark_abandoned ? 1 : 0) +
        (body.mark_resumed ? 1 : 0) +
        (body.mark_restarted ? 1 : 0);
    if (lifecycleCount > 1) {
        throw new Error(
            "At most one of mark_completed / mark_paused / " +
                "mark_abandoned / mark_resumed / mark_restarted " +
                "may be true per call.",
        );
    }

    // #390 Class A: the autosave timer (30s), step-navigation clicks
    // and pause/abandon all call this method on the SAME lesson key.
    // Wrapping get -> merge -> put in one rw transaction makes the
    // read-modify-write atomic, so a concurrent autosave can't
    // overwrite a just-checked step_result with a stale snapshot.
    let wire: LessonProgress | null = null;
    await db.transaction("rw", db.lessonProgress, async () => {
    const existing = await db.lessonProgress.get(key);
    const row: LessonProgressRow = existing
        ? {...existing}
        : {
              id: key,
              user_id: userId,
              source: body.source,
              set_id: body.set_id,
              lesson_filename: body.lesson_filename,
              status: "in_progress",
              step_results: {},
              score_correct: 0,
              score_total: 0,
              time_spent_seconds: 0,
              current_step: 0,
              started_at: now,
              updated_at: now,
              completed_at: null,
              paused_at: null,
              abandoned_at: null,
          };

    if (body.step_result) {
        const storedResult: LessonProgressRow["step_results"][string] = {
            correct: body.step_result.correct,
            total: body.step_result.total,
            attempts: body.step_result.attempts ?? 1,
            completed_at: now,
        };
        // Phase 52C / v1.35.0 — persist the user's text-form
        // answer when present so the lesson-summary token-diff
        // display can render without an ElementError round-trip.
        if (body.step_result.user_answer != null) {
            storedResult.user_answer = body.step_result.user_answer;
        }
        // BUG P1 / Problem 2 — persist the raw answer so a
        // revisited step re-renders its exact locked visual.
        if (body.step_result.raw_answer != null) {
            storedResult.raw_answer = body.step_result.raw_answer;
        }
        row.step_results = {
            ...row.step_results,
            [body.step_result.step_id]: storedResult,
        };
        const aggregate = recomputeScore(row.step_results);
        row.score_correct = aggregate.correct;
        row.score_total = aggregate.total;
    }

    if (body.time_spent_seconds_delta && body.time_spent_seconds_delta > 0) {
        row.time_spent_seconds += body.time_spent_seconds_delta;
    }

    // BUG #41 — persist the live navigation position so a paused
    // lesson resumes where the user left off. Clamped to >= 0.
    if (body.current_step != null) {
        row.current_step = Math.max(0, body.current_step);
    }

    if (body.mark_completed && row.status !== "completed") {
        row.status = "completed";
        row.completed_at = now;
        // Terminal state — clear pending pause/abandon stamps so
        // the row's status is one-hot. Mirror of the backend
        // service behaviour (Phase 63A).
        row.paused_at = null;
        row.abandoned_at = null;
    }

    // Phase 63A — pause / abandon / resume transitions. Mirror
    // backend ``upsert_progress`` behaviour 1:1 so a row written by
    // either storage mode looks the same to the other.
    if (
        body.mark_paused &&
        row.status !== "paused" &&
        row.status !== "completed" &&
        row.status !== "abandoned"
    ) {
        row.status = "paused";
        row.paused_at = now;
    } else if (body.mark_abandoned && row.status !== "abandoned") {
        row.status = "abandoned";
        row.abandoned_at = now;
        row.paused_at = null;
        // Discard the in-flight attempt; ElementErrors live in
        // their own table and are intentionally untouched.
        row.step_results = {};
        row.score_correct = 0;
        row.score_total = 0;
        row.current_step = 0;
    } else if (body.mark_resumed && row.status === "paused") {
        row.status = "in_progress";
        row.paused_at = null;
    } else if (body.mark_restarted) {
        // Phase 63C — "Start Over" from the resume dialog.
        // Unconditional reset to fresh in_progress state.
        row.status = "in_progress";
        row.step_results = {};
        row.score_correct = 0;
        row.score_total = 0;
        row.current_step = 0;
        row.paused_at = null;
        row.abandoned_at = null;
    }

    row.updated_at = now;
    await db.lessonProgress.put(row);
    wire = rowToWire(row);
    });
    if (wire === null) {
        throw new Error(
            `lessonProgress upsert produced no row for ${key}`,
        );
    }
    return wire;
}
