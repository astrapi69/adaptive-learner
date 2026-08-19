/**
 * Ask-AI button visibility preference (#2693).
 *
 * Persists whether the "Ask AI" button (``AskAiPanel``, #1321/#1443) is
 * shown under theory and exercise blocks in a lesson. Presentation-only:
 * it never changes AI availability itself, only whether the entry point
 * is rendered. Default ON (shown) per the project's feature-visibility
 * policy - the button already self-gates on the API-key state, so
 * hiding it entirely would be an additional, separate opt-out layer.
 *
 * Stored in localStorage so it works identically in both storage modes
 * (API + Dexie) without a backend round-trip, mirroring the other
 * lesson preferences (lesson shortcuts, swipe gestures).
 */

const KEY_VISIBLE = "adaptive-learner.lesson.ask_ai_visible";

export const DEFAULT_ASK_AI_VISIBLE = true;

/** Window event so hooks re-read live within the same tab (the
 *  native ``storage`` event only fires in OTHER tabs). */
export const ASK_AI_VISIBILITY_CHANGE_EVENT =
    "adaptive-learner:ask-ai-visibility-pref";

/** Read whether the "Ask AI" button is shown in lessons. Falls back to
 *  {@link DEFAULT_ASK_AI_VISIBLE} when unset or unreadable. */
export function readAskAiVisible(): boolean {
    try {
        const raw = localStorage.getItem(KEY_VISIBLE);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_ASK_AI_VISIBLE;
}

/** Persist the "Ask AI" visibility preference and dispatch
 *  {@link ASK_AI_VISIBILITY_CHANGE_EVENT} so hooks re-read live in the
 *  same tab. Storage / dispatch failures are swallowed. */
export function setAskAiVisible(visible: boolean): void {
    try {
        localStorage.setItem(KEY_VISIBLE, visible ? "true" : "false");
    } catch {
        /* no-op */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(ASK_AI_VISIBILITY_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}
