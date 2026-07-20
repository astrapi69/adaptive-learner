/**
 * Tests for the extension-lesson builder (#1852) — the one builder that
 * sets ``requires_extensions``.
 */

import {describe, expect, it} from "vitest";

import {
    CATEGORIZATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
} from "./extension-edit";
import {buildExtensionLesson, requiredExtensionsFor} from "./lesson-assembly";
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

describe("requiredExtensionsFor", () => {
    it("emits distinct versioned entries in first-seen order", () => {
        expect(requiredExtensionsFor([CAT, EC, CAT])).toEqual([
            "ext:al-categorization@1",
            "ext:al-error-correction@1",
        ]);
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
