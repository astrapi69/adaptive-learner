/**
 * ReviewStep — the wizard's step-4 review + quality checklist (#1929).
 *
 * Pins that the "language pair is valid" checklist row (i18n key
 * ``create_lesson.review.check_languagePair``) is rendered again after it
 * went missing when the underlying ``languagePair`` check was removed in
 * #1715/#1730. The row must show pass/fail state from ``draftChecks``.
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ReviewStep from "./ReviewStep";
import type {DraftValidationChecks} from "../../lib/content/lesson/draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

const t = (_key: string, fallback?: string) => fallback ?? _key;

const META: LessonMeta = {
    title: "My Lesson",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "fr",
    level: "A1",
    description: "",
    author: "",
};

const CARDS: LessonCardDraft[] = [];
const EXERCISES: ContentLessonExercise[] = [];

function checks(over: Partial<DraftValidationChecks> = {}): DraftValidationChecks {
    return {
        hasTitle: true,
        languagePair: true,
        enoughCards: true,
        enoughExercises: true,
        enoughTypes: true,
        schemaValid: true,
        schemaError: null,
        ...over,
    };
}

function renderStep(over: Partial<DraftValidationChecks> = {}) {
    render(
        <ReviewStep
            meta={META}
            cards={CARDS}
            exercises={EXERCISES}
            draftChecks={checks(over)}
            saving={false}
            onSaveLocal={() => {}}
            onSaveShare={() => {}}
            t={t}
        />,
    );
}

describe("ReviewStep language-pair check (#1929)", () => {
    it("renders the language-pair checklist row", () => {
        renderStep();
        expect(screen.getByTestId("check-languagePair")).toBeInTheDocument();
    });

    it("shows the row as passing for a valid pair", () => {
        renderStep({languagePair: true});
        expect(screen.getByTestId("check-languagePair")).toHaveAttribute(
            "data-pass",
            "true",
        );
    });

    it("shows the row as failing for an invalid pair", () => {
        renderStep({languagePair: false});
        expect(screen.getByTestId("check-languagePair")).toHaveAttribute(
            "data-pass",
            "false",
        );
    });

    it("renders six checklist rows (the language-pair row restored)", () => {
        renderStep();
        const checklist = screen.getByTestId("create-lesson-checklist");
        expect(checklist.querySelectorAll("li")).toHaveLength(6);
    });
});
