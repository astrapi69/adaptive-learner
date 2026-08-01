/**
 * #2303 — the element_key derivation is ONE rule, and it covers every shipped
 * exercise type.
 *
 * The parity block is the load-bearing part: for each type it asserts that
 * ``elementKeysOf`` returns exactly the keys the runtime deriver in
 * ``element-attempt.ts`` stamps on its attempts. That is what makes "one rule"
 * checkable instead of merely intended — the #2128 update guard used to carry
 * a second, narrower copy of the same rule and silently disagreed with the
 * runtime for eight of thirteen types.
 */

import {describe, expect, it} from "vitest";
import {elementKeysOf} from "./element-keys";
import {
    deriveCategorizationAttempts,
    deriveClozeAttempts,
    deriveClozeMultiSelectAttempt,
    deriveDictationAttempt,
    deriveErrorCorrectionAttempt,
    deriveFreeTextAttempt,
    deriveGradedQuizAttempts,
    deriveImageDescriptionAttempt,
    deriveMatchingAttempts,
    deriveMultipleChoiceAttempt,
    derivePictureChoiceAttempt,
    deriveReadingComprehensionAttempts,
    deriveWordTilesAttempt,
} from "./element-attempt";
import type {ContentLessonExercise} from "../../storage/types";

const CTX = {setId: "s", lessonId: "01.json"};

/** Minimal exercise carrying only what the key rule reads. */
function ex(partial: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {
        id: "ex-1",
        prompt: "p",
        card_ids: [],
        distractors: [],
        ...partial,
    } as ContentLessonExercise;
}

const MATCHING = ex({
    type: "matching",
    pairs: [
        {left: "merci", right: "danke"},
        {left: "bonjour", right: "guten Tag"},
    ],
});
const PICTURE_CHOICE = ex({
    type: "picture_choice",
    images: [
        {label: "le chat", is_correct: "true", src: "a.png"},
        {label: "le chien", src: "b.png"},
    ],
});
const FREE_TEXT = ex({type: "free_text", accept: ["Merci", "merci beaucoup"]});
const WORD_TILES = ex({type: "word_tiles", tiles: ["je", "suis", "ici"]});
const CLOZE = ex({
    type: "cloze",
    sentence: "Je ___ ici et ___ content.",
    blanks: [{accept: ["suis"]}, {accept: ["tres"]}],
});
const CLOZE_MULTISELECT = ex({
    type: "cloze",
    cloze_mode: "multiselect",
    sentence: "Welche sind Verben?",
    accept: ["laufen", "essen"],
});
const MULTIPLE_CHOICE = ex({
    type: "multiple_choice",
    options: [
        {text: "un", correct: true},
        {text: "deux", correct: false},
        {text: "trois", correct: true},
    ],
});
const CATEGORIZATION = ex({
    type: "ext:al-categorization",
    ext_payload: {
        categories: [
            {name: "Verb", items: ["laufen", "essen"]},
            {name: "Nomen", items: ["Haus"]},
        ],
    },
});
const ERROR_CORRECTION = ex({
    type: "ext:al-error-correction",
    ext_payload: {
        tokens: ["Ich", "gehe", "zu", "Hause"],
        error_index: 2,
        accept: ["nach"],
    },
});
const READING_COMPREHENSION = ex({
    type: "ext:al-reading-comprehension",
    ext_payload: {
        passage: "Paul wohnt in Lyon.",
        questions: [
            {
                prompt: "Wo wohnt Paul?",
                type: "multiple_choice",
                options: [
                    {text: "Lyon", correct: true},
                    {text: "Paris"},
                ],
            },
            {prompt: "Wie heisst er?", type: "free_text", accept: ["Paul"]},
        ],
    },
});
const GRADED_QUIZ = ex({
    type: "ext:al-graded-quiz",
    ext_payload: {
        questions: [
            {
                prompt: "2 + 2?",
                type: "multiple_choice",
                options: [{text: "4", correct: true}, {text: "5"}],
                points: 1,
            },
            {prompt: "Hauptstadt?", type: "free_text", accept: ["Berlin"], points: 1},
        ],
    },
});
const DICTATION = ex({
    type: "ext:al-dictation",
    ext_payload: {audio: "assets/a.mp3", accept: ["Guten Morgen"]},
});
const IMAGE_DESCRIPTION = ex({
    type: "ext:al-image-description",
    ext_payload: {image: "assets/a.png", accept: ["Ein Hund laeuft."]},
});

