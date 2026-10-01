/**
 * #3387 - the Lesson Creator's per-exercise gate defers to the engine's
 * ``validateLessonRules`` (plus the schema's shape) instead of the app's
 * own copy of the per-type rules. The cases where the copy and the engine
 * disagreed are pinned here in both directions; the rest keep the copy's
 * cases so nothing it caught slips through.
 */
import {describe, expect, it} from "vitest";

import {checkExerciseDraft} from "./exercise-draft-check";
import {EXPLANATION_MAX_CHARS, createBlankExercise} from "../../../exercises";
import type {ContentLessonExercise} from "../../../../storage/types";

const CARD_IDS = ["card-un", "card-deux", "card-trois"];

function base(over: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {
        id: "ex-1",
        type: "free_text",
        prompt: "Translate: Bonjour",
        card_ids: [],
        distractors: [],
        ...over,
    } as ContentLessonExercise;
}

function check(ex: ContentLessonExercise, cardIds: readonly string[] = CARD_IDS) {
    return checkExerciseDraft(ex, cardIds);
}

const matching = (pairs: Array<{left: string; right: string}>) =>
    base({type: "matching", prompt: "Match", pairs});

const multiselect = base({
    id: "ex-ms-vok",
    type: "cloze",
    cloze_mode: "multiselect",
    prompt: "Wähle alle fünf Vokal-Zeichen.",
    sentence: "Welche dieser Zeichen sind Vokale?",
    accept: ["あ", "い", "う", "え", "お"],
    distractors: ["か", "さ", "な"],
});

const mc = (over: Partial<ContentLessonExercise>) =>
    base({
        type: "multiple_choice",
        prompt: "Pick the translation of chat",
        multiple: false,
        options: [
            {text: "cat", correct: true},
            {text: "dog", correct: false},
        ],
        ...over,
    });

describe("checkExerciseDraft - where the app copy and the engine disagreed (#3387)", () => {
    it("accepts a one-pair matching (the engine's minimum; the copy demanded two)", () => {
        expect(check(matching([{left: "un", right: "one"}]))).toEqual({
            valid: true,
            code: null,
        });
    });

    it("accepts a from_cards matching without pairs whose cards exist", () => {
        const ex = base({
            type: "matching",
            prompt: "Match",
            from_cards: true,
            card_ids: ["card-un", "card-deux", "card-trois"],
        });
        expect(check(ex)).toEqual({valid: true, code: null});
    });

    it.each<[string, ContentLessonExercise, string]>([
        [
            "a left term repeated in another case",
            matching([
                {left: "Empathie", right: "empathy"},
                {left: "empathie", right: "compassion"},
            ]),
            "matching_duplicate_left",
        ],
        [
            "a from_cards matching that also lists pairs",
            base({
                type: "matching",
                prompt: "Match",
                from_cards: true,
                card_ids: ["card-un"],
                pairs: [{left: "un", right: "one"}],
            }),
            "matching_from_cards",
        ],
        [
            "a select gap without distractors",
            base({
                type: "cloze",
                cloze_mode: "select",
                prompt: "Fill",
                sentence: "Je ___ un livre.",
                blanks: [{accept: ["lis"]}],
                distractors: [],
            }),
            "cloze_distractors",
        ],
        [
            "an accepted tile order that is not a permutation",
            base({
                type: "word_tiles",
                prompt: "Arrange",
                tiles: ["Je", "lis"],
                accept_orderings: [[0, 0]],
            }),
            "word_tiles_ordering",
        ],
        [
            "a card reference to a card no longer in the lesson",
            base({type: "free_text", accept: ["un"], card_ids: ["card-gone"]}),
            "card_ref",
        ],
    ])("rejects %s", (_name, ex, code) => {
        expect(check(ex)).toEqual({valid: false, code});
    });
});

