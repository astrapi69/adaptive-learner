/**
 * Local (Dexie-mode) session orchestration (Phase 10D).
 *
 * Ports the session plugin's ``/start`` + ``/message`` route
 * behaviour to the browser: build the system prompt, persist
 * messages, fire the AI completion + step evaluator directly,
 * apply the cycle-step advance.
 *
 * Used by ``DexieStorage.session.*`` — the file is kept
 * separate so the orchestration logic is independently
 * testable.
 */

import {aiComplete, aiStream, resolveModel, type ChatMessage} from "./ai-providers";
import {
    getDb,
    newId,
    nowIso,
    type LearningProfileRow,
    type LearningSessionRow,
    type SessionMessageRow,
    type StepEvaluationRow,
} from "./db";
import {buildPrompt} from "./prompts";
import {evaluateStep, type StepEvaluation} from "./step-evaluator";
import {ApiError} from "../api/client";
import {LEARNING_METHODS, type LearningMethod} from "../lib/constants";
import type {
    LearningProject,
    LearningSession,
    SessionMessage,
    StepEvaluationVerdict,
} from "../types/domain";

const MIN_STEP = 1;
const MAX_STEP = 7;

/**
 * Confidence threshold above which a real (non-fallback) AI
 * evaluation actually moves ``cycle_step``. Mirrors the backend
 * ``app.yaml`` ``session.step_evaluation.confidence_threshold``
 * default of 0.6.
 */
const STEP_EVAL_CONFIDENCE_THRESHOLD = 0.6;

function dominantFromProfile(profile: LearningProfileRow | undefined): LearningMethod | null {
    if (!profile) return null;
    const sorted = [...LEARNING_METHODS].sort();
    let best: LearningMethod | null = null;
    let bestVal = -Infinity;
    for (const m of sorted) {
        const w = profile[m];
        if (typeof w === "number" && w > bestVal) {
            bestVal = w;
            best = m;
        }
    }
    return best;
}

function profileRowToProfile(row: LearningProfileRow | undefined) {
    if (!row) return null;
    const dominant = dominantFromProfile(row) ?? "deductive";
    return {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        deductive: row.deductive,
        inductive: row.inductive,
        error_based: row.error_based,
        dialogic: row.dialogic,
        contextual: row.contextual,
        ai_adaptive: row.ai_adaptive,
        assessed_at: row.assessed_at,
        version: row.version,
        dominant_method: dominant as LearningMethod,
    };
}