describe("elementKeysOf agrees with the runtime deriver, per type (#2303)", () => {
    const cases: [string, ContentLessonExercise, () => string[]][] = [
        [
            "matching",
            MATCHING,
            () =>
                deriveMatchingAttempts(MATCHING, CTX, new Map()).map(
                    (a) => a.element_key,
                ),
        ],
        [
            "picture_choice",
            PICTURE_CHOICE,
            () => [derivePictureChoiceAttempt(PICTURE_CHOICE, CTX, 0).element_key],
        ],
        [
            "free_text",
            FREE_TEXT,
            () => [deriveFreeTextAttempt(FREE_TEXT, CTX, "", false).element_key],
        ],
        [
            "word_tiles",
            WORD_TILES,
            () => [deriveWordTilesAttempt(WORD_TILES, CTX, [], false).element_key],
        ],
        [
            "cloze",
            CLOZE,
            () => deriveClozeAttempts(CLOZE, CTX, [], []).map((a) => a.element_key),
        ],
        [
            "cloze multiselect",
            CLOZE_MULTISELECT,
            () => [
                deriveClozeMultiSelectAttempt(CLOZE_MULTISELECT, CTX, [], false)
                    .element_key,
            ],
        ],
        [
            "multiple_choice",
            MULTIPLE_CHOICE,
            () => [
                deriveMultipleChoiceAttempt(MULTIPLE_CHOICE, CTX, [], false)
                    .element_key,
            ],
        ],
        [
            "ext:al-categorization",
            CATEGORIZATION,
            () =>
                deriveCategorizationAttempts(CATEGORIZATION, CTX, new Map()).map(
                    (a) => a.element_key,
                ),
        ],
        [
            "ext:al-error-correction",
            ERROR_CORRECTION,
            () => [
                deriveErrorCorrectionAttempt(
                    ERROR_CORRECTION,
                    CTX,
                    {pickedIndex: 0, typedCorrection: ""},
                    false,
                ).element_key,
            ],
        ],
        [
            "ext:al-reading-comprehension",
            READING_COMPREHENSION,
            () =>
                deriveReadingComprehensionAttempts(
                    READING_COMPREHENSION,
                    CTX,
                    [],
                ).map((a) => a.element_key),
        ],
        [
            "ext:al-graded-quiz",
            GRADED_QUIZ,
            () =>
                deriveGradedQuizAttempts(GRADED_QUIZ, CTX, []).map(
                    (a) => a.element_key,
                ),
        ],
        [
            "ext:al-dictation",
            DICTATION,
            () => [deriveDictationAttempt(DICTATION, CTX, "", false).element_key],
        ],
        [
            "ext:al-image-description",
            IMAGE_DESCRIPTION,
            () => [
                deriveImageDescriptionAttempt(IMAGE_DESCRIPTION, CTX, "", false)
                    .element_key,
            ],
        ],
    ];

    for (const [name, exercise, viaDeriver] of cases) {
        it(`${name}: elementKeysOf == the deriver's element_key(s)`, () => {
            expect(elementKeysOf(exercise)).toEqual(viaDeriver());
        });
    }

    it("covers every case the runtime derivers can produce", () => {
        expect(cases).toHaveLength(13);
    });

    it("no case is vacuously green (a malformed fixture yields no keys)", () => {
        // Parity between two empty lists is not evidence. A fixture the
        // payload reader rejects would pass the per-type assertions above
        // while proving nothing about the rule.
        for (const [name, exercise] of cases) {
            expect(elementKeysOf(exercise), `${name} produced no keys`)
                .not.toEqual([]);
        }
    });
});

describe("elementKeysOf fails closed on an unknown type (#2303)", () => {
    it("returns null for an undeclared ext: type", () => {
        expect(elementKeysOf(ex({type: "ext:acme-ordering"}))).toBeNull();
    });

    it("returns null for a nonsense type", () => {
        expect(elementKeysOf(ex({type: "not_a_type"}))).toBeNull();
    });

    it("returns null for a missing type", () => {
        expect(elementKeysOf(ex({}))).toBeNull();
    });

    it("distinguishes 'unknown type' (null) from 'no keys' (empty array)", () => {
        // A cloze authored without blanks yields no SRS rows at all; that is a
        // KNOWN type with zero keys, not an unknown one. Collapsing the two is
        // what made the guard warn forever on types it simply did not handle.
        expect(elementKeysOf(ex({type: "cloze", blanks: []}))).toEqual([]);
    });
});
