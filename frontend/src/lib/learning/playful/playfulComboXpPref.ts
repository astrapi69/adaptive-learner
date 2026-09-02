/**
 * Game-mode combo-bonus-XP preference (#2893).
 *
 * The one decided exception to the game mode's presentation-only
 * rule: streak answers (from streak 3) earn small bonus XP, capped
 * per lesson run. Unlike the other playful opt-ins this DEFAULTS ON -
 * the feature itself was decided; the switch exists so the game mode
 * can be kept XP-neutral. The cap is user-configurable (5-20, default
 * 10); the XP formula additionally enforces the hard ceiling 20 on
 * both storage backends.
 *
 * Same localStorage pattern as the sibling prefs in this folder.
 */

import {readPlayfulMode} from "./playfulModePref";

const COMBO_XP_KEY = "adaptive-learner.lesson.playful_combo_xp";
const COMBO_XP_CAP_KEY = "adaptive-learner.lesson.playful_combo_xp_cap";

/** Dispatched on the window when either value changes in this tab. */
export const PLAYFUL_COMBO_XP_CHANGE_EVENT =
    "adaptive-learner:playful-combo-xp-pref";

export const DEFAULT_COMBO_XP_CAP = 10;
export const MIN_COMBO_XP_CAP = 5;
export const MAX_COMBO_XP_CAP = 20;

function _notify(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_COMBO_XP_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Clamp a cap into [5, 20]; non-numbers fall back to 10. */
export function clampComboXpCap(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_COMBO_XP_CAP;
    return Math.min(MAX_COMBO_XP_CAP, Math.max(MIN_COMBO_XP_CAP, Math.round(raw)));
}

/** Whether combo bonus XP are on - DEFAULT ON (only "false" disables). */
export function readPlayfulComboXp(): boolean {
    try {
        return localStorage.getItem(COMBO_XP_KEY) !== "false";
    } catch {
        return true;
    }
}

/** Persist the combo-XP switch + dispatch the change event. */
export function setPlayfulComboXp(on: boolean): void {
    try {
        localStorage.setItem(COMBO_XP_KEY, on ? "true" : "false");
    } catch {
        /* no-op */
    }
    _notify();
}

/** The configured per-run bonus cap (clamped). */
export function readComboXpCap(): number {
    try {
        const raw = localStorage.getItem(COMBO_XP_CAP_KEY);
        if (raw === null) return DEFAULT_COMBO_XP_CAP;
        return clampComboXpCap(Number(raw));
    } catch {
        return DEFAULT_COMBO_XP_CAP;
    }
}

/** Persist the cap (clamped) + dispatch the change event. */
export function setComboXpCap(cap: number): void {
    try {
        localStorage.setItem(COMBO_XP_CAP_KEY, String(clampComboXpCap(cap)));
    } catch {
        /* no-op */
    }
    _notify();
}

/** The combo-XP gate: game mode on AND the switch not disabled. */
export function playfulComboXpActive(): boolean {
    return readPlayfulMode() && readPlayfulComboXp();
}

/** The bonus to credit for a run: the eligible streak answers,
 *  capped by the configured limit; 0 while the gate is off. */
export function comboBonusForRun(bonusEligible: number): number {
    if (!playfulComboXpActive()) return 0;
    return Math.max(0, Math.min(readComboXpCap(), bonusEligible));
}
