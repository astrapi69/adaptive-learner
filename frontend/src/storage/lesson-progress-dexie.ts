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
        started_at: row.started_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
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
              started_at: now,
              updated_at: now,
              completed_at: null,
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

    if (body.mark_completed && row.status !== "completed") {
        row.status = "completed";
        row.completed_at = now;
    }

    row.updated_at = now;
    await db.lessonProgress.put(row);
    return rowToWire(row);
}
