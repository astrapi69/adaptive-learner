/**
 * The Lesson Creator's per-exercise gate (#3387): whether the inline
 * editor's Save and the wizard's Next accept an exercise draft.
 *
 * The answer is the one saving the lesson gives. The draft is normalized
 * the way the editor commits it, wrapped in a one-exercise lesson that
 * carries the draft's real card ids, and judged by the schema's shape and
 * the engine's ``validateLessonRules``, the two layers of the save funnel
 * (``validateGeneratedLesson``). Only findings at or under the exercise's
 * path count; the wrapper and the card list are not the exercise's problem.
 * Findings map to an {@link ExerciseEditCode} by rule id, never by message.
 *
 * The app's own copy of the per-type rules is gone: it demanded two
 * matching pairs where the engine needs one, refused every ``from_cards``
 * matching, and missed duplicate lefts, select-gap distractors, tile
 * orderings and card references (measured on the fleet in #3387).
 *
 * Lives outside ``lib/exercises`` on purpose: only the Lesson Creator's
 * lazy chunk imports it, so ``learn-content-engine/rules`` and the shape
 * validator stay out of the entry chunk (#3222 convention).
 *
 * @example
 * ```ts
 * const issue = checkExerciseDraft(draft, cards.map((card) => card.id));
 * if (issue.valid) onSave(normalizeExerciseEdit(draft));
 * else showError(issue.code);
 * ```
 */

import {validateLessonRules} from "learn-content-engine/rules";
import type {Lesson as EngineLesson} from "learn-content-engine";

import {
    explanationTooLong,
    normalizeExerciseEdit,
    type ExerciseEditCode,
    type ExerciseEditIssue,
} from "../../../exercises";
import {APP_EXTENSION_REGISTRY} from "../../validation/engine-extensions";
import {validateLessonShape} from "../../validation/lesson-schema-validator";
import type {ContentLesson, ContentLessonExercise} from "../../../../storage/types";

/** Where the draft sits inside the wrapper lesson. */
const EXERCISE_PATH = "/steps/1/exercise";

/** Engine rule id -> the code whose message names that rule. A rule not
 *  listed here falls back to the exercise type's code (fail closed). */
const CODE_BY_RULE: Readonly<Record<string, ExerciseEditCode>> = {
    "E-MATCH-PAIRS": "matching_pairs",
    "E-MATCH-DUP-LEFT": "matching_duplicate_left",
    "E-MATCH-FROMCARDS-CARDS": "matching_from_cards",
    "E-MATCH-FROMCARDS-PAIRS": "matching_from_cards",
    "E-CLOZE-SELECT-DISTRACTORS": "cloze_distractors",
    "E-TILES-ORDERING": "word_tiles_ordering",
    "E-CARD-REF": "card_ref",
};

const TYPE_CODES: Readonly<Record<string, ExerciseEditCode>> = {
    matching: "matching_pairs",
    free_text: "free_text",
    word_tiles: "word_tiles",
    picture_choice: "picture_choice",
    multiple_choice: "multiple_choice",
};

/** The code for a finding no rule id names: the exercise type's message. */
function typeCode(exercise: ContentLessonExercise): ExerciseEditCode {
    if (exercise.type === "cloze") {
        return exercise.cloze_mode === "multiselect" ? "cloze_multiselect" : "cloze";
    }
    return TYPE_CODES[exercise.type] ?? "prompt";
}

function onExercise(path: string): boolean {
    return path === EXERCISE_PATH || path.startsWith(`${EXERCISE_PATH}/`);
}

/** A one-exercise lesson around the draft. Cards carry only their ids,
 *  which is all ``E-CARD-REF`` and ``from_cards`` read. */
function wrapperLesson(
    exercise: ContentLessonExercise,
    cardIds: readonly string[],
): ContentLesson {
    return {
        id: "exercise-draft",
        title: "Exercise draft",
        cards: cardIds.map((id) => ({id, front: id, back: id, tags: []})),
        steps: [
            {id: "theory-draft", type: "theory", body: "Exercise draft."},
            {id: "exercise-draft", type: "exercise", exercise},
        ],
    } as unknown as ContentLesson;
}

function firstRuleCode(
    lesson: ContentLesson,
    exercise: ContentLessonExercise,
): ExerciseEditCode | null {
    const {errors} = validateLessonRules(lesson as unknown as EngineLesson, {
        extensions: APP_EXTENSION_REGISTRY,
    });
    const finding = errors.find((error) => onExercise(error.path));
    if (!finding) return null;
    return CODE_BY_RULE[finding.id] ?? typeCode(exercise);
}

/**
 * Check one exercise draft against what saving the lesson will check.
 * The prompt and the explanation keep their own messages (the shape layer
 * would name them only by path); everything else is the schema's and the
 * engine's call.
 *
 * @param exercise - The editor's draft, before normalization.
 * @param cardIds - The ids of the lesson's cards, for card references.
 */
export function checkExerciseDraft(
    exercise: ContentLessonExercise,
    cardIds: readonly string[],
): ExerciseEditIssue {
    if (exercise.prompt.trim().length < 1) return {valid: false, code: "prompt"};
    if (explanationTooLong(exercise)) return {valid: false, code: "explanation"};
    const normalized = normalizeExerciseEdit(exercise);
    const lesson = wrapperLesson(normalized, cardIds);
    // The engine's rules expect the schema's shape, so the shape goes first.
    if (validateLessonShape(lesson).paths.some(onExercise)) {
        return {valid: false, code: typeCode(normalized)};
    }
    const ruleCode = firstRuleCode(lesson, normalized);
    return ruleCode ? {valid: false, code: ruleCode} : {valid: true, code: null};
}
