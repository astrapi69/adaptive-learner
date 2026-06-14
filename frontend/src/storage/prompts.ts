/**
 * 42-cell system-prompt matrix ported from the backend session
 * plugin's ``prompts.py``. Cells are loaded from
 * ``data/session-prompts.json`` (the backend's _PROMPTS dict
 * exported verbatim) so Dexie mode produces the same prompt text
 * the API mode would.
 */

import PROMPTS_RAW from "../data/session-prompts.json";
import {LEARNING_METHODS, type LearningMethod} from "../lib/constants";
import type {
    ConversationAnalysisResult,
    LearningProfile,
    LearningProject,
} from "../types/domain";

interface PromptCell {
    de: string;
    en: string;
}

type PromptMatrix = Record<LearningMethod, Record<number, PromptCell>>;

const PROMPTS = PROMPTS_RAW as PromptMatrix;

const MIN_STEP = 1;
const MAX_STEP = 7;

function langKey(lang: string): "de" | "en" {
    return lang.startsWith("de") ? "de" : "en";
}

function formatWeight(value: number): string {
    const fixed = value.toFixed(2);
    // Strip trailing zeros / decimal point — matches the Python
    // ``f"{value:.2f}".rstrip("0").rstrip(".") or "0"``.
    const stripped = fixed.replace(/0+$/, "").replace(/\.$/, "");
    return stripped === "" ? "0" : stripped;
}

function dominantMethod(profile: LearningProfile | null): LearningMethod | null {
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

/**
 * Compose the system prompt for ``(method, step, lang)``. Matches
 * the backend ``build_prompt`` 1:1 — same cell, same context
 * suffix, same dominant-method hint format.
 */
export function buildPrompt(
    project: LearningProject,
    profile: LearningProfile | null,
    method: LearningMethod,
    step: number,
    lang: string,
): string {
    if (!LEARNING_METHODS.includes(method)) {
        throw new Error(`Unknown method ${method}`);
    }
    if (!Number.isInteger(step) || step < MIN_STEP || step > MAX_STEP) {
        throw new Error(`step must be int in [${MIN_STEP},${MAX_STEP}]; got ${step}`);
    }
    const key = langKey(lang);
    const cell = PROMPTS[method][step][key];
    const topic = project.topic;
    const goal = project.goal;
    const dominant = dominantMethod(profile);
    let context: string;
    if (key === "de") {
        context = `Lernprojekt: '${topic}' | Ziel: '${goal}'.`;
        if (dominant && profile) {
            const weight = formatWeight(profile[dominant]);
            context += ` Profil-Hinweis: dominante Methode ist ${dominant} (Gewicht ${weight}).`;
        }
    } else {
        context = `Learning project: '${topic}' | Goal: '${goal}'.`;
        if (dominant && profile) {
            const weight = formatWeight(profile[dominant]);
            context += ` Profile hint: dominant method is ${dominant} (weight ${weight}).`;
        }
    }
    return `${cell}\n\n${context}`;
}

function cleanList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter((s) => s.length > 0);
}

interface AnalysisFields {
    topic: string;
    summary: string;
    level: string;
    strengths: string[];
    weaknesses: string[];
    errors: string[];
    vocab: string[];
    curriculum: string[];
}

interface AnalysisLabels {
    intro: (topic: string) => string;
    summary: string;
    level: string;
    strengths: string;
    weaknesses: string;
    errors: string;
    vocab: string;
    curriculum: string;
    closing: string;
}

const ANALYSIS_LABELS_DE: AnalysisLabels = {
    intro: (topic) =>
        `Der Benutzer hat einen Chat zum Thema "${topic}" importiert und analysiert.`,
    summary: "Zusammenfassung: ",
    level: "Niveau: ",
    strengths: "Stärken: ",
    weaknesses: "Schwächen: ",
    errors: "Fehlermuster: ",
    vocab: "Bereits gelernte Vokabeln: ",
    curriculum: "Empfohlene Themen: ",
    closing:
        "Setze die Lernsitzung fort. Fokussiere auf die Schwächen und " +
        "Fehlermuster, beziehe dich auf die bereits gelernten Vokabeln und " +
        "eröffne deine erste Antwort, indem du dich ausdrücklich auf diese " +
        "Analyse beziehst.",
};

