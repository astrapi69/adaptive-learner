/**
 * Game-mode bonus-lessons preference (#2890).
 *
 * Bonus lessons (the ``bonus-`` filename convention,
 * ``lib/content/browse/bonus-lessons``) DEFAULT ON while the game
 * mode is active: the set page then shows them visible-but-locked
 * until every regular lesson has at least one star. With the game
 * mode (or this switch) off, a bonus lesson behaves like any other
 * lesson - the gate is game-mode dramaturgy, never a content wall.
 *
 * Same localStorage pattern as the sibling prefs in this folder.
 */

import {readPlayfulMode} from "./playfulModePref";

const BONUS_KEY = "adaptive-learner.lesson.playful_bonus_lessons";

/** Dispatched on the window when the switch changes in this tab. */
export const PLAYFUL_BONUS_CHANGE_EVENT =
    "adaptive-learner:playful-bonus-pref";

function _notify(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_BONUS_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Whether the bonus gate is on - DEFAULT ON (only "false" disables). */
export function readPlayfulBonus(): boolean {
    try {
        return localStorage.getItem(BONUS_KEY) !== "false";
    } catch {
        return true;
    }
}

/** Persist the bonus switch + dispatch the change event. */
export function setPlayfulBonus(on: boolean): void {
    try {
        localStorage.setItem(BONUS_KEY, on ? "true" : "false");
    } catch {
        /* no-op */
    }
    _notify();
}

/** The bonus gate: game mode on AND the switch not disabled. */
export function playfulBonusActive(): boolean {
    return readPlayfulMode() && readPlayfulBonus();
}
