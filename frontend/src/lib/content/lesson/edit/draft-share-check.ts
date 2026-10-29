/**
 * The Lesson Creator's share rows (#3389): whether a draft clears the
 * engine's quality minimums, the threshold "Save and share" needs.
 *
 * The answer is ``validateLessonQuality`` on the lesson the draft builds,
 * the same check the share wizard (``validateSetForSharing``) and the
 * content-repo gate run, so the checklist predicts what sharing will say.
 * The lesson's ``purpose`` decides which minimums apply. Findings map to a
 * row by rule id, never by message; a rule without a row of its own counts
 * against the per-exercise row (fail closed), as does a draft that does
 * not build.
 *
 * Local save does not ask this. It stays on validity (title, language
 * pair, card policy, schema), because the engine frames these minimums as
 * the bar for publishing, not for a valid lesson (owner decision on #3389).
 *
 * Lives next to ``exercise-draft-check`` for the same reason: only the
 * Lesson Creator's lazy chunk imports it, so ``learn-content-engine/rules``
 * stays out of the entry chunk (#3222 convention).
 *
 * @example
 * ```ts
 * const share = checkDraftForSharing({meta, cards, exercises});
 * const canShare = canSaveLocally && shareChecksPass(share);
 * ```
 */

import {validateLessonQuality} from "learn-content-engine/rules";
import type {Lesson as EngineLesson} from "learn-content-engine";

import {keyedByCurrentRuleId} from "../../validation/rule-keys";
import {buildLessonFromDraft, type DraftLessonInput} from "../draft-to-lesson";

/** One flag per share row of the review checklist. */
export interface DraftShareChecks {
    /** Enough exercises for the lesson's purpose (``E-QUALITY-EXERCISES``). */
    minExercises: boolean;
    /** Enough distinct exercise types (``E-QUALITY-TYPES``). */
    minTypes: boolean;
    /** Every exercise meets its own minimum: accepted answers, pairs. */
    exerciseMinimums: boolean;
}

type ShareRow = keyof DraftShareChecks;

/** Engine rule id -> the row it fails. Unlisted ids fail ``exerciseMinimums``. */
const ROW_BY_RULE: Readonly<Record<string, ShareRow>> = keyedByCurrentRuleId({
    "E-QUALITY-EXERCISES": "minExercises",
    "E-QUALITY-TYPES": "minTypes",
    "E-QUALITY-FREETEXT-ACCEPTS": "exerciseMinimums",
    "E-QUALITY-MATCHING-PAIRS": "exerciseMinimums",
});

const ALL_FAILED: DraftShareChecks = {
    minExercises: false,
    minTypes: false,
    exerciseMinimums: false,
};

/** Judge a wizard draft against the engine's quality minimums. */
export function checkDraftForSharing(input: DraftLessonInput): DraftShareChecks {
    let lesson;
    try {
        lesson = buildLessonFromDraft(input);
    } catch {
        return {...ALL_FAILED};
    }
    const checks: DraftShareChecks = {
        minExercises: true,
        minTypes: true,
        exerciseMinimums: true,
    };
    const verdict = validateLessonQuality(lesson as unknown as EngineLesson);
    for (const error of verdict.errors) {
        checks[ROW_BY_RULE[error.id] ?? "exerciseMinimums"] = false;
    }
    return checks;
}

/** True iff every share row passed. */
export function shareChecksPass(checks: DraftShareChecks): boolean {
    return checks.minExercises && checks.minTypes && checks.exerciseMinimums;
}
