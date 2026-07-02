/**
 * Auto-advance preference (#1330).
 *
 * When ON, a fully-correct lesson answer advances to the next step
 * automatically after a brief success moment — no manual "Weiter" click.
 * Presentation/flow-only: it never changes grading, SRS recording, XP, or
 * progress; it only replaces the manual Continue click that already runs
 * AFTER those are recorded. A WRONG answer never auto-advances (the learner
 * keeps the feedback/solution in view).
 *
 * Default OFF — opt-in, so the existing manual flow is unchanged for
 * everyone until they enable it.
 *
 * Storage: ``localStorage`` under
 * ``adaptive-learner.lesson.auto_advance_enabled`` so it works identically
 * in both storage modes (API + Dexie) without a backend round-trip,
 * mirroring the other lesson preferences (Enter-key shortcut, feedback
 * intensity, swipe gestures).
 *
 * Updates: a custom ``adaptive-learner:lesson-auto-advance-changed`` event
 * fires whenever the Settings toggle flips, so subscribed components
 * re-render in lockstep (the native ``storage`` event only fires in OTHER
 * tabs).
 */

import {useEffect, useState} from "react";

const STORAGE_KEY = "adaptive-learner.lesson.auto_advance_enabled";
const EVENT_NAME = "adaptive-learner:lesson-auto-advance-changed";

/** Opt-in: OFF unless the user turns it on. */
export const DEFAULT_LESSON_AUTO_ADVANCE_ENABLED = false;

/** The success moment shown before an auto-advance fires. Deliberately
 *  under a second and NOT user-configurable (no over-configuration) — long
 *  enough to register the green "Correct!" badge, short enough to keep the
 *  flow brisk. */
export const AUTO_ADVANCE_DELAY_MS = 650;

/** Read whether auto-advance is enabled. Falls back to
 *  {@link DEFAULT_LESSON_AUTO_ADVANCE_ENABLED} when unset or unreadable. */
export function readLessonAutoAdvanceEnabled(): boolean {
    if (typeof localStorage === "undefined") {
        return DEFAULT_LESSON_AUTO_ADVANCE_ENABLED;
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_LESSON_AUTO_ADVANCE_ENABLED;
}

/**
 * Hook returning the current "auto-advance enabled" value. Re-renders the
 * consumer when the preference changes via the Settings toggle (same tab)
 * or another tab (storage event).
 */
export function useLessonAutoAdvance(): boolean {
    const [enabled, setEnabled] = useState<boolean>(() =>
        readLessonAutoAdvanceEnabled(),
    );

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            typeof window.addEventListener !== "function"
        ) {
            return;
        }
        const handler = () => setEnabled(readLessonAutoAdvanceEnabled());
        window.addEventListener(EVENT_NAME, handler);
        const storageHandler = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setEnabled(readLessonAutoAdvanceEnabled());
        };
        window.addEventListener("storage", storageHandler);
        return () => {
            window.removeEventListener(EVENT_NAME, handler);
            window.removeEventListener("storage", storageHandler);
        };
    }, []);

    return enabled;
}

/**
 * Imperative setter for the Settings toggle. Persists the preference and
 * dispatches the change event so subscribers re-render immediately (no
 * reload). Storage / dispatch failures are swallowed (best effort).
 */
export function setLessonAutoAdvanceEnabled(value: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
        /* localStorage unavailable — best effort */
    }
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {value}}));
        }
    } catch {
        /* no-op */
    }
}
