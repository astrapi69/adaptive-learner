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

import type {ElementAttempt, RawAnswer} from "../../../storage/types";

// ``RawAnswer`` is defined in the storage layer (it is a
// persistence shape); re-exported here so the renderers can
// import it alongside the rest of the control contract.
export type {RawAnswer};

/** Imperative handle the controlled parent uses to drive the
 *  shared "Check" button. */
export interface ExerciseHandle {
    /** Evaluate the current answer. No-op when the answer is
     *  not yet checkable or the exercise is already
     *  submitted / reviewed. */
    submit: () => void;
}

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
    /** TTS feature C2 — BCP-47 language the prompt is read aloud in
     *  (the lesson's target language). Absent => no read-aloud. */
    ttsLang?: string | null;
    /** TTS feature C2 — true when this exercise teaches code/formula
     *  content; renderers suppress read-aloud (reading code aloud is
     *  useless). Also set independently by the code-aware renderers. */
    codeMode?: boolean;
    /** #1218 — Lesson two-phase flow only: advance to the next step
     *  (the lesson's ``goNext``). When provided AND the answer is fully
     *  correct, the redundant My-answer / Solution toggle is replaced by
     *  a success badge + a single "Continue" action that calls this.
     *  Uncontrolled callers (Review / Adaptive — no in-renderer "next")
     *  omit it and keep the plain toggle. */
    onAdvance?: () => void;
    /** #1218 — localised label for the success "Continue" button. The
     *  lesson passes "Next" / "Finish lesson"; renderers default to the
     *  shared "Continue" string when absent. */
    advanceLabel?: string;
}
