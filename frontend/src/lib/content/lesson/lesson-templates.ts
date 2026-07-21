/**
 * Lesson templates (Phase 65F / EXP-021).
 *
 * Structural scaffolding — NOT content. A template pre-fills the
 * wizard's card slots + exercise config so the user starts from a
 * shape instead of a blank page; everything stays editable.
 */

import {
    DEFAULT_EXERCISE_GEN_CONFIG,
    type ExerciseGenConfig,
} from "../../exercises";
import {emptyCard, type LessonCardDraft} from "./lesson-draft";

export type LessonTemplateKey =
    | "blank"
    | "vocabulary"
    | "grammar"
    | "conversation";

export const LESSON_TEMPLATE_KEYS: LessonTemplateKey[] = [
    "blank",
    "vocabulary",
    "grammar",
    "conversation",
];

export interface AppliedTemplate {
    cards: LessonCardDraft[];
    config: ExerciseGenConfig;
}

function slots(n: number): LessonCardDraft[] {
    return Array.from({length: n}, () => emptyCard());
}

/** Apply a template: returns the pre-filled card slots + the
 *  exercise generator config to seed the wizard with. */
export function applyTemplate(key: LessonTemplateKey): AppliedTemplate {
    switch (key) {
        case "vocabulary":
            return {
                cards: slots(10),
                config: {
                    ...DEFAULT_EXERCISE_GEN_CONFIG,
                    count: 10,
                    types: ["matching", "free_text"],
                },
            };
        case "grammar":
            return {
                cards: slots(5),
                config: {
                    ...DEFAULT_EXERCISE_GEN_CONFIG,
                    count: 8,
                    types: ["matching", "free_text", "cloze"],
                },
            };
        case "conversation":
            return {
                cards: slots(5),
                config: {
                    ...DEFAULT_EXERCISE_GEN_CONFIG,
                    count: 8,
                    types: ["word_tiles", "cloze", "free_text"],
                },
            };
        case "blank":
        default:
            return {cards: [], config: {...DEFAULT_EXERCISE_GEN_CONFIG}};
    }
}
