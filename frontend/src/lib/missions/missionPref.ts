/**
 * Mission preferences (EXP-010 / Phase 56).
 *
 * Presentation-only, localStorage-backed: whether daily missions
 * are shown, how many per day (1-3), and the difficulty mix. They
 * do NOT change any algorithm beyond which/how-many missions the
 * generator is asked for. The Settings UI (56I) edits these; the
 * dashboard widget (56F) reads them.
 */

import type {DifficultyMix} from "./types";

const KEY_ENABLED = "adaptive-learner.missions.enabled";
const KEY_COUNT = "adaptive-learner.missions.count";
const KEY_MIX = "adaptive-learner.missions.difficulty_mix";

export const MISSION_PREF_CHANGE_EVENT = "adaptive-learner:mission-pref";

const VALID_MIX: readonly DifficultyMix[] = ["balanced", "easy", "challenging"];

export interface MissionPrefs {
    enabled: boolean;
    count: number;
    difficultyMix: DifficultyMix;
}

export const DEFAULT_MISSION_PREFS: MissionPrefs = {
    enabled: true,
    count: 3,
    difficultyMix: "balanced",
};

function notifyChange(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(MISSION_PREF_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

export function readMissionPrefs(): MissionPrefs {
    let enabled = DEFAULT_MISSION_PREFS.enabled;
    let count = DEFAULT_MISSION_PREFS.count;
    let difficultyMix = DEFAULT_MISSION_PREFS.difficultyMix;
    try {
        const rawEnabled = localStorage.getItem(KEY_ENABLED);
        if (rawEnabled === "false") enabled = false;
        if (rawEnabled === "true") enabled = true;
        const rawCount = Number.parseInt(localStorage.getItem(KEY_COUNT) ?? "", 10);
        if (rawCount >= 1 && rawCount <= 3) count = rawCount;
        const rawMix = localStorage.getItem(KEY_MIX);
        if (rawMix && (VALID_MIX as string[]).includes(rawMix)) {
            difficultyMix = rawMix as DifficultyMix;
        }
    } catch {
        /* no-op */
    }
    return {enabled, count, difficultyMix};
}

export function setMissionsEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
    notifyChange();
}

export function setMissionCount(count: number): void {
    try {
        const clamped = Math.max(1, Math.min(3, Math.round(count)));
        localStorage.setItem(KEY_COUNT, String(clamped));
    } catch {
        /* no-op */
    }
    notifyChange();
}

export function setMissionDifficultyMix(mix: DifficultyMix): void {
    try {
        localStorage.setItem(KEY_MIX, mix);
    } catch {
        /* no-op */
    }
    notifyChange();
}