describe("checkExerciseDraft - cases the app copy already caught", () => {
    it.each<[string, ContentLessonExercise]>([
        ["a free_text with an answer", base({accept: ["Guten Tag"]})],
        [
            "a two-pair matching",
            matching([
                {left: "un", right: "one"},
                {left: "deux", right: "two"},
            ]),
        ],
        [
            "a cloze with one marker and one answered blank",
            base({
                type: "cloze",
                prompt: "Fill in",
                sentence: "Je ___ un livre.",
                blanks: [{accept: ["lis"]}],
            }),
        ],
        [
            "a select cloze with a distractor",
            base({
                type: "cloze",
                cloze_mode: "select",
                prompt: "Fill",
                sentence: "Je ___ un livre.",
                blanks: [{accept: ["lis"]}],
                distractors: ["mange"],
            }),
        ],
        ["an untouched multiselect cloze (#3246)", multiselect],
        [
            "a ___ in a multiselect question (#3222 PR 4)",
            {...multiselect, sentence: "Welche ___ sind Vokale?"},
        ],
        ["word tiles with two tiles", base({type: "word_tiles", prompt: "Arrange", tiles: ["Je", "lis"]})],
        [
            "a picture choice with one correct image",
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [
                    {src: "a.png", label: "cat", is_correct: "true"},
                    {src: "b.png", label: "dog"},
                ],
            }),
        ],
        ["a single-choice question with one correct option", mc({})],
        [
            "a multi-choice question with two correct options",
            mc({
                multiple: true,
                options: [
                    {text: "cat", correct: true},
                    {text: "feline", correct: true},
                    {text: "dog", correct: false},
                ],
            }),
        ],
        [
            "an explanation exactly at the schema cap",
            base({accept: ["hello"], explanation: "x".repeat(EXPLANATION_MAX_CHARS)}),
        ],
    ])("accepts %s", (_name, ex) => {
        expect(check(ex)).toEqual({valid: true, code: null});
    });

    it.each<[string, ContentLessonExercise, string]>([
        ["a whitespace prompt", base({prompt: "   ", accept: ["x"]}), "prompt"],
        [
            "an explanation over the schema cap",
            base({accept: ["hello"], explanation: "x".repeat(EXPLANATION_MAX_CHARS + 1)}),
            "explanation",
        ],
        ["a free_text without an answer", base({accept: ["  "]}), "free_text"],
        [
            "a matching whose only pairs are incomplete",
            matching([
                {left: "un", right: "  "},
                {left: "", right: "two"},
            ]),
            "matching_pairs",
        ],
        [
            "a cloze without a marker",
            base({type: "cloze", prompt: "Fill in", sentence: "No blank here.", blanks: []}),
            "cloze",
        ],
        [
            "a cloze whose blank has no answer",
            base({
                type: "cloze",
                prompt: "Fill in",
                sentence: "Je ___ un livre.",
                blanks: [{accept: ["   "]}],
            }),
            "cloze",
        ],
        ["a multiselect with no correct option", {...multiselect, accept: []}, "cloze_multiselect"],
        ["a multiselect with no distractor", {...multiselect, distractors: []}, "cloze_multiselect"],
        ["a multiselect with an empty question", {...multiselect, sentence: "   "}, "cloze_multiselect"],
        [
            "a multiselect option that is both correct and a distractor",
            {...multiselect, distractors: ["か", "あ"]},
            "cloze_multiselect",
        ],
        ["word tiles with one tile", base({type: "word_tiles", prompt: "Arrange", tiles: ["Je"]}), "word_tiles"],
        [
            "a picture choice without a correct image",
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [
                    {src: "a.png", label: "cat"},
                    {src: "b.png", label: "dog"},
                ],
            }),
            "picture_choice",
        ],
        [
            "a picture choice with a single image",
            base({
                type: "picture_choice",
                prompt: "Pick",
                images: [{src: "a.png", label: "cat", is_correct: "true"}],
            }),
            "picture_choice",
        ],
        [
            "a choice question with one non-empty option",
            mc({options: [{text: "cat", correct: true}, {text: "  ", correct: false}]}),
            "multiple_choice",
        ],
        [
            "a choice question with duplicate options",
            mc({options: [{text: "cat", correct: true}, {text: "cat", correct: false}]}),
            "multiple_choice",
        ],
        [
            "a single-choice question with no correct option",
            mc({options: [{text: "cat", correct: false}, {text: "dog", correct: false}]}),
            "multiple_choice",
        ],
        [
            "a single-choice question with two correct options",
            mc({options: [{text: "cat", correct: true}, {text: "dog", correct: true}]}),
            "multiple_choice",
        ],
        [
            "a multi-choice question with no correct option",
            mc({
                multiple: true,
                options: [
                    {text: "cat", correct: false},
                    {text: "dog", correct: false},
                ],
            }),
            "multiple_choice",
        ],
    ])("rejects %s", (_name, ex, code) => {
        expect(check(ex)).toEqual({valid: false, code});
    });

    it.each([
        "matching",
        "free_text",
        "cloze",
        "word_tiles",
        "picture_choice",
        "multiple_choice",
    ] as const)("keeps a blank %s exercise out until it is filled (#1849)", (type) => {
        expect(check(createBlankExercise(type, `id-${type}`)).valid).toBe(false);
    });
});

describe("checkExerciseDraft - the lesson around the exercise is not its problem", () => {
    it("ignores a card list the exercise does not reference, even a broken one", () => {
        const ex = base({accept: ["un"], card_ids: ["card-un"]});
        expect(check(ex, ["card-un", "card-un", "Not A Slug"])).toEqual({
            valid: true,
            code: null,
        });
    });
});
