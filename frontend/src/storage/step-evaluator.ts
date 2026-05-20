/**
 * Step-evaluator port (Phase 10D).
 *
 * Mirrors ``adaptive_learner_session.step_evaluator`` exactly:
 * same English system prompt, same JSON schema, same fallback
 * semantics on parse failure.
 *
 * The evaluator runs as a second AI call after the chat reply,
 * deciding whether the learner should advance / stay / repeat /
 * step back. ``fallback_used=true`` flags cases where the AI's
 * response couldn't be parsed and the deterministic +1 default
 * was substituted.
 */

import {aiComplete, resolveModel, type ChatMessage} from "./ai-providers";
import type {AIProvider, LearningMethod} from "../lib/constants";
import {extractJsonObject} from "../lib/extract-json";

const MIN_STEP = 1;
const MAX_STEP = 7;

const STEP_DESCRIPTIONS: Record<number, string> = {
    1: "input — the learner is encountering new material for the first time",
    2: "attempt — the learner is applying what they just learned",
    3: "error — mistakes are happening and being noticed",
    4: "feedback — the learner is receiving and processing feedback on mistakes",
    5: "adapt — the learner is adjusting their approach based on feedback",
    6: "repeat — the learner is practising a variation with the new understanding",
    7: "integrate — the learner is connecting the new knowledge to broader context",
};

const METHOD_EVAL_HINTS: Record<LearningMethod, string> = {
    deductive:
        "Look for rule comprehension and correct application of the underlying theory. " +
        "Readiness = the learner can articulate WHY, not only WHAT.",
    inductive:
        "Look for pattern recognition from examples — does the learner generalise from " +
        "concrete cases to the underlying principle?",
    error_based:
        "Errors are the point. Readiness = the learner identifies WHAT went wrong AND WHY, " +
        "not just that something went wrong.",
    dialogic:
        "Quality of the exchange matters more than producing the 'correct' answer first. " +
        "Readiness = productive back-and-forth, not monologue.",
    contextual:
        "Look for application in the learner's OWN real situation. Readiness = the learner " +
        "ties the concept to a concrete, personal context.",
    ai_adaptive:
        "The learner is steering. Readiness = self-direction — clear next-step intent, " +
        "productive prompting back to the AI.",
};

const EVALUATION_SYSTEM_PROMPT = `\
You are an assessment co-pilot for an adaptive learning system. Your job
is to read a short learner-AI exchange and judge whether the learner is
ready to advance to the next step in a 7-step learning cycle.

You will receive: the current learning method, the current cycle step,
a short conversation history, and the language the human-readable
'reason' field must be written in.

Output ONLY a single valid JSON object, with NO surrounding prose, NO
markdown code fences, NO trailing commentary. The schema is:

  {
    "advance":         <boolean>,
    "confidence":      <float in [0.0, 1.0]>,
    "reason":          <string, max ~200 chars, in the output_language>,
    "suggested_step":  <integer in [1, 7]>
  }

Field semantics:
- advance=true  → the learner is ready to leave the current step.
- advance=false → stay on the current step for the next exchange.
- confidence is your certainty in the advance decision (0 = no idea,
  1 = unambiguous).
- suggested_step is where the next exchange should START. Usually
  current+1, but you MAY skip forward (e.g. 1 → 3 if the learner
  clearly already grasps the input), repeat the current step (= the
  same value as current), or go BACKWARD (e.g. 4 → 2 if the learner's
  last turn reveals they did not actually understand and should
  re-attempt). The 7-step cycle is a framework, not a conveyor belt.
- After step 7 the learning cycle ends; suggested_step must not be 8.
  If the learner has fully integrated, suggest 7 with advance=false.

If you are unsure, prefer advance=false with a moderate confidence —
staying on the current step is the safer pedagogical default.`;

export interface StepEvaluation {
    advance: boolean;
    confidence: number;
    reason: string;
    suggested_step: number;
    fallback_used: boolean;
}

function clampStep(value: unknown, currentStep: number): number {
    const n = typeof value === "number" ? Math.trunc(value) : parseInt(String(value), 10);
    if (!Number.isFinite(n)) return currentStep;
    if (n < MIN_STEP) return MIN_STEP;
    if (n > MAX_STEP) return MAX_STEP;
    return n;
}

