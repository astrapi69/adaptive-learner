/**
 * Local (Dexie-mode) tools + spaced-recommendation logic
 * (Phase 10E). Mirrors ``adaptive_learner_tools.catalogue`` and
 * ``adaptive_learner_tools.spaced_recommendations``.
 */

import {LEARNING_METHODS, type LearningMethod} from "../../lib/constants";
import type {SpacedRecommendation, ToolRecommendation} from "../../types/domain";

interface Tool {
    name: string;
    url: string;
    why_de: string;
    why_en: string;
    weight_keys: LearningMethod[];
}

const TOOLS: Tool[] = [
    {
        name: "Anki",
        url: "https://apps.ankiweb.net/",
        why_de:
            "Spaced-Repetition-Karteikarten - ideal um Regeln und Fehlerkorrekturen langfristig zu festigen.",
        why_en:
            "Spaced-repetition flashcards - great for cementing rules and error-corrections long-term.",
        weight_keys: ["deductive", "error_based"],
    },
    {
        name: "NotebookLM",
        url: "https://notebooklm.google.com/",
        why_de:
            "Aktiver Wissensaufbau aus eigenen Quellen - passend wenn Beispiele und Kontext deine Methode sind.",
        why_en:
            "Active knowledge-building from your own sources - fits when examples and context are your method.",
        weight_keys: ["inductive", "contextual"],
    },
    {
        name: "Adaptive AI Prompt",
        url: "https://claude.ai/",
        why_de:
            "Ein dialogischer KI-Assistent passt Tempo und Methode an deinen jeweiligen Stand an.",
        why_en:
            "A dialogic AI assistant adapts pace and method to where you currently are.",
        weight_keys: ["ai_adaptive", "dialogic"],
    },
    {
        name: "Excalidraw",
        url: "https://excalidraw.com/",
        why_de:
            "Visuelles Skizzieren - gut um Beispiele zu strukturieren oder Alltagssituationen zu modellieren.",
        why_en:
            "Visual sketching - good for structuring examples or modelling everyday situations.",
        weight_keys: ["contextual", "inductive"],
    },
    {
        name: "Obsidian",
        url: "https://obsidian.md/",
        why_de:
            "Wissensgraph aus verlinkten Notizen - Theorie und Beispiele wandern in dieselbe Struktur.",
        why_en:
            "Linked-notes knowledge graph - theory and examples land in the same structure.",
        weight_keys: ["deductive", "inductive"],
    },
];

const TOOLS_DEFAULT_LIMIT = 5;

function langKey(lang: string): "de" | "en" {
    return lang.startsWith("de") ? "de" : "en";
}

function score(tool: Tool, profile: Partial<Record<LearningMethod, number>>): number {
    let total = 0;
    for (const k of tool.weight_keys) {
        const v = profile[k];
        if (typeof v === "number") total += v;
    }
    return total;
}

/**
 * Rank the tool catalogue by relevance to the profile weights.
 * Empty profile keeps the authored order; tied scores fall back
 * to the catalogue order via stable sort.
 */
export function rankTools(
    profile: Partial<Record<LearningMethod, number>>,
    lang: string,
    limit: number = TOOLS_DEFAULT_LIMIT,
): ToolRecommendation[] {
    const key = langKey(lang);
    const scored = TOOLS.map((tool, idx) => ({
        score: score(tool, profile),
        idx,
        tool,
    }));
    // Stable sort: higher score first; preserve original order on tie.
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.idx - b.idx;
    });
    return scored.slice(0, limit).map(({score: s, tool}) => ({
        name: tool.name,
        url: tool.url,
        why: tool[`why_${key}`],
        weight_keys: [...tool.weight_keys],
        score: Math.round(s * 10000) / 10000,
    }));
}

// ---- Spaced recommendations ------------------------------------------

const WEIGHT_FLOOR = 0;
const SPACED_DEFAULT_LIMIT = 5;

const BANDS: Array<{loInclusive: number; interval: number; kind: string}> = [
    {loInclusive: Infinity, interval: 1, kind: "first"},
    {loInclusive: 14, interval: 1, kind: "refresh"},
    {loInclusive: 7, interval: 3, kind: "review"},
    {loInclusive: 3, interval: 7, kind: "practice"},
    {loInclusive: 0, interval: 14, kind: "maintain"},
];

