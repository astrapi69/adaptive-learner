/**
 * Frontend-side enumerations and palette constants. Mirrors the
 * backend Pydantic enums in ``app.schemas`` and the project-
 * reference §3.1 / §3.2 / §11 tables. Single source of truth on
 * the frontend so charts, badges and theme rules all import the
 * same key list — drift is impossible.
 *
 * If the backend ever adds a seventh learning method (or a fresh
 * cycle step), the corresponding ``LearningMethod`` /
 * ``CycleStep`` enums in ``backend/app/schemas/__init__.py`` are
 * the authoritative source; reflect the new key here AND extend
 * the i18n catalogs and the colour palette below.
 */

// --- Learning methods ----------------------------------------------------

/**
 * The six method keys, in the canonical order used by every
 * chart (radar axes, bar chart, distribution). Match
 * ``backend/app/schemas.LearningMethod``.
 */
export const LEARNING_METHODS = [
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
] as const;

export type LearningMethod = (typeof LEARNING_METHODS)[number];

/**
 * Type guard for runtime narrowing of an unknown string into a
 * ``LearningMethod`` literal — useful when the API returns a
 * generic ``string`` (e.g. tracking summary's
 * ``sessions_per_method`` keys) and the consumer needs the
 * narrowed type.
 */
export function isLearningMethod(value: string): value is LearningMethod {
    return (LEARNING_METHODS as readonly string[]).includes(value);
}

/**
 * The canonical method-key → hex colour map. Pinned to the
 * project-reference §3.1 palette so every chart, badge and
 * dashboard tile reads the same hex.
 */
export const METHOD_COLORS: Record<LearningMethod, string> = {
    deductive: "#3B82F6", // Blue
    inductive: "#8B5CF6", // Violet
    error_based: "#EF4444", // Red
    dialogic: "#10B981", // Green
    contextual: "#F59E0B", // Amber
    ai_adaptive: "#6366F1", // Indigo
};

// --- 7-step learning cycle ---------------------------------------------

/**
 * The 7 step keys in canonical 1..7 order (project-reference
 * §3.2). The session plugin's ``cycle_step`` column stores the
 * 1-based numeric index; the frontend translates it into one of
 * these keys for rendering.
 */
export const CYCLE_STEPS = [
    "input",
    "attempt",
    "error",
    "feedback",
    "adapt",
    "repeat",
    "integrate",
] as const;

export type CycleStep = (typeof CYCLE_STEPS)[number];

/**
 * 1-based step index → step key. Use when translating the
 * session plugin's ``cycle_step`` integer into a render key.
 * Throws on out-of-range input rather than returning a
 * silently-wrong default — surfaces a backend regression
 * immediately.
 */
export function cycleStepForIndex(index: number): CycleStep {
    if (index < 1 || index > CYCLE_STEPS.length) {
        throw new Error(`cycleStepForIndex: out of range (${index})`);
    }
    return CYCLE_STEPS[index - 1];
}

// --- AI providers --------------------------------------------------------

/**
 * Provider keys for the Settings page's ``active_provider``
 * dropdown and the api-key endpoint's ``provider`` body field.
 * Match ``backend/app/schemas.AIProvider``.
 */
export const AI_PROVIDERS = ["anthropic", "openai", "gemini"] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];

// --- Session enums -------------------------------------------------------

export const SESSION_STATUSES = ["active", "completed", "abandoned"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

// --- Languages -----------------------------------------------------------

/**
 * Languages the backend i18n catalogs ship for the v0.1.0
 * release. Reference EN; DE shipped at parity. Adding a new
 * language requires both a ``backend/config/i18n/{code}.yaml``
 * file AND a row in this list.
 */
export const SUPPORTED_LANGUAGES = ["de", "en", "es", "fr", "el"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// --- Re-export the API_BASE for unit tests that exercise client ---------

/**
 * Resolved API base URL. Reads ``VITE_API_BASE`` at build time;
 * falls back to ``/api`` (the path proxied by Vite's dev server
 * to the backend on :18001, and the same-origin path in
 * production). Centralised here so any future direct-XHR caller
 * doesn't re-derive the URL.
 */
export const API_BASE: string =
    (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
