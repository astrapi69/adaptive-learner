/**
 * Shared contract for the Lesson-page two-phase button
 * (BUG P1 — Problem 1 + 2).
 *
 * Each exercise renderer keeps its original self-contained
 * behaviour by default (its own "Check" + "Try again"
 * buttons) so the Review + AdaptiveLesson pages stay
 * untouched. When the Lesson page opts in via
 * ``controlled``, the exercise instead:
 *
 *   - hides its internal Check / retry buttons,
 *   - reports whether the answer is checkable via
 *     ``onInteraction(answerable)`` so the parent can
 *     enable a single shared "Prüfen" button, and
 *   - exposes ``submit()`` through a ref so that one shared
 *     button drives evaluation.
 *
 * ``reviewed`` (Problem 2) re-mounts a completed step in a
 * locked post-check visual, reconstructed from the persisted
 * ``RawAnswer`` so navigating back never lets the learner
 * re-answer.
 */

import type {ElementAttempt} from "../../storage/types";

/** Imperative handle the controlled parent uses to drive the
 *  shared "Check" button. */
export interface ExerciseHandle {
    /** Evaluate the current answer. No-op when the answer is
     *  not yet checkable or the exercise is already
     *  submitted / reviewed. */
    submit: () => void;
}

/** The raw user answer, persisted alongside the step score so
 *  a revisited (locked) step can re-render the exact
 *  post-check visual without redoing the exercise.
 *  Discriminated by exercise type. */
export type RawAnswer =
    | {kind: "matching"; matches: [number, number][]}
    | {kind: "picture_choice"; selected: number}
    | {kind: "free_text"; input: string}
    | {kind: "word_tiles"; placed: number[]}
    | {kind: "cloze"; inputs: string[]};

/** The scored outcome an exercise reports on submit. Extends
 *  the original ``{correct, total, attempts}`` shape with the
 *  optional ``raw_answer`` the controlled (Lesson) path
 *  persists for the locked revisit state. Older consumers
 *  (Review / AdaptiveLesson) ignore the extra field. */
export interface ExerciseScored {
    correct: number;
    total: number;
    attempts: ElementAttempt[];
    raw_answer?: RawAnswer;
}

/** Props every exercise renderer gains for the two-phase
 *  flow. All optional + default-off so uncontrolled callers
 *  (the original behaviour) are unaffected. */
export interface ControlledExerciseProps {
    /** When true the exercise hides its internal Check + retry
     *  buttons; the parent drives evaluation via the ref +
     *  ``onInteraction``. */
    controlled?: boolean;
    /** Fired (controlled mode only) whenever the answer's
     *  checkable state flips, so the parent can enable /
     *  disable the shared "Prüfen" button. */
    onInteraction?: (answerable: boolean) => void;
    /** When present, re-mount the exercise in a locked
     *  post-check visual reconstructed from this persisted
     *  answer (Problem 2 — revisit a completed step). */
    reviewed?: RawAnswer | null;
}
