/**
 * Matching "Auflösen" (solve) effect preference (#824).
 *
 * Persists the learner's chosen pair-resolution animation for the
 * Matching exercise in localStorage. Presentation-only — it never
 * changes scoring or the SRS layer, just how the correct pairs are
 * revealed after the learner clicks "Auflösen".
 *
 *   - "slide" (default): the right column reorders so each item sits
 *     next to its correct partner; staggered slide-in.
 *   - "color": correct pairs share a background colour; fade-in.
 *   - "connect": animated SVG lines draw between the correct pairs.
 *   - "stack": both columns dissolve into stacked paired rows.
 */

export type MatchingResolveEffect = "slide" | "color" | "connect" | "stack";

const KEY = "adaptive-learner.matching.resolve_effect";

const VALID: readonly MatchingResolveEffect[] = [
    "slide",
    "color",
    "connect",
    "stack",
];

export const DEFAULT_RESOLVE_EFFECT: MatchingResolveEffect = "slide";

export const MATCHING_RESOLVE_EFFECT_OPTIONS: readonly MatchingResolveEffect[] =
    VALID;

/** Dispatched on the window when the preference changes in THIS tab
 *  (the native ``storage`` event only fires in other tabs). */
export const MATCHING_RESOLVE_PREF_CHANGE_EVENT =
    "adaptive-learner:matching-resolve-pref";

/** The configured resolve effect, falling back to the default for an
 *  unset / unrecognised value. */
export function readMatchingResolveEffect(): MatchingResolveEffect {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw && (VALID as string[]).includes(raw)) {
            return raw as MatchingResolveEffect;
        }
    } catch {
        /* no-op: storage unavailable */
    }
    return DEFAULT_RESOLVE_EFFECT;
}

export function writeMatchingResolveEffect(effect: MatchingResolveEffect): void {
    try {
        localStorage.setItem(KEY, effect);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(MATCHING_RESOLVE_PREF_CHANGE_EVENT));
        }
    } catch {
        /* no-op: storage unavailable */
    }
}
