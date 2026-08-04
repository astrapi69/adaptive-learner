/**
 * Tests for the extension-lesson builder (#1852) — the one builder that
 * sets ``requires_extensions``.
 */

import {describe, expect, it} from "vitest";

import {
    CATEGORIZATION_EXT_TYPE,
    DICTATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
} from "./extension-edit";
import {
    appendExercisesToLesson,
    buildExtensionLesson,
    requiredExtensionsFor,
} from "./lesson-assembly";
import {validateLessonShape} from "../../content/validation/lesson-schema-validator";
import {
    buildExtensionUserSetInput,
    extensionSetId,
} from "../../content/lesson/user-set-input";
import type {LessonMeta} from "../../content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../../storage/types";

const META: LessonMeta = {
    title: "Dog Training Signals",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "en",
    level: "A1",
    description: "Practise categorising training signals.",
    author: "Aster",
    domain: "language",
};

const CAT: ContentLessonExercise = {
    id: "c1",
    type: CATEGORIZATION_EXT_TYPE,
    prompt: "Sort each signal",
    card_ids: [],
    distractors: [],
    ext_payload: {
        categories: [
            {name: "Sight", items: ["flat hand"]},
            {name: "Sound", items: ["Sit"]},
        ],
    },
} as ContentLessonExercise;

const EC: ContentLessonExercise = {
    id: "e1",
    type: ERROR_CORRECTION_EXT_TYPE,
    prompt: "Fix the wrong word",
    card_ids: [],
    distractors: [],
    ext_payload: {tokens: ["The", "dog", "follow"], error_index: 2, accept: ["follows"]},
} as ContentLessonExercise;

const DICT: ContentLessonExercise = {
    id: "d1",
    type: DICTATION_EXT_TYPE,
    prompt: "Type what you hear",
    card_ids: [],
    distractors: [],
    ext_payload: {audio: "assets/audio/one.mp3", accept: ["un", "eins"]},
} as ContentLessonExercise;

const CORE_MATCHING: ContentLessonExercise = {
    id: "m1",
    type: "matching",
    prompt: "Match them",
    card_ids: [],
    distractors: [],
    pairs: [{left: "a", right: "b"}],
} as ContentLessonExercise;

describe("requiredExtensionsFor", () => {
    it("emits distinct versioned entries in first-seen order", () => {
        expect(requiredExtensionsFor([CAT, EC, CAT])).toEqual([
            "ext:al-categorization@1",
            "ext:al-error-correction@1",
        ]);
    });

    // #1895 — when a mixed list (core + extension) reaches the generic helper
    // via the MAIN wizard path, only the extension types belong in
    // requires_extensions; a core type must never be declared.
    it("includes only extension types from a mixed list (#1895)", () => {
        expect(requiredExtensionsFor([CORE_MATCHING, DICT, CORE_MATCHING])).toEqual([
            "ext:al-dictation@1",
        ]);
    });

    it("returns an empty list for a pure core list (#1895)", () => {
        expect(requiredExtensionsFor([CORE_MATCHING])).toEqual([]);
    });
});

describe("buildExtensionLesson", () => {
    it("builds a valid lesson carrying requires_extensions + exercise steps", () => {
        const lesson = buildExtensionLesson({meta: META, exercises: [CAT, EC]});
        expect(lesson.requires_extensions).toEqual([
            "ext:al-categorization@1",
            "ext:al-error-correction@1",
        ]);
        expect(lesson.target_language).toBe("en");
        expect(lesson.steps[0].type).toBe("theory");
        const exerciseSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exerciseSteps).toHaveLength(2);
        expect(exerciseSteps[0].exercise?.type).toBe(CATEGORIZATION_EXT_TYPE);
    });

    it("does NOT throw for the four adopted extensions (load guard passes)", () => {
        // validateGeneratedLesson runs the extension load guard against
        // SUPPORTED_EXTENSIONS; both authored types are adopted, so no throw.
        expect(() =>
            buildExtensionLesson({meta: META, exercises: [CAT]}),
        ).not.toThrow();
    });

    it("builds a dictation lesson that carries ext:al-dictation@1 + passes the load guard (#1887)", () => {
        const lesson = buildExtensionLesson({meta: META, exercises: [DICT]});
        expect(lesson.requires_extensions).toEqual(["ext:al-dictation@1"]);
        const exerciseSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exerciseSteps).toHaveLength(1);
        expect(exerciseSteps[0].exercise?.type).toBe(DICTATION_EXT_TYPE);
    });

    it("builds the SaveUserSetInput with a stable set id", () => {
        const input = {meta: META, exercises: [CAT]};
        const set = buildExtensionUserSetInput(input, buildExtensionLesson(input));
        expect(set.set_id).toBe(extensionSetId(META));
        expect(set.set_id).toBe("created-dog-training-signals");
        expect(set.lessons).toHaveLength(1);
        expect(set.lessons[0].requires_extensions).toContain(
            "ext:al-categorization@1",
        );
    });
});

describe("appendExercisesToLesson — merges requires_extensions (#2355)", () => {
    const baseLesson = buildExtensionLesson({meta: META, exercises: [CAT]});

    it("adds the declaration when an appended exercise is an extension", () => {
        // Start from a core-only lesson (requires_extensions is []).
        const coreLesson = buildExtensionLesson({meta: META, exercises: [CORE_MATCHING]});
        expect(coreLesson.requires_extensions).toEqual([]);
        const merged = appendExercisesToLesson(coreLesson, [EC]);
        expect(merged.requires_extensions).toContain("ext:al-error-correction@1");
        expect(validateLessonShape(merged).ok).toBe(true);
    });

    it("unions the existing declaration with the appended exercises' extensions", () => {
        const merged = appendExercisesToLesson(baseLesson, [EC]);
        expect(merged.requires_extensions).toEqual(
            expect.arrayContaining([
                "ext:al-categorization@1",
                "ext:al-error-correction@1",
            ]),
        );
        expect(validateLessonShape(merged).ok).toBe(true);
    });

    it("does not duplicate an already-declared extension", () => {
        const merged = appendExercisesToLesson(baseLesson, [CAT]);
        const cat = (merged.requires_extensions ?? []).filter(
            (e) => e === "ext:al-categorization@1",
        );
        expect(cat).toHaveLength(1);
    });
});
