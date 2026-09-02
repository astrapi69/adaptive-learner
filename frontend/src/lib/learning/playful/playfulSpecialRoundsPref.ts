/**
 * Game-mode special-rounds preference (#2888).
 *
 * The special rounds (per-set flash rounds unlocked by finishing the
 * set) DEFAULT ON while the game mode is active - the switch exists
 * so they can be hidden entirely. The flash-round card count rides
 * along (5-20, default 10).
 *
 * Same localStorage pattern as the sibling prefs in this folder.
 */

import {readPlayfulMode} from "./playfulModePref";

const SPECIAL_ROUNDS_KEY = "adaptive-learner.lesson.playful_special_rounds";
const FLASH_CARDS_KEY =
    "adaptive-learner.lesson.playful_flash_round_cards";

/** Dispatched on the window when either value changes in this tab. */
export const PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT =
    "adaptive-learner:playful-special-rounds-pref";

export const DEFAULT_FLASH_ROUND_CARDS = 10;
export const MIN_FLASH_ROUND_CARDS = 5;
export const MAX_FLASH_ROUND_CARDS = 20;

function _notify(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new Event(PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT),
            );
        }
    } catch {
        /* no-op */
    }
}

/** Whether special rounds are on - DEFAULT ON (only "false" disables). */
export function readPlayfulSpecialRounds(): boolean {
    try {
        return localStorage.getItem(SPECIAL_ROUNDS_KEY) !== "false";
    } catch {
        return true;
    }
}

/** Persist the special-rounds switch + dispatch the change event. */
export function setPlayfulSpecialRounds(on: boolean): void {
    try {
        localStorage.setItem(SPECIAL_ROUNDS_KEY, on ? "true" : "false");
    } catch {
        /* no-op */
    }
    _notify();
}

/** Clamp a flash-round card count into [5, 20]; non-numbers fall back to 10. */
export function clampFlashRoundCards(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_FLASH_ROUND_CARDS;
    return Math.min(
        MAX_FLASH_ROUND_CARDS,
        Math.max(MIN_FLASH_ROUND_CARDS, Math.round(raw)),
    );
}

/** The configured flash-round card count (clamped). */
export function readFlashRoundCards(): number {
    try {
        const raw = localStorage.getItem(FLASH_CARDS_KEY);
        if (raw === null) return DEFAULT_FLASH_ROUND_CARDS;
        return clampFlashRoundCards(Number(raw));
    } catch {
        return DEFAULT_FLASH_ROUND_CARDS;
    }
}

/** Persist the flash-round card count (clamped) + dispatch the change event. */
export function setFlashRoundCards(cards: number): void {
    try {
        localStorage.setItem(
            FLASH_CARDS_KEY,
            String(clampFlashRoundCards(cards)),
        );
    } catch {
        /* no-op */
    }
    _notify();
}

/** The special-rounds gate: game mode on AND the switch not disabled. */
export function playfulSpecialRoundsActive(): boolean {
    return readPlayfulMode() && readPlayfulSpecialRounds();
}
