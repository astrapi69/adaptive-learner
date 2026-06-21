/**
 * Dexie-mode NotebookLM service (Phase 32 / v1.19.0).
 *
 * Full CRUD on ``study_questions`` runs against IndexedDB. The AI generators
 * (study questions + study guide) run BROWSER-DIRECT with the user's own API
 * key (#902), mirroring the Anki-extraction precedent (#807): the gate is
 * "is a key configured?", not "is the backend reachable?". Only when no key
 * is configured do we report that a key is required.
 */

import {ApiError} from "../../api/client";

import {getDb, newId, nowIso} from "../dexie/db";
import type {StudyQuestionRow} from "../dexie/db";
import type {
    StudyQuestion,
    StudyQuestionCreateBody,
    StudyQuestionListFilters,
    StudyQuestionUpdateBody,
} from "../types";
import {
    assembleProjectTranscript,
    assembleStudyGuideContext,
    generateQuestionsFromProject,
    generateQuestionsFromSession,
    generateStudyGuide,
    resolveDexieAiConfig,
    type GeneratedQuestion,
} from "./notebooklm-ai";

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

// AI paths — browser-direct with the user's own API key (#902).

const NO_KEY_MESSAGE =
    "An API key is required to use the AI generators. " +
    "Configure a provider in Settings.";

/** Persist parsed questions as ``study_questions`` rows and return them. */
async function persistQuestions(
    questions: GeneratedQuestion[],
    meta: {userId: string; projectId: string; sessionId: string | null},
): Promise<StudyQuestion[]> {
    const db = getDb();
    const ts = nowIso();
    const rows: StudyQuestionRow[] = questions.map((q) => ({
        id: newId(),
        user_id: meta.userId,
        project_id: meta.projectId,
        session_id: meta.sessionId,
        question: q.question,
        expected_answer: q.expected_answer,
        question_type: q.question_type,
        difficulty: q.difficulty,
        topic: q.topic,
        edited: false,
        created_at: ts,
        updated_at: ts,
    }));
    if (rows.length > 0) await db.studyQuestions.bulkPut(rows);
    return rows.map(rowToOut);
}

export async function generateFromSessionDexie(
    sessionId: string,
): Promise<StudyQuestion[]> {
    const db = getDb();
    const session = await db.learningSessions.get(sessionId);
    if (!session) {
        throw new ApiError(404, `Session ${sessionId} not found`);
    }
    const project = session.project_id
        ? await db.learningProjects.get(session.project_id)
        : null;
    if (!project) {
        throw new ApiError(404, `Project for session ${sessionId} not found`);
    }
    const config = await resolveDexieAiConfig(project.user_id);
    if (!config) throw new ApiError(400, NO_KEY_MESSAGE);

    const questions = await generateQuestionsFromSession(sessionId, config);
    if (questions.length === 0) {
        throw new ApiError(
            400,
            "No study questions could be generated from this session.",
        );
    }
    return persistQuestions(questions, {
        userId: project.user_id,
        projectId: project.id,
        sessionId,
    });
}

export async function generateFromProjectDexie(
    projectId: string,
): Promise<StudyQuestion[]> {
    const assembled = await assembleProjectTranscript(projectId);
    if (!assembled) {
        throw new ApiError(404, `Project ${projectId} not found`);
    }
    const config = await resolveDexieAiConfig(assembled.userId);
    if (!config) throw new ApiError(400, NO_KEY_MESSAGE);

    const questions = await generateQuestionsFromProject(
        assembled.transcript,
        config,
    );
    if (questions.length === 0) {
        throw new ApiError(
            400,
            "No study questions could be generated for this project.",
        );
    }
    return persistQuestions(questions, {
        userId: assembled.userId,
        projectId,
        sessionId: null,
    });
}

export async function studyGuideDexie(projectId: string): Promise<string> {
    const assembled = await assembleStudyGuideContext(projectId);
    if (!assembled) {
        throw new ApiError(404, `Project ${projectId} not found`);
    }
    const config = await resolveDexieAiConfig(assembled.userId);
    if (!config) throw new ApiError(400, NO_KEY_MESSAGE);

    const markdown = await generateStudyGuide(assembled.ctx, config);
    if (!markdown.trim()) {
        throw new ApiError(
            503,
            "The study guide could not be generated. Please try again.",
        );
    }
    return markdown;
}
