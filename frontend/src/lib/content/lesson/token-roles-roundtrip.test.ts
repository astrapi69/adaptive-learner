/**
 * #3072 - token annotations survive the whole authoring path.
 *
 * The point of the field is that the cloze generator finds it at read
 * time. A UI that collects annotations which the build step drops would
 * look finished and change nothing - the exact "wired is not working"
 * shape that left `token_roles` unauthorable for eleven releases.
 *
 * So this pins the seam, not the widget: draft -> `buildLessonFromDraft`
 * -> `ContentLesson`, and the way back through `lessonToDraftInput` that
 * edit mode uses.
 */

import {describe, expect, it} from "vitest";

import {buildLessonFromDraft, lessonToDraftInput} from "./draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "./lesson-draft";

// Built from the real `LessonMeta` shape, every field present. A
// hand-trimmed fixture would encode this test's assumption instead of the
// producer's contract (lessons/core.md).
const META: LessonMeta = {
    title: "Tiere",
    titleNative: "Animals",
    sourceLanguage: "en",
    targetLanguage: "de",
    level: "A1",
    description: "",
    author: "",
    domain: "language",
};

function card(overrides: Partial<LessonCardDraft> = {}): LessonCardDraft {
    return {
        id: "c1",
        front: "der Hund",
        back: "the dog",
        notes: "",
        image: "",
        example: "",
        altAnswers: [],
        ...overrides,
    };
}

describe("token roles survive the build step", () => {
    it("writes the annotations onto the lesson card", () => {
        const lesson = buildLessonFromDraft({
            meta: META,
            cards: [card({tokenRoles: [{token: "der", role: "article"}]})],
            exercises: [],
        });
        expect(lesson.cards[0].token_roles).toEqual([
            {token: "der", role: "article"},
        ]);
    });

    it("writes null rather than an empty array when nothing is annotated", () => {
        // `null` is the schema default; an empty array would make every
        // untouched lesson differ from its stored form on a re-save.
        const lesson = buildLessonFromDraft({
            meta: META,
            cards: [card()],
            exercises: [],
        });
        expect(lesson.cards[0].token_roles).toBeNull();
    });

    it("keeps the token verbatim, including its casing", () => {
        const lesson = buildLessonFromDraft({
            meta: META,
            cards: [
                card({
                    front: "Der Hund",
                    tokenRoles: [{token: "Der", role: "article"}],
                }),
            ],
            exercises: [],
        });
        const [entry] = lesson.cards[0].token_roles ?? [];
        expect(entry.token).toBe("Der");
        expect(lesson.cards[0].front).toContain(entry.token);
    });
});

describe("token roles survive the way back into edit mode", () => {
    it("reads the annotations back onto the draft", () => {
        const lesson = buildLessonFromDraft({
            meta: META,
            cards: [
                card({
                    tokenRoles: [
                        {token: "der", role: "article"},
                        {token: "Hund", role: "noun"},
                    ],
                }),
            ],
            exercises: [],
        });
        const back = lessonToDraftInput(lesson);
        expect(back.cards[0].tokenRoles).toEqual([
            {token: "der", role: "article"},
            {token: "Hund", role: "noun"},
        ]);
    });

    it("reads an unannotated card back as an empty list, not undefined", () => {
        const lesson = buildLessonFromDraft({
            meta: META,
            cards: [card()],
            exercises: [],
        });
        expect(lessonToDraftInput(lesson).cards[0].tokenRoles).toEqual([]);
    });

    it("survives a full round trip unchanged", () => {
        const roles = [{token: "der", role: "article" as const}];
        const first = buildLessonFromDraft({
            meta: META,
            cards: [card({tokenRoles: roles})],
            exercises: [],
        });
        const second = buildLessonFromDraft({
            meta: META,
            cards: lessonToDraftInput(first).cards,
            exercises: [],
        });
        expect(second.cards[0].token_roles).toEqual(roles);
    });
});
