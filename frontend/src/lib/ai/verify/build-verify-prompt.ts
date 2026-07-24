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
            "Decide whether the learner's answer is nonetheless essentially/semantically correct for the question - the same meaning, an accepted synonym or paraphrase, or a trivially different spelling.",
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

/** Coerce a raw verdict token into one of the three real verdicts. Tolerates
 *  models that phrase it ("yes, correct" / "no - wrong") instead of returning
 *  a bare enum value; returns ``null`` for anything unrecognised. */
function normalizeVerdict(value: string): Exclude<VerifyVerdict, "unknown"> | null {
    const v = value.trim().toLowerCase();
    if (v === "yes" || v === "partial" || v === "no") return v;
    if (/^yes\b/.test(v)) return "yes";
    if (/^partial/.test(v)) return "partial";
    if (/^no\b/.test(v)) return "no";
    return null;
}

/**
 * Last-ditch salvage: pull ``verdict`` and ``reason`` straight out of the raw
 * text with a tolerant regex when {@link extractJsonObject} could not parse it
 * (single-quoted keys, an unescaped char elsewhere in the object, …). This is
 * what lets a reply that is "JSON with a clear verdict but not strictly
 * parseable" still produce a usable verdict instead of leaking as raw text.
 */
function salvageVerdict(raw: string): VerifyResult | null {
    const text = raw ?? "";
    const verdictMatch = text.match(
        /["'“”]?\s*verdict\s*["'“”]?\s*:\s*["'“”]?\s*(yes|partial|no)\b/i,
    );
    if (!verdictMatch) return null;
    const reasonMatch = text.match(
        /["'“”]?\s*reason\s*["'“”]?\s*:\s*["'“”]([\s\S]*?)["'“”]\s*[},]/,
    );
    return {
        verdict: verdictMatch[1].toLowerCase() as VerifyVerdict,
        reason: reasonMatch ? reasonMatch[1].trim() : "",
    };
}

/**
 * Parse the model's reply into a typed verdict. Robust to prose- or
 * fence-wrapped JSON via {@link extractJsonObject}, and to the common
 * near-JSON deviations (trailing commas, smart/single quotes) via a tolerant
 * regex salvage.
 *
 * On a genuine failure it falls back to ``unknown`` with an EMPTY reason: the
 * UI then shows only the localized "no clear verdict" message and never the
 * model's raw reply. Surfacing the raw text — a JSON blob OR unstructured
 * prose — next to the fallback title was the display bug (#1883); the model
 * is instructed to answer in strict JSON, so any unparseable reply is
 * misbehaviour, not content worth showing verbatim.
 *
 * @param raw - The assistant's reply text.
 */
export function parseVerifyVerdict(raw: string): VerifyResult {
    const parsed = extractJsonObject(raw);
    const reasonRaw =
        parsed && typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    const verdict =
        parsed && typeof parsed.verdict === "string"
            ? normalizeVerdict(parsed.verdict)
            : null;

    if (verdict) {
        return {verdict, reason: reasonRaw};
    }

    // Structured parse missed a usable verdict — try the tolerant regex.
    const salvaged = salvageVerdict(raw);
    if (salvaged) return salvaged;

    // Genuinely no verdict: fallback message ONLY, never the raw reply.
    return {verdict: "unknown", reason: ""};
}