const ANALYSIS_LABELS_EN: AnalysisLabels = {
    intro: (topic) => `The user imported and analysed a chat about "${topic}".`,
    summary: "Summary: ",
    level: "Level: ",
    strengths: "Strengths: ",
    weaknesses: "Weaknesses: ",
    errors: "Error patterns: ",
    vocab: "Vocabulary already learned: ",
    curriculum: "Suggested topics: ",
    closing:
        "Continue the learning session. Focus on the weaknesses and error " +
        "patterns, reference the vocabulary already learned, and open your " +
        "first reply by explicitly referring to this analysis.",
};

/** True when at least one analysis field carries renderable content. */
function hasAnalysisContent(f: AnalysisFields): boolean {
    return Boolean(
        f.topic ||
            f.summary ||
            f.level ||
            f.strengths.length ||
            f.weaknesses.length ||
            f.errors.length ||
            f.vocab.length ||
            f.curriculum.length,
    );
}

/** Parse a raw analysis result into cleaned fields, or null when it is not
 *  an object or carries no renderable content. */
function extractAnalysisFields(
    analysis: ConversationAnalysisResult | null | undefined,
): AnalysisFields | null {
    if (!analysis || typeof analysis !== "object") return null;
    const fields: AnalysisFields = {
        topic: (analysis.topic ?? "").trim(),
        summary: (analysis.summary ?? "").trim(),
        level: (analysis.user_level ?? "").trim(),
        strengths: cleanList(analysis.strengths),
        weaknesses: cleanList(analysis.weaknesses),
        errors: cleanList(analysis.error_patterns),
        vocab: (analysis.vocabulary ?? [])
            .map((entry) => (entry?.word ?? "").trim())
            .filter((w) => w.length > 0),
        curriculum: (analysis.suggested_curriculum ?? [])
            .map((lesson) => (lesson?.title ?? "").trim())
            .filter((t) => t.length > 0),
    };
    return hasAnalysisContent(fields) ? fields : null;
}

/** Render the analysis fields into prompt lines via a label table. The
 *  intro and closing instruction always frame the block; the seven middle
 *  lines appear only when their field carries content. */
function renderAnalysisLines(
    fields: AnalysisFields,
    labels: AnalysisLabels,
): string[] {
    const lines = [labels.intro(fields.topic || "?")];
    const ordered: [string, string][] = [
        [labels.summary, fields.summary],
        [labels.level, fields.level],
        [labels.strengths, fields.strengths.join(", ")],
        [labels.weaknesses, fields.weaknesses.join(", ")],
        [labels.errors, fields.errors.join(", ")],
        [labels.vocab, fields.vocab.join(", ")],
        [labels.curriculum, fields.curriculum.join(", ")],
    ];
    for (const [prefix, value] of ordered) {
        if (value) lines.push(`${prefix}${value}`);
    }
    lines.push(labels.closing);
    return lines;
}

/**
 * Render an imported-chat analysis into a system-prompt addendum so a
 * session started from an analysed import continues with full context
 * (topic / summary / level / strengths / weaknesses / error patterns /
 * vocabulary / suggested curriculum). Dexie-mode mirror of the backend
 * ``build_analysis_context``; returns "" when the analysis carries nothing
 * useful, so callers can append unconditionally.
 *
 * @param analysis - The parsed conversation-analysis result, or null.
 * @param lang - The learner's UI language ("de…" → German, else English).
 * @returns The prompt addendum, or "" when there is nothing to add.
 *
 * @example
 * const addendum = buildAnalysisContext(analysis, "de");
 * const prompt = addendum ? `${systemPrompt}\n\n${addendum}` : systemPrompt;
 */
export function buildAnalysisContext(
    analysis: ConversationAnalysisResult | null | undefined,
    lang: string,
): string {
    const fields = extractAnalysisFields(analysis);
    if (!fields) return "";
    const labels =
        langKey(lang) === "de" ? ANALYSIS_LABELS_DE : ANALYSIS_LABELS_EN;
    return renderAnalysisLines(fields, labels).join("\n");
}
