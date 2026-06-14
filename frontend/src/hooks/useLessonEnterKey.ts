/**
 * Lesson Enter-key shortcut (#103, shared by #154).
 *
 * Installs a window keydown listener that turns Enter into the
 * lesson's primary action: check an answered exercise (via
 * ``exerciseRef.current.submit()``), then advance. The pure decision
 * (`decideLessonEnterAction`) is shared with the Settings toggle, so
 * this hook only owns the DOM wiring. Used by the main lesson runner
 * (`Lesson.tsx`) AND the Error-Replay runner (`ErrorReplayLesson.tsx`)
 * so Enter behaves identically in both.
 *
 * It steps aside for controls that own Enter (button / link /
 * textarea / select / contenteditable / role=button) and for
 * modifier or IME composition keystrokes. ``enterLockRef`` blocks a
 * double Check between ``submit()`` and the ``checked`` flip; the
 * caller resets it on each step change.
 */

import {useEffect, type RefObject} from "react";

import type {ExerciseHandle} from "../components/exercises/exercise-control";
import {
    decideLessonEnterAction,
    type LessonEnterState,
} from "../lib/lesson/lessonShortcutsPref";

/** The decision state plus the advance callback the listener needs. */
export type LessonEnterNav = LessonEnterState & {goNext: () => void};

/** True for a bare Enter keypress that the lesson shortcut should act
 *  on: the Enter key, with no modifier, not an IME composition, and not
 *  already handled (``defaultPrevented``) by another listener. */
function isPlainEnter(e: KeyboardEvent): boolean {
    return (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.isComposing &&
        !e.defaultPrevented
    );
}

/** True when the focused element already owns Enter (a button, link,
 *  textarea, select, contenteditable, or ``role=button``), so the
 *  lesson shortcut must step aside. */
function focusOwnsEnter(el: HTMLElement | null): boolean {
    const tag = el?.tagName;
    return (
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable === true ||
        el?.getAttribute("role") === "button"
    );
}

export interface UseLessonEnterKeyOptions {
    /** Gated by the Settings > Learning "Enter shortcut" toggle. */
    enabled: boolean;
    /** The active exercise; ``submit()`` grades the current answer. */
    exerciseRef: RefObject<ExerciseHandle | null>;
    /** Current decision state, refreshed by the caller every render. */
    enterStateRef: RefObject<LessonEnterNav | null>;
    /** Double-Check guard, reset by the caller on each step change. */
    enterLockRef: RefObject<boolean>;
}

export function useLessonEnterKey({
    enabled,
    exerciseRef,
    enterStateRef,
    enterLockRef,
}: UseLessonEnterKeyOptions): void {
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            if (!isPlainEnter(e)) return;
            if (focusOwnsEnter(document.activeElement as HTMLElement | null)) {
                return;
            }
            const nav = enterStateRef.current;
            if (!nav) return;
            const action = decideLessonEnterAction(nav);
            if (action === "none") return;
            e.preventDefault();
            if (action === "check") {
                if (enterLockRef.current) return;
                enterLockRef.current = true;
                exerciseRef.current?.submit();
            } else {
                nav.goNext();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // The refs are stable; only the enabled flag re-subscribes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);
}
