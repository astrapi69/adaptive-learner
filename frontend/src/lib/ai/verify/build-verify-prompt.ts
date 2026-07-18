/**
 * Build the AI chat messages + parse the verdict for the free-text
 * "have the AI re-check my answer" feature (#1798).
 *
 * After a free-text answer is graded WRONG by the exact-match + Levenshtein
 * grader, the learner can ask the configured BYOK provider whether their
 * answer should count as correct even though it is not in the ``accept``
 * list. This is an INFORMATIONAL second opinion — the exercise result is
 * never changed by it, so a model hallucination cannot corrupt the grade.
 *
 * Pure + library-grade: the only import is the shared ``ChatMessage`` type
 * and the defensive JSON extractor. No storage / i18n / React. The caller
 * hands the exercise question, the learner's answer and the accepted
 * answers; this returns the messages for the existing browser-direct
 * ``aiComplete`` path and parses the model's reply into a typed verdict.
 */

import {extractJsonObject} from "../../utils/extract-json";
import type {ChatMessage} from "../../../storage/ai/ai-providers";

export interface VerifyAnswerContext {
    /** The exercise question / prompt the learner was answering. */
    prompt: string;
    /** What the learner typed (and was marked wrong). */
    userAnswer: string;
    /** The authored accepted answers the grader compared against. */
    acceptedAnswers: string[];
    /** The learner's UI language (BCP-47), so the reason comes back in it. */
    uiLanguage: string;
    /** BCP-47 code the lesson teaches (target language), if known. */
    targetLanguage?: string | null;
    /** BCP-47 code the learner speaks (source language), if known. */
    sourceLanguage?: string | null;
    /** Content domain (``language`` / ``programming`` / …), if known. */
    domain?: string | null;
}

/** ``yes`` = essentially correct, ``partial`` = partly, ``no`` = the grade
 *  stands, ``unknown`` = the reply could not be parsed into a verdict. */
export type VerifyVerdict = "yes" | "partial" | "no" | "unknown";

export interface VerifyResult {
    verdict: VerifyVerdict;
    reason: string;
}

/** Keep the context small so a huge prompt can't blow the token budget. */
const MAX_FIELD_CHARS = 2000;

function clamp(text: string): string {
    const trimmed = (text ?? "").trim();
    return trimmed.length > MAX_FIELD_CHARS
        ? `${trimmed.slice(0, MAX_FIELD_CHARS)}…`
        : trimmed;
}

/**
 * Compose the grader messages for one re-check turn.
 *
 * @param context - The exercise question, the learner's answer, the accepted
 *   answers, plus language/domain hints.
 * @returns Messages for ``aiComplete``.
 */
export function buildVerifyMessages(context: VerifyAnswerContext): ChatMessage[] {
    const subject =
        context.domain && context.domain !== "language"
            ? `the topic "${context.domain}"`
            : context.targetLanguage
              ? `${context.targetLanguage}${
                    context.sourceLanguage ? ` (explained in ${context.sourceLanguage})` : ""
                }`
              : "this lesson";

    const system: ChatMessage = {
        role: "system",
        content: [
            `You are an impartial grader in a learning app. The learner is studying ${subject}.`,
            "An automated checker marked the learner's free-text answer WRONG because it did not exactly match any accepted answer.",
            "Decide whether the learner's answer is nonetheless essentially/semantically correct for the question — the same meaning, an accepted synonym or paraphrase, or a trivially different spelling.",
            "Be fair but honest: do NOT approve an answer that is actually wrong or that changes the meaning.",
            "Reply with ONLY a JSON object, no prose, no code fences:",
            '{"verdict": "yes" | "partial" | "no", "reason": "<one short sentence>"}',
            "Use \"yes\" if it should count as correct, \"partial\" if it is only partly right, \"no\" if the original wrong grade is fair.",
            `Write the "reason" in the learner's UI language (BCP-47 code: ${context.uiLanguage}).`,
        ].join("\n"),
    };

    const accepted =
        context.acceptedAnswers.length > 0
            ? context.acceptedAnswers.map((a) => `- ${clamp(a)}`).join("\n")
            : "(none provided)";

    const user: ChatMessage = {
        role: "user",
        content: [
            `Question: ${clamp(context.prompt)}`,
            "Accepted answers:",
            accepted,
            `Learner's answer: ${clamp(context.userAnswer)}`,
        ].join("\n"),
    };

    return [system, user];
}

/**
 * Parse the model's reply into a typed verdict. Robust to prose- or
 * fence-wrapped JSON via {@link extractJsonObject}. On any structural
 * failure (no JSON, unrecognised verdict) it falls back to ``unknown`` and
 * surfaces the raw text as the reason, so the learner still sees the reply.
 *
 * @param raw - The assistant's reply text.
 */
export function parseVerifyVerdict(raw: string): VerifyResult {
    const parsed = extractJsonObject(raw);
    const verdictRaw =
        parsed && typeof parsed.verdict === "string"
            ? parsed.verdict.trim().toLowerCase()
            : "";
    const reasonRaw =
        parsed && typeof parsed.reason === "string" ? parsed.reason.trim() : "";

    if (verdictRaw === "yes" || verdictRaw === "partial" || verdictRaw === "no") {
        return {verdict: verdictRaw, reason: reasonRaw};
    }
    // Unparseable or unrecognised verdict — keep the reason if we got one,
    // else show the raw reply so the learner is never left with nothing.
    return {verdict: "unknown", reason: reasonRaw || (raw ?? "").trim()};
}