function clampConfidence(value: unknown): number {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (!Number.isFinite(n)) return 0.5;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

function deterministicFallback(currentStep: number): StepEvaluation {
    if (currentStep >= MAX_STEP) {
        return {
            advance: false,
            confidence: 0.5,
            reason: "Evaluator output unparseable; staying at step 7.",
            suggested_step: MAX_STEP,
            fallback_used: true,
        };
    }
    return {
        advance: true,
        confidence: 0.5,
        reason: "Evaluator output unparseable; defaulting to +1 advance.",
        suggested_step: currentStep + 1,
        fallback_used: true,
    };
}

/**
 * Compose the evaluator's two-message prompt. ``[system, user]``
 * shape — system carries the schema, user carries the case data.
 */
export function buildEvaluationMessages(opts: {
    method: LearningMethod;
    currentStep: number;
    history: ChatMessage[];
    outputLanguage: string;
}): ChatMessage[] {
    const stepDesc = STEP_DESCRIPTIONS[opts.currentStep] ?? `step ${opts.currentStep}`;
    const methodHint = METHOD_EVAL_HINTS[opts.method] ?? "";
    const recent = opts.history.length > 8 ? opts.history.slice(-8) : opts.history;
    const turns: string[] = [];
    for (const msg of recent) {
        if (typeof msg.role !== "string" || typeof msg.content !== "string") continue;
        const label =
            msg.role === "user"
                ? "Learner"
                : msg.role === "assistant"
                  ? "AI"
                  : msg.role === "system"
                    ? "(prompt)"
                    : msg.role;
        turns.push(`${label}: ${msg.content}`);
    }
    const transcript = turns.length > 0 ? turns.join("\n") : "(no exchanges yet)";
    const userContent =
        `method: ${opts.method}\n` +
        `method_hint: ${methodHint}\n` +
        `current_step: ${opts.currentStep} (${stepDesc})\n` +
        `output_language: ${opts.outputLanguage}\n\n` +
        `--- transcript ---\n${transcript}\n--- end transcript ---\n\n` +
        `Return only the JSON evaluation. No surrounding prose.`;
    return [
        {role: "system", content: EVALUATION_SYSTEM_PROMPT},
        {role: "user", content: userContent},
    ];
}

/**
 * Parse the raw AI JSON response into a StepEvaluation. Strips
 * markdown fences; falls back to the deterministic +1 advance
 * on any structural problem.
 */
export function parseEvaluationResponse(
    raw: string | null,
    currentStep: number,
): StepEvaluation {
    if (typeof raw !== "string" || raw.trim() === "") {
        return deterministicFallback(currentStep);
    }
    const obj = extractJsonObject(raw);
    if (obj === null) {
        return deterministicFallback(currentStep);
    }
    if (!("advance" in obj) || !("suggested_step" in obj)) {
        return deterministicFallback(currentStep);
    }
    const advance = Boolean(obj.advance);
    const confidence = clampConfidence(obj.confidence);
    const rawReason = obj.reason;
    const reason =
        typeof rawReason === "string" && rawReason.trim().length > 0
            ? rawReason.trim().slice(0, 240)
            : "(no reason provided)";
    const suggestedStep = clampStep(obj.suggested_step, currentStep);
    return {advance, confidence, reason, suggested_step: suggestedStep, fallback_used: false};
}

/**
 * End-to-end evaluator: build prompt, call AI, parse response.
 * Never throws — any provider failure collapses to the
 * deterministic fallback so the caller doesn't need to wrap.
 */
export async function evaluateStep(opts: {
    provider: AIProvider;
    apiKey: string;
    modelOverride: string | null;
    method: LearningMethod;
    currentStep: number;
    history: ChatMessage[];
    outputLanguage: string;
}): Promise<StepEvaluation> {
    const messages = buildEvaluationMessages({
        method: opts.method,
        currentStep: opts.currentStep,
        history: opts.history,
        outputLanguage: opts.outputLanguage,
    });
    try {
        const raw = await aiComplete({
            provider: opts.provider,
            model: resolveModel(opts.provider, opts.modelOverride),
            apiKey: opts.apiKey,
            messages,
            maxTokens: 256,
        });
        return parseEvaluationResponse(raw, opts.currentStep);
    } catch {
        return deterministicFallback(opts.currentStep);
    }
}
