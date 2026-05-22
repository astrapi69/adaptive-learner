/**
 * Dexie-mode NotebookLM service (Phase 32 / v1.19.0).
 *
 * Full CRUD on ``study_questions`` runs against IndexedDB. AI
 * generators + study-guide call require the backend AI hook +
 * a stored API key, neither of which the Dexie path can
 * reach from the browser without significant additional work.
 * Mirroring the Anki precedent: throw ``ApiError(501)`` with a
 * "switch to API mode" message; the page surfaces it as a
 * toast.
 */

import {ApiError} from "../api/client";

import {getDb, newId, nowIso} from "./db";
import type {StudyQuestionRow} from "./db";
import type {
    StudyQuestion,
    StudyQuestionCreateBody,
    StudyQuestionListFilters,
    StudyQuestionUpdateBody,
} from "./types";

const ALLOWED_TYPES = new Set([
    "open",
    "fill_blank",
    "explain",
    "compare",
]);
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function rowToOut(row: StudyQuestionRow): StudyQuestion {
    return {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        session_id: row.session_id,
        question: row.question,
        expected_answer: row.expected_answer,
        question_type: row.question_type as StudyQuestion["question_type"],
        difficulty: row.difficulty as StudyQuestion["difficulty"],
        topic: row.topic,
        edited: row.edited,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function listStudyQuestions(
    userId: string,
    filters?: StudyQuestionListFilters,
): Promise<StudyQuestion[]> {
    const db = getDb();
    const rows = await db.studyQuestions.where({user_id: userId}).toArray();
    const filtered = rows.filter((r) => {
        if (filters?.projectId && r.project_id !== filters.projectId)
            return false;
        if (filters?.difficulty && r.difficulty !== filters.difficulty)
            return false;
        if (
            filters?.topic &&
            !r.topic.toLowerCase().includes(filters.topic.toLowerCase())
        )
            return false;
        return true;
    });
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered.map(rowToOut);
}

export async function createStudyQuestion(
    userId: string,
    body: StudyQuestionCreateBody,
): Promise<StudyQuestion> {
    const qtype = (body.question_type ?? "open") as string;
    const diff = (body.difficulty ?? "medium") as string;
    if (!ALLOWED_TYPES.has(qtype)) {
        throw new ApiError(
            400,
            `question_type must be one of ${[...ALLOWED_TYPES].join(", ")}.`,
        );
    }
    if (!ALLOWED_DIFFICULTIES.has(diff)) {
        throw new ApiError(
            400,
            `difficulty must be one of ${[...ALLOWED_DIFFICULTIES].join(", ")}.`,
        );
    }
    const db = getDb();
    const ts = nowIso();
    const row: StudyQuestionRow = {
        id: newId(),
        user_id: userId,
        project_id: body.project_id,
        session_id: body.session_id ?? null,
        question: body.question,
        expected_answer: body.expected_answer ?? "",
        question_type: qtype,
        difficulty: diff,
        topic: body.topic ?? "",
        edited: false,
        created_at: ts,
        updated_at: ts,
    };
    await db.studyQuestions.put(row);
    return rowToOut(row);
}

export async function updateStudyQuestion(
    questionId: string,
    body: StudyQuestionUpdateBody,
): Promise<StudyQuestion> {
    const db = getDb();
    const existing = await db.studyQuestions.get(questionId);
    if (!existing) {
        throw new ApiError(404, `StudyQuestion ${questionId} not found`);
    }
    let textChanged = false;
    if (body.question !== undefined) {
        existing.question = body.question;
        textChanged = true;
    }
    if (body.expected_answer !== undefined) {
        existing.expected_answer = body.expected_answer;
        textChanged = true;
    }
    if (body.question_type !== undefined) {
        if (!ALLOWED_TYPES.has(body.question_type)) {
            throw new ApiError(
                400,
                `question_type must be one of ${[...ALLOWED_TYPES].join(", ")}.`,
            );
        }
        existing.question_type = body.question_type;
    }
    if (body.difficulty !== undefined) {
        if (!ALLOWED_DIFFICULTIES.has(body.difficulty)) {
            throw new ApiError(
                400,
                `difficulty must be one of ${[...ALLOWED_DIFFICULTIES].join(", ")}.`,
            );
        }
        existing.difficulty = body.difficulty;
    }
    if (body.topic !== undefined) existing.topic = body.topic;
    if (textChanged) existing.edited = true;
    existing.updated_at = nowIso();
    await db.studyQuestions.put(existing);
    return rowToOut(existing);
}

export async function deleteStudyQuestion(
    questionId: string,
): Promise<void> {
    const db = getDb();
    await db.studyQuestions.delete(questionId);
}

// AI paths — Dexie mode throws.

export async function generateFromSessionDexie(): Promise<StudyQuestion[]> {
    throw new ApiError(
        501,
        "AI study-question generation requires API mode. " +
            "Switch to API mode in Settings to enable.",
    );
}

export async function generateFromProjectDexie(): Promise<StudyQuestion[]> {
    throw new ApiError(
        501,
        "AI study-question generation requires API mode. " +
            "Switch to API mode in Settings to enable.",
    );
}

export async function studyGuideDexie(): Promise<string> {
    throw new ApiError(
        501,
        "Study guide generation requires API mode for the AI call. " +
            "Switch to API mode in Settings to enable.",
    );
}
