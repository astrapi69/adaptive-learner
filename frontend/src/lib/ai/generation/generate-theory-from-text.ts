/**
 * #1743 (EXP-036 family) — rephrase pasted textbook text into lesson
 * THEORY steps.
 *
 * The book-text wizard path pastes a chapter chunk; this module asks an
 * LLM to REFORMULATE that prose into a small number of theory steps in
 * its own words — never a verbatim copy or a mechanical trim. That
 * reformulation is a hard requirement (copyright + quality, mirroring the
 * manual authoring of the "KI fuer Einsteiger" / "Die Waehrung des
 * Geistes" companion sets), so the guardrail lives in the prompt and is
 * pinned by tests.
 *
 * Structural sibling of ``generate-exercises.ts``: it reuses the same
 * {@link AiProvider} seam (browser-direct or a mock), the same defensive
 * JSON extraction, and never throws on malformed model output — only a
 * provider transport/auth failure propagates. The produced
 * {@link TheoryStep}s are exactly the shape ``generateExercises`` already
 * consumes, so the two compose: text -> theory steps -> exercises.
 *
 * Library-grade: no app-state imports; the provider is injected.
 */

import {extractJsonObject} from "../../utils/extract-json";
import type {AiProvider, AiCompleteOptions} from "./generate-exercises";
import type {TheoryStep} from "./exercise-generation-prompt";

/** Options for {@link generateTheoryFromText}. */
export interface TheoryGenerationOptions {
    /** Target language for the theory prose. When omitted the model is
     *  told to keep the source language. */
    language?: string;
    /** Upper bound on the number of theory steps requested. Default 3. */
    maxSteps?: number;
    /** Forwarded to the provider so a long generation can be cancelled. */
    signal?: AbortSignal;
}

/** Outcome of a theory-generation run. ``steps`` are the parsed,
 *  non-empty theory steps; ``errors`` carries a parse/empty-input reason
 *  (never a thrown provider error — that propagates). */
export interface TheoryGenerationResult {
    steps: TheoryStep[];
    errors: string[];
}

/** Reply-length cap for a theory-rephrase call (~3 prose steps of JSON). */
const THEORY_MAX_TOKENS = 2000;

/** Default number of theory steps to request from one chunk. */
const DEFAULT_MAX_STEPS = 3;

/**
 * Build the rephrasing prompt. The instruction is deliberately explicit
 * about REFORMULATION so a learner-pasted book chapter is never copied
 * near-verbatim into the saved lesson.
 *
 * @param sourceText - The pasted textbook chunk.
 * @param options - Language / step-count overrides.
 * @returns A single prompt string requesting a ``{theory_steps: [...]}``
 *          JSON object.
 */
export function buildTheoryRephrasePrompt(
    sourceText: string,
    options: {language?: string; maxSteps?: number} = {},
): string {
    const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    const languageLine = options.language
        ? `Write the theory in ${options.language}.`
        : "Write the theory in the same language as the source text.";
    return [
        "You are a learning-content author. Turn the SOURCE TEXT below into",
        `at most ${maxSteps} short theory step(s) for a self-study lesson.`,
        "",
        "CRITICAL RULES:",
        "- Reformulate the knowledge in your OWN WORDS. Do NOT copy the",
        "  source text, and do NOT merely shorten or rearrange its",
        "  sentences. Never reproduce the wording verbatim.",
        "- Extract and explain the underlying concepts as a teacher would,",
        "  so a learner understands them without the original book.",
        "- Keep each step focused on one idea; use plain Markdown prose",
        "  (short paragraphs, optional bullet lists). No headings inside a",
        "  body.",
        `- ${languageLine}`,
        "",
        "Respond with ONLY a JSON object of this exact shape, no prose",
        "around it:",
        '{"theory_steps": [{"title": "Short heading", "body": "Markdown prose in your own words"}]}',
        "",
        "SOURCE TEXT:",
        sourceText,
    ].join("\n");
}

/** A raw theory step as the model may emit it. */
interface RawTheoryStep {
    title?: unknown;
    body?: unknown;
}

/**
 * Parse the model reply into theory steps. Never throws: a malformed
 * reply yields ``{steps: [], errors: [...]}``. Steps with an empty body
 * are dropped (a theory step must carry prose — the lesson validator
 * enforces the same).
 */
export function parseGeneratedTheory(raw: string): TheoryGenerationResult {
    const obj = extractJsonObject(raw);
    if (obj === null) {
        return {steps: [], errors: ["no JSON object found in the reply"]};
    }
    const list = obj.theory_steps;
    if (!Array.isArray(list)) {
        return {steps: [], errors: ["reply has no 'theory_steps' array"]};
    }
    const steps: TheoryStep[] = [];
    const errors: string[] = [];
    let index = 0;
    for (const entry of list as RawTheoryStep[]) {
        const body = typeof entry?.body === "string" ? entry.body.trim() : "";
        if (body === "") {
            errors.push(`step ${index + 1} dropped: empty body`);
            continue;
        }
        const title =
            typeof entry?.title === "string" && entry.title.trim() !== ""
                ? entry.title.trim()
                : null;
        steps.push({id: `theory-${steps.length + 1}`, title, body});
        index++;
    }
    if (steps.length === 0 && errors.length === 0) {
        errors.push("no theory steps in the reply");
    }
    return {steps, errors};
}

/**
 * Rephrase pasted textbook text into theory steps via the injected AI
 * provider.
 *
 * @param sourceText - The pasted chunk. Blank input short-circuits with
 *        no provider call.
 * @param provider - The AI seam (browser-direct, backend, or a mock).
 * @param options - Language / step-count / abort overrides.
 * @returns Parsed theory steps plus any parse/empty-input errors. A
 *          provider transport/auth failure propagates to the caller.
 */
export async function generateTheoryFromText(
    sourceText: string,
    provider: AiProvider,
    options: TheoryGenerationOptions = {},
): Promise<TheoryGenerationResult> {
    if (sourceText.trim() === "") {
        return {steps: [], errors: ["no source text to rephrase"]};
    }
    const prompt = buildTheoryRephrasePrompt(sourceText, {
        language: options.language,
        maxSteps: options.maxSteps,
    });
    const runOptions: AiCompleteOptions = {
        signal: options.signal,
        maxTokens: THEORY_MAX_TOKENS,
    };
    const raw = await provider.complete(prompt, runOptions);
    return parseGeneratedTheory(raw);
}
