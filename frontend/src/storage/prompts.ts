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

/**
 * Render an imported-chat analysis into a system-prompt addendum so a
 * session started from an analysed import continues with full context
 * (topic / summary / level / strengths / weaknesses / error patterns /
 * vocabulary / suggested curriculum). Mirrors the backend
 * ``build_analysis_context`` 1:1. Returns "" when the analysis carries
 * nothing useful, so callers can append unconditionally.
 */
export function buildAnalysisContext(
    analysis: ConversationAnalysisResult | null | undefined,
    lang: string,
): string {
    if (!analysis || typeof analysis !== "object") return "";

    const topic = (analysis.topic ?? "").trim();
    const summary = (analysis.summary ?? "").trim();
    const level = (analysis.user_level ?? "").trim();
    const strengths = cleanList(analysis.strengths);
    const weaknesses = cleanList(analysis.weaknesses);
    const errors = cleanList(analysis.error_patterns);
    const vocab = (analysis.vocabulary ?? [])
        .map((entry) => (entry?.word ?? "").trim())
        .filter((w) => w.length > 0);
    const curriculum = (analysis.suggested_curriculum ?? [])
        .map((lesson) => (lesson?.title ?? "").trim())
        .filter((t) => t.length > 0);

    if (
        !topic &&
        !summary &&
        !level &&
        strengths.length === 0 &&
        weaknesses.length === 0 &&
        errors.length === 0 &&
        vocab.length === 0 &&
        curriculum.length === 0
    ) {
        return "";
    }

    const lines: string[] = [];
    if (langKey(lang) === "de") {
        lines.push(
            `Der Benutzer hat einen Chat zum Thema "${topic || "?"}" importiert und analysiert.`,
        );
        if (summary) lines.push(`Zusammenfassung: ${summary}`);
        if (level) lines.push(`Niveau: ${level}`);
        if (strengths.length) lines.push(`Stärken: ${strengths.join(", ")}`);
        if (weaknesses.length) lines.push(`Schwächen: ${weaknesses.join(", ")}`);
        if (errors.length) lines.push(`Fehlermuster: ${errors.join(", ")}`);
        if (vocab.length)
            lines.push(`Bereits gelernte Vokabeln: ${vocab.join(", ")}`);
        if (curriculum.length)
            lines.push(`Empfohlene Themen: ${curriculum.join(", ")}`);
        lines.push(
            "Setze die Lernsitzung fort. Fokussiere auf die Schwächen und " +
                "Fehlermuster, beziehe dich auf die bereits gelernten Vokabeln und " +
                "eröffne deine erste Antwort, indem du dich ausdrücklich auf diese " +
                "Analyse beziehst.",
        );
    } else {
        lines.push(`The user imported and analysed a chat about "${topic || "?"}".`);
        if (summary) lines.push(`Summary: ${summary}`);
        if (level) lines.push(`Level: ${level}`);
        if (strengths.length) lines.push(`Strengths: ${strengths.join(", ")}`);
        if (weaknesses.length) lines.push(`Weaknesses: ${weaknesses.join(", ")}`);
        if (errors.length) lines.push(`Error patterns: ${errors.join(", ")}`);
        if (vocab.length)
            lines.push(`Vocabulary already learned: ${vocab.join(", ")}`);
        if (curriculum.length)
            lines.push(`Suggested topics: ${curriculum.join(", ")}`);
        lines.push(
            "Continue the learning session. Focus on the weaknesses and error " +
                "patterns, reference the vocabulary already learned, and open your " +
                "first reply by explicitly referring to this analysis.",
        );
    }
    return lines.join("\n");
}
