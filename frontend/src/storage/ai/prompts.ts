/**
 * 42-cell system-prompt matrix ported from the backend session
 * plugin's ``prompts.py``. Cells are loaded from
 * ``data/session-prompts.json`` (the backend's _PROMPTS dict
 * exported verbatim) so Dexie mode produces the same prompt text
 * the API mode would.
 */

import PROMPTS_RAW from "../../data/session-prompts.json";
import {LEARNING_METHODS, type LearningMethod} from "../../lib/constants";
import type {
    ConversationAnalysisResult,
    LearningProfile,
    LearningProject,
} from "../../types/domain";

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

// --- Output-language directive (#827) ------------------------------------
//
// The prompt-cell matrix above only carries DE + EN, so for every other UI
// language the AI receives an English prompt and would otherwise reply in
// English. Maps the 11 UI language codes to (English name, endonym). Dexie
// mirror of the backend ``LANGUAGE_NAMES`` / ``build_language_directive`` —
// kept byte-identical.

const LANGUAGE_NAMES: Record<string, [string, string]> = {
    de: ["German", "Deutsch"],
    el: ["Greek", "Ελληνικά"],
    en: ["English", "English"],
    es: ["Spanish", "Español"],
    fr: ["French", "Français"],
    hi: ["Hindi", "हिन्दी"],
    id: ["Indonesian", "Bahasa Indonesia"],
    ja: ["Japanese", "日本語"],
    ko: ["Korean", "한국어"],
    pt: ["Portuguese", "Português"],
    tr: ["Turkish", "Türkçe"],
};

/** Bare language subtag: "de-DE" / "pt_BR" -> "de" / "pt". */
function baseLang(lang: string): string {
    if (!lang) return "en";
    return lang.toLowerCase().replace(/_/g, "-").split("-", 1)[0];
}

/**
 * An explicit "reply in <language>" instruction for the session prompt.
 * The 42-cell matrix only has DE + EN, so a learner on any of the other nine
 * UI languages would otherwise get English replies. Names the learner's
 * language so the AI answers in it regardless of the language the
 * instructions are written in. Falls back to English for an unknown code.
 * Byte-identical to the backend ``build_language_directive`` (#827).
 *
 * @param lang - The learner's UI language code (e.g. "ko", "pt-BR").
 * @returns A one-line directive, always non-empty.
 *
 * @example
 * buildLanguageDirective("ko");
 * // "IMPORTANT: Always write your replies to the learner in Korean (한국어), …"
 */
