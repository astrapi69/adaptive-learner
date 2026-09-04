/**
 * Game-mode arcade preference (#2887).
 *
 * The arcade (dashboard card + mini-games) DEFAULTS ON while the game
 * mode is active - the switch exists so the arcade can be hidden
 * entirely. Three clamped number settings ride along: the snake
 * round length (30-120s, default 60), the memory pair count (4-12,
 * default 8) and the simon target length (5-15, default 8, #2907).
 *
 * Same localStorage pattern as the sibling prefs in this folder.
 */

import {readPlayfulMode} from "./playfulModePref";

const ARCADE_KEY = "adaptive-learner.lesson.playful_arcade";
const SNAKE_SECONDS_KEY = "adaptive-learner.lesson.playful_arcade_snake_seconds";
const MEMORY_PAIRS_KEY = "adaptive-learner.lesson.playful_arcade_memory_pairs";
const SIMON_TARGET_KEY = "adaptive-learner.lesson.playful_arcade_simon_target";

/** Dispatched on the window when any arcade value changes in this tab. */
export const PLAYFUL_ARCADE_CHANGE_EVENT =
    "adaptive-learner:playful-arcade-pref";

export const DEFAULT_SNAKE_SECONDS = 60;
export const MIN_SNAKE_SECONDS = 30;
export const MAX_SNAKE_SECONDS = 120;

export const DEFAULT_MEMORY_PAIRS = 8;
export const MIN_MEMORY_PAIRS = 4;
export const MAX_MEMORY_PAIRS = 12;

export const DEFAULT_SIMON_TARGET = 8;
export const MIN_SIMON_TARGET = 5;
export const MAX_SIMON_TARGET = 15;

function _notify(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_ARCADE_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

function _readClamped(
    key: string,
    fallback: number,
    clamp: (raw: number) => number,
): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return clamp(Number(raw));
    } catch {
        return fallback;
    }
}

function _writeClamped(
    key: string,
    value: number,
    clamp: (raw: number) => number,
): void {
    try {
        localStorage.setItem(key, String(clamp(value)));
    } catch {
        /* no-op */
    }
    _notify();
}

/** Whether the arcade is on - DEFAULT ON (only "false" disables). */
export function readPlayfulArcade(): boolean {
    try {
        return localStorage.getItem(ARCADE_KEY) !== "false";
    } catch {
        return true;
    }
}

/** Persist the arcade switch + dispatch the change event. */
export function setPlayfulArcade(on: boolean): void {
    try {
        localStorage.setItem(ARCADE_KEY, on ? "true" : "false");
    } catch {
        /* no-op */
    }
    _notify();
}

/** Clamp a snake round length into [30, 120]; non-numbers fall back to 60. */
export function clampSnakeSeconds(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_SNAKE_SECONDS;
    return Math.min(
        MAX_SNAKE_SECONDS,
        Math.max(MIN_SNAKE_SECONDS, Math.round(raw)),
    );
}

/** The configured snake round length in seconds (clamped). */
export function readSnakeSeconds(): number {
    return _readClamped(
        SNAKE_SECONDS_KEY,
        DEFAULT_SNAKE_SECONDS,
        clampSnakeSeconds,
    );
}

/** Persist the snake round length (clamped) + dispatch the change event. */
export function setSnakeSeconds(seconds: number): void {
    _writeClamped(SNAKE_SECONDS_KEY, seconds, clampSnakeSeconds);
}

/** Clamp a memory pair count into [4, 12]; non-numbers fall back to 8. */
export function clampMemoryPairs(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_MEMORY_PAIRS;
    return Math.min(
        MAX_MEMORY_PAIRS,
        Math.max(MIN_MEMORY_PAIRS, Math.round(raw)),
    );
}

/** The configured memory pair count (clamped). */
export function readMemoryPairs(): number {
    return _readClamped(
        MEMORY_PAIRS_KEY,
        DEFAULT_MEMORY_PAIRS,
        clampMemoryPairs,
    );
}

/** Persist the memory pair count (clamped) + dispatch the change event. */
export function setMemoryPairs(pairs: number): void {
    _writeClamped(MEMORY_PAIRS_KEY, pairs, clampMemoryPairs);
}

/** Clamp a simon target length into [5, 15]; non-numbers fall back to 8. */
export function clampSimonTarget(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_SIMON_TARGET;
    return Math.min(
        MAX_SIMON_TARGET,
        Math.max(MIN_SIMON_TARGET, Math.round(raw)),
    );
}

/** The configured simon target length (clamped). */
export function readSimonTarget(): number {
    return _readClamped(
        SIMON_TARGET_KEY,
        DEFAULT_SIMON_TARGET,
        clampSimonTarget,
    );
}

/** Persist the simon target length (clamped) + dispatch the change event. */
export function setSimonTarget(target: number): void {
    _writeClamped(SIMON_TARGET_KEY, target, clampSimonTarget);
}

/** The arcade gate: game mode on AND the switch not disabled. */
export function playfulArcadeActive(): boolean {
    return readPlayfulMode() && readPlayfulArcade();
}
