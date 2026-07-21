/**
 * Pins the app-side machine-code → i18n-key mapping (#1862) and — crucially —
 * that EVERY code the exercise-kit validators can return resolves to a real
 * ``create_lesson.*`` catalog entry. The kit is app-neutral; this is the seam
 * that guarantees no validation code ever renders a raw key to the author.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {
    exerciseEditErrorKey,
    extensionEditErrorKey,
} from "./edit-error-keys";
import type {
    ExerciseEditCode,
    ExtensionEditCode,
} from "../../exercises";

const EXERCISE_CODES: ExerciseEditCode[] = [
    "prompt",
    "matching",
    "cloze",
    "word_tiles",
    "picture_choice",
    "multiple_choice",
    "free_text",
];

const EXTENSION_CODES: ExtensionEditCode[] = [
    "prompt",
    "categorization",
    "error_correction",
    "reading_comprehension",
    "graded_quiz",
];

const enCatalog = JSON.parse(
    readFileSync(join(__dirname, "../../../data/i18n/en.json"), "utf-8"),
) as Record<string, unknown>;

function resolve(key: string): string | undefined {
    let cursor: unknown = enCatalog;
    for (const part of key.split(".")) {
        if (
            cursor &&
            typeof cursor === "object" &&
            part in (cursor as Record<string, unknown>)
        ) {
            cursor = (cursor as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return typeof cursor === "string" ? cursor : undefined;
}

describe("edit-error-keys (#1862)", () => {
    it("prefixes a core exercise code with the create_lesson.exercises namespace", () => {
        expect(exerciseEditErrorKey("matching")).toBe(
            "create_lesson.exercises.edit.err_matching",
        );
    });

    it("prefixes an extension code with the create_lesson.extensions namespace", () => {
        expect(extensionEditErrorKey("graded_quiz")).toBe(
            "create_lesson.extensions.edit.err_graded_quiz",
        );
    });

    it.each(EXERCISE_CODES)(
        "resolves a real catalog message for core code %s",
        (code) => {
            const message = resolve(exerciseEditErrorKey(code));
            expect(message, `missing key for ${code}`).toBeTruthy();
        },
    );

    it.each(EXTENSION_CODES)(
        "resolves a real catalog message for extension code %s",
        (code) => {
            const message = resolve(extensionEditErrorKey(code));
            expect(message, `missing key for ${code}`).toBeTruthy();
        },
    );
});