function bandForRecency(days: number | null): {interval: number; kind: string} {
    if (days === null) {
        return {interval: BANDS[0].interval, kind: BANDS[0].kind};
    }
    for (let i = 1; i < BANDS.length; i++) {
        if (days >= BANDS[i].loInclusive) {
            return {interval: BANDS[i].interval, kind: BANDS[i].kind};
        }
    }
    const last = BANDS[BANDS.length - 1];
    return {interval: last.interval, kind: last.kind};
}

const TITLE_TEMPLATES: Record<string, {de: string; en: string}> = {
    first: {
        de: "Erste Uebung in {method_de}.",
        en: "First practice in {method_en}.",
    },
    refresh: {
        de: "Auffrischung in {method_de} - laenger als zwei Wochen her.",
        en: "Refresh {method_en} - over two weeks since the last session.",
    },
    review: {
        de: "Wiederholung {method_de}.",
        en: "Review {method_en}.",
    },
    practice: {
        de: "Uebung in {method_de}.",
        en: "Practice {method_en}.",
    },
    maintain: {
        de: "Pflege deine {method_de}-Routine.",
        en: "Maintain your {method_en} routine.",
    },
};

const METHOD_LABELS: Record<LearningMethod, {de: string; en: string}> = {
    deductive: {de: "Deduktion", en: "deduction"},
    inductive: {de: "Induktion", en: "induction"},
    error_based: {de: "Fehlerlernen", en: "error-based learning"},
    dialogic: {de: "Dialog", en: "dialogue"},
    contextual: {de: "Kontextlernen", en: "contextual learning"},
    ai_adaptive: {de: "KI-adaptivem Lernen", en: "AI-adaptive learning"},
};

/**
 * Build spaced-repetition cards from a profile + per-method
 * recency map. ``recency[method] === null`` means "never
 * practised". Methods with zero weight are skipped.
 */
export function buildSpacedRecommendations(
    profile: Partial<Record<LearningMethod, number>>,
    recency: Partial<Record<LearningMethod, number | null>>,
    lang: string,
    limit: number = SPACED_DEFAULT_LIMIT,
): SpacedRecommendation[] {
    const key = langKey(lang);
    const cards: SpacedRecommendation[] = [];
    for (const method of LEARNING_METHODS) {
        const weight = profile[method] ?? 0;
        if (weight <= WEIGHT_FLOOR) continue;
        const days = recency[method] ?? null;
        const {interval, kind} = bandForRecency(days);
        const labels = METHOD_LABELS[method];
        const template = TITLE_TEMPLATES[kind];
        const titleRaw = template[key]
            .replace("{method_de}", labels.de)
            .replace("{method_en}", labels.en);
        const urgency = Math.round((interval - weight) * 10000) / 10000;
        cards.push({
            id: `sr-${method}-${kind}`,
            method,
            interval_days: interval,
            action: "session",
            title: titleRaw,
            urgency,
        });
    }
    cards.sort((a, b) => a.urgency - b.urgency);
    return cards.slice(0, limit);
}

/**
 * Compute days-since-last-commit per method from a chronological
 * commit list. Returns ``null`` for methods that haven't been
 * touched yet.
 */
export function recencyFromCommits(
    commits: Array<{method: string; committed_at: string}>,
    today?: string,
): Record<LearningMethod, number | null> {
    const todayDate = today
        ? new Date(today + "T00:00:00.000Z")
        : new Date();
    const out = {} as Record<LearningMethod, number | null>;
    for (const m of LEARNING_METHODS) out[m] = null;
    // Walk newest-first so the first hit per method is the most recent.
    for (let i = commits.length - 1; i >= 0; i--) {
        const c = commits[i];
        if (!LEARNING_METHODS.includes(c.method as LearningMethod)) continue;
        const m = c.method as LearningMethod;
        if (out[m] !== null) continue;
        const committed = new Date(c.committed_at);
        const diffMs = todayDate.getTime() - committed.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        out[m] = Math.max(0, diffDays);
    }
    return out;
}