export function buildLanguageDirective(lang: string): string {
    const [english, endonym] = LANGUAGE_NAMES[baseLang(lang)] ?? LANGUAGE_NAMES.en;
    const named = english === endonym ? english : `${english} (${endonym})`;
    return (
        `IMPORTANT: Always write your replies to the learner in ${named}, ` +
        "regardless of the language of these instructions."
    );
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


// --- Learning-progress context (lesson awareness, #797) -----------------
//
// Dexie-mode mirror of the backend ``build_learning_context``. Renders the
// learner's lesson progress + recent mistakes into a bounded system-prompt
// addendum so a new AI session is aware of completed content, the lesson in
// progress, and the elements the learner keeps missing — instead of
// answering generically. Output is byte-identical to the Python builder for
// the same input (pinned by a cross-language golden).

/** Cap the most-recent completed lessons folded into the prompt. */
export const MAX_COMPLETED_LESSONS = 12;
/** Cap the most-recent mistakes folded into the prompt. */
export const MAX_RECENT_ERRORS = 8;

/** One finished lesson: a display label + its score. */
export interface CompletedLesson {
    label: string;
    correct: number;
    total: number;
}

/** The lesson the learner is currently on (label + 1-based step). */
export interface InProgressLesson {
    label: string;
    step: number;
}

/** One element the learner got wrong (their answer vs the right one). */
export interface RecentMistake {
    element: string;
    answered: string;
    expected: string;
    count: number;
}

/** Structured input for {@link buildLearningContext} — the gatherer
 *  (IndexedDB) fills this; the builder only formats it. */
export interface LearningContext {
    topic: string;
    completed: CompletedLesson[];
    inProgress: InProgressLesson | null;
    mistakes: RecentMistake[];
}

interface LearningLabels {
    header: string;
    topic: string;
    completed: string;
    noneYet: string;
    inProgress: (label: string, step: number) => string;
    mistakes: string;
    mistakeItem: (m: RecentMistake) => string;
    closing: (topic: string) => string;
}

const LEARNING_LABELS_EN: LearningLabels = {
    header:
        "LEARNING CONTEXT — use it, and do not re-teach what the learner " +
        "already knows:",
    topic: "Topic: ",
    completed: "Completed lessons: ",
    noneYet: "none yet",
    inProgress: (label, step) => `Currently working on: ${label}, step ${step}`,
    mistakes: "Recent mistakes to focus on: ",
    mistakeItem: (m) =>
        `${m.element} (answered "${m.answered}", correct "${m.expected}", ${m.count}x)`,
    closing: (topic) =>
        `You are a tutor for "${topic}". Build on the progress above, focus ` +
        "on the learner's weaknesses and the next steps, and do NOT repeat " +
        "what they have already mastered.",
};

const LEARNING_LABELS_DE: LearningLabels = {
    header:
        "LERNKONTEXT — nutze ihn und wiederhole NICHT, was der Lerner schon " +
        "kann:",
    topic: "Thema: ",
    completed: "Abgeschlossene Lektionen: ",
    noneYet: "noch keine",
    inProgress: (label, step) =>
        `Aktuell in Bearbeitung: ${label}, Schritt ${step}`,
    mistakes: "Aktuelle Fehler zum Fokussieren: ",
    mistakeItem: (m) =>
        `${m.element} (geantwortet "${m.answered}", richtig "${m.expected}", ${m.count}x)`,
    closing: (topic) =>
        `Du bist ein Tutor fuer "${topic}". Knuepfe an den bisherigen ` +
        "Fortschritt an, fokussiere auf die Schwaechen und die naechsten " +
        "Schritte und wiederhole NICHT, was der Lerner schon beherrscht.",
};

function formatCompleted(lessons: CompletedLesson[]): string {
    return lessons
        .map((lesson) => `${lesson.label} (${lesson.correct}/${lesson.total})`)
        .join("; ");
}

/**
 * Render lesson progress + recent mistakes into a system-prompt addendum.
 * Returns "" when the learner has no lesson activity at all (no completed
 * lesson, nothing in progress, no recorded mistakes), so callers can append
 * unconditionally. Lists are capped to the most recent
 * {@link MAX_COMPLETED_LESSONS} / {@link MAX_RECENT_ERRORS} entries to keep
 * the block within the token budget.
 *
 * @param context - Structured progress data, or null.
 * @param lang - "de…" -> German, else English.
 * @returns The prompt addendum, or "" when there's nothing to add.
 */
export function buildLearningContext(
    context: LearningContext | null,
    lang: string,
): string {
    if (!context) return "";
    const completed = context.completed.slice(0, MAX_COMPLETED_LESSONS);
    const mistakes = context.mistakes.slice(0, MAX_RECENT_ERRORS);
    if (completed.length === 0 && context.inProgress === null && mistakes.length === 0) {
        return "";
    }
    const labels = langKey(lang) === "de" ? LEARNING_LABELS_DE : LEARNING_LABELS_EN;
    const lines = [labels.header, `${labels.topic}${context.topic}`];
    lines.push(
        `${labels.completed}${completed.length ? formatCompleted(completed) : labels.noneYet}`,
    );
    if (context.inProgress !== null) {
        lines.push(labels.inProgress(context.inProgress.label, context.inProgress.step));
    }
    if (mistakes.length) {
        lines.push(`${labels.mistakes}${mistakes.map(labels.mistakeItem).join("; ")}`);
    }
    lines.push(labels.closing(context.topic));
    return lines.join("\n");
}
