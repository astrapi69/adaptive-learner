/**
 * 42-cell system-prompt matrix ported from the backend session
 * plugin's ``prompts.py``. Cells are loaded from
 * ``data/session-prompts.json`` (the backend's _PROMPTS dict
 * exported verbatim) so Dexie mode produces the same prompt text
 * the API mode would.
 */

import PROMPTS_RAW from "../data/session-prompts.json";
import {LEARNING_METHODS, type LearningMethod} from "../lib/constants";
import type {LearningProfile, LearningProject} from "../types/domain";

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
