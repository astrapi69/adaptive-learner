/**
 * Dexie-mode context loader for the learning-repo renderer
 * (Phase 49B / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Queries the IndexedDB tables for the project + its sessions
 * + ratings + step evaluations + method switches + notes, then
 * hands the raw row tuples to ``buildRenderContext`` (which
 * derives topics and stamps ``rendered_at``).
 *
 * This is the Dexie-specific half of the load. ApiStorage's
 * ``learningRepo.render`` (49E) delegates to the backend
 * end-point and never builds a context client-side, so the
 * loader is intentionally Dexie-only.
 *
 * Throws ``ApiError(404)`` when the project doesn't exist —
 * mirrors the backend renderer's ``NotFoundError`` semantics
 * so the route layer / page can show the same toast on a
 * stale project id.
 */

import {ApiError} from "../../api/client";
import {getDb} from "../../storage/dexie/db";
import type {
    LearningProjectRow,
    LearningSessionRow,
    MethodSwitchRow,
    SessionNoteRow,
    SessionRatingRow,
    StepEvaluationRow,
} from "../../storage/dexie/db";

import {buildRenderContext} from "./render-context";
import type {
    MethodSwitchData,
    ProjectData,
    RatingData,
    RenderContext,
    SessionData,
    SessionNoteData,
    StepEvaluationData,
} from "./render-context";

/**
 * Build a :class:`RenderContext` for ``projectId`` by reading
 * every row the four meta-file renderers + the topic-folder
 * generator need.
 *
 * Optional ``renderedAt`` lets the parity test pin the
 * timestamp; production callers omit it and pick up "now".
 */
export async function loadDexieContext(
    projectId: string,
    options: {renderedAt?: string} = {},
): Promise<RenderContext> {
    const db = getDb();

    const projectRow = await db.learningProjects.get(projectId);
    if (!projectRow) {
        throw new ApiError(
            404,
            `LearningProject ${projectId} not found`,
        );
    }

    // Per-project session list, then per-session ratings /
    // step-evaluations / notes via anyOf. Method-switches are
    // also project-scoped.
    const sessionRows = await db.learningSessions
        .where("project_id")
        .equals(projectId)
        .toArray();
    const sessionIds = sessionRows.map((s) => s.id);

    const ratingRows =
        sessionIds.length === 0
            ? []
            : await db.sessionRatings
                  .where("session_id")
                  .anyOf(sessionIds)
                  .toArray();

    const stepEvalRows =
        sessionIds.length === 0
            ? []
            : await db.stepEvaluations
                  .where("session_id")
                  .anyOf(sessionIds)
                  .toArray();

    const noteRows =
        sessionIds.length === 0
            ? []
            : await db.sessionNotes
                  .where("session_id")
                  .anyOf(sessionIds)
                  .toArray();

    const methodSwitchRows = await db.methodSwitches
        .where("project_id")
        .equals(projectId)
        .toArray();

    return buildRenderContext({
        project: projectRowToData(projectRow),
        sessions: sessionRows.map(sessionRowToData),
        ratings: ratingRows.map(ratingRowToData),
        step_evaluations: stepEvalRows.map(stepEvalRowToData),
        method_switches: methodSwitchRows.map(methodSwitchRowToData),
        notes: noteRows.map(noteRowToData),
        rendered_at: options.renderedAt,
    });
}

// --- Row-to-data mappers ------------------------------------------------
//
// Dexie row types live alongside other storage code; the
// renderer's data types are intentionally decoupled (same
// shape but a separate name). Mapping at the loader keeps the
// renderer untouched if the Dexie row shape gains a field for
// some other purpose.

function projectRowToData(row: LearningProjectRow): ProjectData {
    return {
        id: row.id,
        user_id: row.user_id,
        topic: row.topic,
        goal: row.goal,
        timeframe: row.timeframe,
        daily_minutes: row.daily_minutes,
        current_problem: row.current_problem,
        active: row.active,
        // v1.31.0 / Phase 46F — pre-migration rows back-fill
        // to "standard"; same shape as the IStorageService
        // contract on the ApiStorage side.
        kind: row.kind ?? "standard",
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function sessionRowToData(row: LearningSessionRow): SessionData {
    // The Dexie row doesn't carry cycle_count / cycle_topics
    // (those are auto-loop-only fields the API mode writes).
    // Leaving them undefined is correct — the renderer's
    // ``deriveTopics`` handles missing/malformed data as
    // empty.
    return {
        id: row.id,
        project_id: row.project_id,
        method: row.method,
        started_at: row.started_at,
        ended_at: row.ended_at,
        cycle_step: row.cycle_step,
        status: row.status,
    };
}

function ratingRowToData(row: SessionRatingRow): RatingData {
    return {
        id: row.id,
        session_id: row.session_id,
        understanding: row.understanding,
        stress: row.stress,
        method_fit: row.method_fit,
        notes: row.notes,
        created_at: row.created_at,
    };
}

function stepEvalRowToData(row: StepEvaluationRow): StepEvaluationData {
    return {
        id: row.id,
        session_id: row.session_id,
        from_step: row.from_step,
        to_step: row.to_step,
        advance: row.advance,
        applied: row.applied,
        confidence: row.confidence,
        reason: row.reason,
        fallback_used: row.fallback_used,
        evaluated_at: row.evaluated_at,
    };
}

function methodSwitchRowToData(row: MethodSwitchRow): MethodSwitchData {
    return {
        id: row.id,
        project_id: row.project_id,
        from_method: row.from_method,
        to_method: row.to_method,
        reason: row.reason,
        switched_at: row.switched_at,
    };
}

function noteRowToData(row: SessionNoteRow): SessionNoteData {
    return {
        id: row.id,
        session_id: row.session_id,
        content: row.content,
        kind: row.kind,
        created_at: row.created_at,
    };
}