function rowToSessionDto(row: LearningSessionRow): LearningSession {
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

function rowToMessageDto(row: SessionMessageRow): SessionMessage {
    return {
        id: row.id,
        session_id: row.session_id,
        role: row.role,
        content: row.content,
        created_at: row.created_at,
    };
}

/**
 * Implements ``POST /api/plugins/session/start``: create the
 * LearningSession row, compose the system prompt, persist it as
 * a ``role=system`` SessionMessage so later /message calls see
 * it in the chronological history.
 */
export async function startSession(opts: {
    projectId: string;
    method?: LearningMethod;
    cycleStep?: number;
    lang?: string;
}): Promise<{session: LearningSession; system_prompt: string}> {
    const db = getDb();
    const project = await db.learningProjects.get(opts.projectId);
    if (!project) {
        throw new ApiError(404, `Project ${opts.projectId} not found`);
    }
    const profile = await db.learningProfiles
        .where("project_id")
        .equals(opts.projectId)
        .first();
    const method =
        opts.method ?? dominantFromProfile(profile) ?? "deductive";
    const cycleStep = opts.cycleStep ?? 1;
    if (!Number.isInteger(cycleStep) || cycleStep < MIN_STEP || cycleStep > MAX_STEP) {
        throw new ApiError(
            400,
            `cycle_step must be int in [${MIN_STEP}, ${MAX_STEP}]; got ${cycleStep}`,
        );
    }

    const ts = nowIso();
    const sessionRow: LearningSessionRow = {
        id: newId(),
        project_id: project.id,
        method,
        started_at: ts,
        ended_at: null,
        cycle_step: cycleStep,
        status: "active",
    };
    await db.learningSessions.add(sessionRow);

    const projectDto: LearningProject = {
        id: project.id,
        user_id: project.user_id,
        topic: project.topic,
        goal: project.goal,
        timeframe: project.timeframe,
        daily_minutes: project.daily_minutes,
        current_problem: project.current_problem,
        active: project.active,
        created_at: project.created_at,
        updated_at: project.updated_at,
    };
    const systemPrompt = buildPrompt(
        projectDto,
        profileRowToProfile(profile),
        method,
        cycleStep,
        opts.lang ?? "en",
    );
    const systemMsg: SessionMessageRow = {
        id: newId(),
        session_id: sessionRow.id,
        role: "system",
        content: systemPrompt,
        created_at: nowIso(),
    };
    await db.sessionMessages.add(systemMsg);

    return {session: rowToSessionDto(sessionRow), system_prompt: systemPrompt};
}

interface SendMessageResult {
    user_message: SessionMessage;
    assistant_message: SessionMessage | null;
    ai_error: string | null;
    session: LearningSession;
    step_evaluation: StepEvaluationVerdict | null;
    /** v1.4.0 — auto-loop not yet implemented in Dexie mode; always null. */
    topic_transition?: null;
}

/**
 * Implements ``POST /api/plugins/session/{id}/message``: persist
 * the user message, fire the AI, persist the assistant reply,
 * run the step evaluator, advance cycle_step if applicable.
 */
export async function sendMessage(opts: {
    sessionId: string;
    role: "user" | "assistant" | "system";
    content: string;
}): Promise<SendMessageResult> {
    const db = getDb();
    const sess = await db.learningSessions.get(opts.sessionId);
    if (!sess) {
        throw new ApiError(404, `Session ${opts.sessionId} not found`);
    }
    if (sess.status !== "active") {
        throw new ApiError(
            400,
            `Session ${opts.sessionId} is ${sess.status}; cannot append messages.`,
        );
    }
    const userMsgRow: SessionMessageRow = {
        id: newId(),
        session_id: sess.id,
        role: opts.role,
        content: opts.content,
        created_at: nowIso(),
    };
    await db.sessionMessages.add(userMsgRow);

    const buildResponse = async (
        assistant: SessionMessageRow | null,
        aiError: string | null,
        stepEval: StepEvaluationVerdict | null,
    ): Promise<SendMessageResult> => {
        const freshSession = await db.learningSessions.get(sess.id);
        return {
            user_message: rowToMessageDto(userMsgRow),
            assistant_message: assistant ? rowToMessageDto(assistant) : null,
            ai_error: aiError,
            session: rowToSessionDto(freshSession ?? sess),
            step_evaluation: stepEval,
        };
    };

    // Only user messages trigger the AI round-trip + advance.
    if (opts.role !== "user") {
        return buildResponse(null, null, null);
    }

    const project = await db.learningProjects.get(sess.project_id);
    if (!project) {
        return buildResponse(null, "session has no project; AI reply skipped.", null);
    }
    const settings = await db.userSettings
        .where("user_id")
        .equals(project.user_id)
        .first();
    if (!settings) {
        return buildResponse(null, "No active AI provider configured.", null);
    }
    const provider = settings.active_provider;
    const apiKey = settings[`api_key_${provider}`] as string | null;
    if (!apiKey) {
        return buildResponse(null, `No API key stored for provider '${provider}'.`, null);
    }
    const override = settings[`model_override_${provider}`] as string | null;
    const model = resolveModel(provider, override);

    // Build the messages payload from the persisted chronological
    // history. ``where().equals()`` doesn't preserve insertion
    // order so we sort by created_at.
    const historyRows = await db.sessionMessages
        .where("session_id")
        .equals(sess.id)
        .toArray();
    historyRows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const history: ChatMessage[] = historyRows.map((m) => ({
        role: m.role,
        content: m.content,
    }));

    let assistantText: string;
    try {
        assistantText = await aiComplete({
            provider,
            model,
            apiKey,
            messages: history,
            maxTokens: 1024,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return buildResponse(null, `AI provider error: ${msg}`, null);
    }
    if (!assistantText) {
        return buildResponse(
            null,
            `No registered provider returned a reply for model '${model}'.`,
            null,
        );
    }
    const assistantMsg: SessionMessageRow = {
        id: newId(),
        session_id: sess.id,
        role: "assistant",
        content: assistantText,
        created_at: nowIso(),
    };
    await db.sessionMessages.add(assistantMsg);

    // Step evaluator — fire on top of the assistant's reply.
    const owner = await db.users.get(project.user_id);
    const evalLang = owner?.language ?? "en";
    const fullHistory: ChatMessage[] = [
        ...history,
        {role: "assistant", content: assistantText},
    ];
    const fromStep = sess.cycle_step;
    const evaluation: StepEvaluation = await evaluateStep({
        provider,
        apiKey,
        modelOverride: override,
        method: sess.method,
        currentStep: fromStep,
        history: fullHistory,
        outputLanguage: evalLang,
    });
    const applied = evaluation.fallback_used
        ? evaluation.advance
        : evaluation.advance && evaluation.confidence >= STEP_EVAL_CONFIDENCE_THRESHOLD;
    const toStep = applied ? evaluation.suggested_step : fromStep;
    if (applied) {
        await db.learningSessions.update(sess.id, {cycle_step: evaluation.suggested_step});
    }
    const stepEvalRow: StepEvaluationRow = {
        id: newId(),
        session_id: sess.id,
        from_step: fromStep,
        // Aligned with the backend column in v1.8.0 (Phase 21A).
        // The raw AI verdict (``evaluation.suggested_step``)
        // still drives the StepEvaluationVerdict dto below; the
        // persisted ``to_step`` matches the session's actual
        // movement so backend / Dexie rows are interchangeable
        // for sync.
        to_step: toStep,
        advance: evaluation.advance,
        applied,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
        fallback_used: evaluation.fallback_used,
        duration_seconds: 0,
        evaluated_at: nowIso(),
    };
    await db.stepEvaluations.add(stepEvalRow);

    const stepEvalDto: StepEvaluationVerdict = {
        advance: evaluation.advance,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
        suggested_step: evaluation.suggested_step,
        fallback_used: evaluation.fallback_used,
        applied,
        from_step: fromStep,
    };
    return buildResponse(assistantMsg, null, stepEvalDto);
}


/**
 * v1.6.0 / Phase 19B-2 — browser-direct streaming variant of
 * :func:`sendMessage`. Same orchestration (persist user message,
 * call AI, persist assistant message, run step evaluator) but the
 * AI call streams via ``aiStream`` and each delta lands in
 * ``onChunk``. Returns the same ``SendMessageResult`` shape as
 * ``sendMessage`` so the caller doesn't have to branch.
 *
 * On streaming failure mid-response, returns ``ai_error`` and a
 * null ``assistant_message`` rather than throwing (consistent
 * with the non-stream path).
 */
export async function sendMessageStream(
    opts: {
        sessionId: string;
        role: "user" | "assistant" | "system";
        content: string;
        onChunk: (delta: string) => void;
        onStart?: (userMessage: SessionMessage) => void;
        signal?: AbortSignal;
    },
): Promise<SendMessageResult> {
    const db = getDb();
    const sess = await db.learningSessions.get(opts.sessionId);
    if (!sess) {
        throw new ApiError(404, `Session ${opts.sessionId} not found`);
    }
    if (sess.status !== "active") {
        throw new ApiError(
            400,
            `Session ${opts.sessionId} is ${sess.status}; cannot append messages.`,
        );
    }
    const userMsgRow: SessionMessageRow = {
        id: newId(),
        session_id: sess.id,
        role: opts.role,
        content: opts.content,
        created_at: nowIso(),
    };
    await db.sessionMessages.add(userMsgRow);
    opts.onStart?.(rowToMessageDto(userMsgRow));

    const buildResponse = async (
        assistant: SessionMessageRow | null,
        aiError: string | null,
        stepEval: StepEvaluationVerdict | null,
    ): Promise<SendMessageResult> => {
        const freshSession = await db.learningSessions.get(sess.id);
        return {
            user_message: rowToMessageDto(userMsgRow),
            assistant_message: assistant ? rowToMessageDto(assistant) : null,
            ai_error: aiError,
            session: rowToSessionDto(freshSession ?? sess),
            step_evaluation: stepEval,
        };
    };

    // Non-user writes bypass the AI step (parity with sendMessage).
    if (opts.role !== "user") {
        return buildResponse(null, null, null);
    }

    const project = await db.learningProjects.get(sess.project_id);
    if (!project) {
        return buildResponse(null, "session has no project; AI reply skipped.", null);
    }
    const settings = await db.userSettings
        .where("user_id")
        .equals(project.user_id)
        .first();
    if (!settings) {
        return buildResponse(null, "No active AI provider configured.", null);
    }
    const provider = settings.active_provider;
    const apiKey = settings[`api_key_${provider}`] as string | null;
    if (!apiKey) {
        return buildResponse(null, `No API key stored for provider '${provider}'.`, null);
    }
    const override = settings[`model_override_${provider}`] as string | null;
    const model = resolveModel(provider, override);

    const historyRows = await db.sessionMessages
        .where("session_id")
        .equals(sess.id)
        .toArray();
    historyRows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const history: ChatMessage[] = historyRows.map((m) => ({
        role: m.role,
        content: m.content,
    }));

    // Stream the assistant response, accumulating the full text
    // so we can persist it + feed it to the step evaluator after
    // the stream ends.
    const accumulator: string[] = [];
    try {
        await aiStream({
            provider,
            model,
            apiKey,
            messages: history,
            maxTokens: 1024,
            signal: opts.signal,
            onChunk: (delta) => {
                accumulator.push(delta);
                opts.onChunk(delta);
            },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return buildResponse(null, `AI provider error: ${msg}`, null);
    }
    const assistantText = accumulator.join("");
    if (!assistantText) {
        return buildResponse(
            null,
            `No registered provider returned a reply for model '${model}'.`,
            null,
        );
    }
    const assistantMsg: SessionMessageRow = {
        id: newId(),
        session_id: sess.id,
        role: "assistant",
        content: assistantText,
        created_at: nowIso(),
    };
    await db.sessionMessages.add(assistantMsg);

    // Step evaluator — same shape as non-stream path.
    const owner = await db.users.get(project.user_id);
    const evalLang = owner?.language ?? "en";
    const fullHistory: ChatMessage[] = [
        ...history,
        {role: "assistant", content: assistantText},
    ];
    const fromStep = sess.cycle_step;
    const evaluation: StepEvaluation = await evaluateStep({
        provider,
        apiKey,
        modelOverride: override,
        method: sess.method,
        currentStep: fromStep,
        history: fullHistory,
        outputLanguage: evalLang,
    });
    const applied = evaluation.fallback_used
        ? evaluation.advance
        : evaluation.advance && evaluation.confidence >= STEP_EVAL_CONFIDENCE_THRESHOLD;
    if (applied) {
        await db.learningSessions.update(sess.id, {cycle_step: evaluation.suggested_step});
    }
    const stepEvalRow: StepEvaluationRow = {
        id: newId(),
        session_id: sess.id,
        from_step: fromStep,
        // v1.8.0 Phase 21A alignment — same shape the non-stream
        // sendMessage writes above.
        to_step: applied ? evaluation.suggested_step : fromStep,
        advance: evaluation.advance,
        applied,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
        fallback_used: evaluation.fallback_used,
        duration_seconds: 0,
        evaluated_at: nowIso(),
    };
    await db.stepEvaluations.add(stepEvalRow);

    const stepEvalDto: StepEvaluationVerdict = {
        advance: evaluation.advance,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
        suggested_step: evaluation.suggested_step,
        fallback_used: evaluation.fallback_used,
        applied,
        from_step: fromStep,
    };
    return buildResponse(assistantMsg, null, stepEvalDto);
}
