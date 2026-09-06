/**
 * Game-mode tension preferences (#2878).
 *
 * Two independent opt-ins inside the game mode, BOTH default OFF:
 *
 * - **Hearts**: N lives per lesson run (default 3, clamped 1-5). A
 *   wrong answer costs one; at zero the run ends with a friendly
 *   "try again" dialog - no data loss, recorded results stay.
 * - **Countdown**: a visual ring per exercise (default 30 s, clamped
 *   5-120). Expiry counts as a failed try for the tension layer
 *   (streak breaks, a heart is lost) but never auto-submits and
 *   never touches scoring or SRS. Distinct from the TIMED lesson
 *   mode, which is its own mode with auto-advance - the ring is a
 *   game-mode garnish and stays off in timed and exam lessons.
 *
 * Same localStorage pattern as {@link ./playfulSoundsPref}.
 */

const HEARTS_KEY = "adaptive-learner.lesson.playful_hearts";
const HEARTS_COUNT_KEY = "adaptive-learner.lesson.playful_hearts_count";
const COUNTDOWN_KEY = "adaptive-learner.lesson.playful_countdown";
const COUNTDOWN_SECONDS_KEY =
    "adaptive-learner.lesson.playful_countdown_seconds";

/** Dispatched on the window when any tension preference changes. */
export const PLAYFUL_TENSION_CHANGE_EVENT =
    "adaptive-learner:playful-tension-pref";

export const DEFAULT_HEARTS_COUNT = 3;
export const MIN_HEARTS_COUNT = 1;
export const MAX_HEARTS_COUNT = 5;

export const DEFAULT_COUNTDOWN_SECONDS = 30;
export const MIN_COUNTDOWN_SECONDS = 5;
export const MAX_COUNTDOWN_SECONDS = 120;

function _readFlag(key: string): boolean {
    try {
        return localStorage.getItem(key) === "true";
    } catch {
        return false;
    }
}

function _writeAndNotify(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* no-op: storage unavailable */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(PLAYFUL_TENSION_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

function _readNumber(key: string, clamp: (raw: number) => number): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return clamp(Number.NaN);
        return clamp(Number(raw));
    } catch {
        return clamp(Number.NaN);
    }
}

/** Clamp a hearts count into [1, 5]; non-numbers fall back to 3. */
export function clampHeartsCount(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_HEARTS_COUNT;
    return Math.min(MAX_HEARTS_COUNT, Math.max(MIN_HEARTS_COUNT, Math.round(raw)));
}

/** Clamp countdown seconds into [5, 120]; non-numbers fall back to 30. */
export function clampCountdownSeconds(raw: number): number {
    if (!Number.isFinite(raw)) return DEFAULT_COUNTDOWN_SECONDS;
    return Math.min(
        MAX_COUNTDOWN_SECONDS,
        Math.max(MIN_COUNTDOWN_SECONDS, Math.round(raw)),
    );
}

/** Whether the hearts system is on, falling back to OFF. */
export function readPlayfulHearts(): boolean {
    return _readFlag(HEARTS_KEY);
}

/** Persist the hearts switch + dispatch the change event. */
export function setPlayfulHearts(on: boolean): void {
    _writeAndNotify(HEARTS_KEY, on ? "true" : "false");
}

/** The configured hearts per lesson run (clamped). */
export function readPlayfulHeartsCount(): number {
    return _readNumber(HEARTS_COUNT_KEY, clampHeartsCount);
}

/** Persist the hearts count (clamped) + dispatch the change event. */
export function setPlayfulHeartsCount(count: number): void {
    _writeAndNotify(HEARTS_COUNT_KEY, String(clampHeartsCount(count)));
}

/** Whether the per-exercise countdown is on, falling back to OFF. */
export function readPlayfulCountdown(): boolean {
    return _readFlag(COUNTDOWN_KEY);
}

/** Persist the countdown switch + dispatch the change event. */
export function setPlayfulCountdown(on: boolean): void {
    _writeAndNotify(COUNTDOWN_KEY, on ? "true" : "false");
}

/** The configured seconds per exercise (clamped). */
export function readPlayfulCountdownSeconds(): number {
    return _readNumber(COUNTDOWN_SECONDS_KEY, clampCountdownSeconds);
}

/** Persist the countdown seconds (clamped) + dispatch the change event. */
export function setPlayfulCountdownSeconds(seconds: number): void {
    _writeAndNotify(
        COUNTDOWN_SECONDS_KEY,
        String(clampCountdownSeconds(seconds)),
    );
}
