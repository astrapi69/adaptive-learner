/**
 * #3389 - the Lesson Creator's share rows are the engine's quality
 * minimums (``validateLessonQuality``), the check the share wizard and the
 * content-repo gate run, so the checklist predicts what sharing will say.
 * Local save no longer counts exercises or types (owner decision, option 2).
 */
import {describe, expect, it} from "vitest";

import {generateExercises} from "../../../exercises";
import type {ContentLessonExercise} from "../../../../storage/types";
import {checkDraft, type DraftLessonInput} from "../draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "../lesson-draft";
import {checkDraftForSharing, shareChecksPass} from "./draft-share-check";

const META: LessonMeta = {
    title: "Mes animaux",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "fr",
    level: "A1",
    description: "",
    author: "",
    domain: "language",
};

const CARDS: LessonCardDraft[] = ["chat", "chien", "oiseau", "poisson", "cheval"].map(
    (front, i) => ({id: `c${i}`, front, back: `tier-${i}`, notes: "", image: ""}),
);

function matching(id: string): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: "Ordne zu.",
        card_ids: [],
        distractors: [],
        pairs: [
            {left: "chat", right: "tier-0"},
            {left: "chien", right: "tier-1"},
            {left: "oiseau", right: "tier-2"},
        ],
    } as ContentLessonExercise;
}

function freeText(id: string, accepts: string[]): ContentLessonExercise {
    return {
        id,
        type: "free_text",
        prompt: "chat",
        card_ids: ["c0"],
        distractors: [],
        accept: accepts,
    } as ContentLessonExercise;
}

function draft(exercises: ContentLessonExercise[]): DraftLessonInput {
    return {meta: META, cards: CARDS, exercises};
}

const SHAREABLE = draft([
    matching("m1"),
    matching("m2"),
    matching("m3"),
    freeText("f1", ["le chat", "chat"]),
    freeText("f2", ["le chat", "chat"]),
]);

describe("checkDraftForSharing (#3389)", () => {
    it("passes a draft that meets every engine minimum", () => {
        const checks = checkDraftForSharing(SHAREABLE);
        expect(checks).toEqual({minExercises: true, minTypes: true, exerciseMinimums: true});
        expect(shareChecksPass(checks)).toBe(true);
    });

    it.each([
        ["one exercise", [matching("m1")], {minExercises: false, minTypes: false}],
        [
            "five exercises of one type",
            ["m1", "m2", "m3", "m4", "m5"].map(matching),
            {minExercises: true, minTypes: false},
        ],
        [
            "four exercises of two types",
            [matching("m1"), matching("m2"), matching("m3"), freeText("f1", ["a", "b"])],
            {minExercises: false, minTypes: true},
        ],
    ])("counts exercises and types like the engine: %s", (_name, exercises, expected) => {
        expect(checkDraftForSharing(draft(exercises))).toMatchObject(expected);
    });

    it("flags a free-text exercise with a single accepted answer", () => {
        const exercises = [...SHAREABLE.exercises.slice(0, 4), freeText("f2", ["chat"])];
        const checks = checkDraftForSharing(draft(exercises));
        expect(checks).toEqual({minExercises: true, minTypes: true, exerciseMinimums: false});
    });

    it("fails closed when the draft does not build", () => {
        const checks = checkDraftForSharing({...SHAREABLE, meta: {...META, title: ""}});
        expect(shareChecksPass(checks)).toBe(false);
    });
});

describe("local save stays on validity (#3389, option 2)", () => {
    it("lets a valid two-exercise draft save locally while sharing still needs more", () => {
        const small = draft([matching("m1"), freeText("f1", ["chat"])]);
        const local = checkDraft(small);
        expect([local.hasTitle, local.languagePair, local.enoughCards, local.schemaValid]).toEqual([
            true,
            true,
            true,
            true,
        ]);
        expect(local).not.toHaveProperty("enoughExercises");
        expect(local).not.toHaveProperty("enoughTypes");
        expect(shareChecksPass(checkDraftForSharing(small))).toBe(false);
    });

    it("judges the generator's default draft the same way the share check does", () => {
        // matching + free_text at count 10: one matching and free-text
        // exercises with one accepted answer each, as measured on #3389.
        const cards = CARDS.map((c) => ({id: c.id, front: c.front, back: c.back}));
        const generated = generateExercises(cards, {
            count: 10,
            types: ["matching", "free_text"],
            direction: "auto",
        });
        const checks = checkDraftForSharing(draft(generated));
        expect(checks.exerciseMinimums).toBe(false);
    });
});
