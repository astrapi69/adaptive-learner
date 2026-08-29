/**
 * review/error-question — resolve the QUESTION the learner was asked for
 * one tracked mistake (#2757), so the "Why you missed these" summary can
 * show the answers with context instead of an answer diff alone.
 *
 * ``ElementError`` rows carry no question text, and the raw ``element_key``
 * must never be displayed: since engine#91 it may be an opaque
 * ``stable_id`` (see {@link elementIdentityKeysOf}). The asked text is
 * therefore re-derived from the lesson content:
 *
 *   matching        → the asked pair's ``left`` term, located via the same
 *                     identity keys the recorder stamped
 *   cloze           → the ``sentence`` (contains the ``___`` blank)
 *   ext RC / quiz   → the matching sub-question's ``prompt``
 *   everything else → the exercise ``prompt``, falling back to the step
 *                     title
 *
 * Pure + i18n-free. Returns ``null`` when the exercise cannot be resolved
 * (content evicted / updated) or nothing askable exists — the caller then
 * keeps the answer-only rendering rather than showing a wrong guess.
 */

import {
    asGradedQuizPayload,
    canonicalAnswer as gradedQuizCanonicalAnswer,
} from "../exercises/payload/graded-quiz";
import {
    asReadingComprehensionPayload,
    canonicalAnswer as rcCanonicalAnswer,
} from "../exercises/payload/reading-comprehension";
import {
    GRADED_QUIZ_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
} from "../exercises/authoring/extension-edit";
import {elementIdentityKeysOf} from "../srs/element-identity";
import {elementKeysOf} from "../srs/element-keys";
import {matchesExerciseIdentity} from "../srs/exercise-identity";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ElementError,
} from "../../storage/types";

/** Trimmed non-empty string, else null — so an authored ``""`` prompt
 *  falls through to the next candidate instead of rendering blank. */
function _nonEmpty(text: string | null | undefined): string | null {
    const trimmed = (text ?? "").trim();
    return trimmed === "" ? null : trimmed;
}

/** The step whose exercise the error's row id names (#2130: matches the
 *  authored slug AND the stable_id). Same loop idiom as review-lesson /
 *  error-classifier. */
function _findStep(
    lesson: ContentLesson,
    exerciseId: string,
): ContentLessonStep | null {
    for (const step of lesson.steps) {
        if (step.exercise && matchesExerciseIdentity(step.exercise, exerciseId)) {
            return step;
        }
    }
    return null;
}

/** The element's index within the exercise's fan-out, resolved under
 *  EITHER key rule: the identity keys new rows are stamped with
 *  (stable_id-preferring) or the canonical-text keys pre-engine#91 rows
 *  carry. -1 when the key resolves nowhere. */
function _elementIndex(
    exercise: ContentLessonExercise,
    elementKey: string,
): number {
    const identityIdx = (elementIdentityKeysOf(exercise) ?? []).indexOf(elementKey);
    if (identityIdx !== -1) return identityIdx;
    return (elementKeysOf(exercise) ?? []).indexOf(elementKey);
}

/** MATCHING: the asked term is the pair's ``left`` side (the recorder
 *  writes ``correct_answer = pair.right`` in both drill directions). */
function _matchingQuestion(
    exercise: ContentLessonExercise,
    elementKey: string,
): string | null {
    const index = _elementIndex(exercise, elementKey);
    if (index === -1) return null;
    return _nonEmpty(exercise.pairs?.[index]?.left);
}

/** RC / graded quiz: the sub-question whose canonical answer is the
 *  element_key (the same rule element-keys.ts derives the key from). */
function _subQuestionPrompt(
    exercise: ContentLessonExercise,
    elementKey: string,
): string | null {
    if (exercise.type === READING_COMPREHENSION_EXT_TYPE) {
        const payload = asReadingComprehensionPayload(exercise);
        const question = payload?.questions.find(
            (q) => (rcCanonicalAnswer(q) || q.prompt) === elementKey,
        );
        return _nonEmpty(question?.prompt);
    }
    const payload = asGradedQuizPayload(exercise);
    const question = payload?.questions.find(
        (q) => (gradedQuizCanonicalAnswer(q) || q.prompt) === elementKey,
    );
    return _nonEmpty(question?.prompt);
}

/**
 * The question text ``error`` was answered against, resolved from
 * ``lesson``'s content, or ``null`` when it cannot be derived.
 */
export function questionForError(
    lesson: ContentLesson,
    error: ElementError,
): string | null {
    const step = _findStep(lesson, error.exercise_id);
    const exercise = step?.exercise;
    if (!step || !exercise) return null;

    let question: string | null = null;
    if (exercise.type === "matching") {
        question = _matchingQuestion(exercise, error.element_key);
    } else if (exercise.type === "cloze") {
        question = _nonEmpty(exercise.sentence);
    } else if (
        exercise.type === READING_COMPREHENSION_EXT_TYPE ||
        exercise.type === GRADED_QUIZ_EXT_TYPE
    ) {
        question = _subQuestionPrompt(exercise, error.element_key);
    }
    return question ?? _nonEmpty(exercise.prompt) ?? _nonEmpty(step.title);
}

/**
 * The question a whole exercise STEP asked, for the summary's per-answer
 * disclosure (#2807).
 *
 * {@link questionForError} answers "what was asked for THIS element" and needs
 * an ``ElementError`` to locate it. The lesson summary works one level up: its
 * rows are steps, not elements, so it needs the step's own prompt - the cloze
 * sentence, the exercise prompt, the instruction of a matching block.
 *
 * Kept in this module on purpose: #2757 fixed "answers shown without the
 * question" for one surface and left the sibling one (#2807) with the same
 * gap. One home for the class, so the next surface reuses instead of
 * re-deriving.
 *
 * @param exercise - The step's exercise content.
 * @returns The question text, or ``null`` when the exercise carries none.
 *
 * @example
 * questionForExercise({type: "cloze", sentence: "El ___ come."}); // "El ___ come."
 */
export function questionForExercise(
    exercise: ContentLessonExercise | null | undefined,
): string | null {
    if (!exercise) return null;
    // A cloze's sentence IS the question; its prompt is only an instruction.
    if (exercise.type === "cloze") {
        return _nonEmpty(exercise.sentence) ?? _nonEmpty(exercise.prompt);
    }
    return _nonEmpty(exercise.prompt);
}
