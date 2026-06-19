/**
 * ExerciseStepPlaceholder — missing vs unsupported exercise_type
 * (issue: "Distinguish missing vs unsupported exercise_type in
 * fallback").
 *
 * The placeholder must tell two failure modes apart:
 *   - missing      — the exercise has no type (content defect, e.g.
 *                    de/psych-intro before the content fix).
 *   - unsupported  — a non-empty type the app does not render (a real
 *                    "future version" case).
 *
 * Both used to collapse to a single misleading "(unknown) ships in a
 * future version" message.
 */

import {describe, expect, it} from "vitest";
import {render, screen} from "@testing-library/react";

import {ExerciseStepPlaceholder} from "./ExerciseDispatcher";
import {I18nProvider} from "../../hooks/ui/useI18n";
import type {ContentLessonStep} from "../../storage/types";

// The TS union forbids an empty / unknown ``type``; the bug is about
// MALFORMED runtime content that bypasses TS. Cast to build those
// shapes deliberately.
function stepWithType(type: unknown): ContentLessonStep {
    return {
        id: "s1",
        type: "exercise",
        exercise: {
            id: "ex1",
            type,
            prompt: "Was ist ein bedingter Reflex?",
            card_ids: [],
            distractors: [],
        },
    } as unknown as ContentLessonStep;
}

function renderPlaceholder(step: ContentLessonStep) {
    return render(
        <I18nProvider>
            <ExerciseStepPlaceholder step={step} />
        </I18nProvider>,
    );
}

describe("ExerciseStepPlaceholder — missing vs unsupported type", () => {
    it("shows the content-error (missing) message when type is an empty string", () => {
        renderPlaceholder(stepWithType(""));
        expect(
            screen.getByTestId("lesson-exercise-placeholder-missing"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-exercise-placeholder-unsupported"),
        ).toBeNull();
        // Wording is about updating content, NOT a future version.
        expect(
            screen.getByTestId("lesson-exercise-placeholder-missing").textContent,
        ).toMatch(/update the content/i);
    });

    it("treats whitespace-only and null/undefined types as missing too", () => {
        for (const bad of ["   ", null, undefined]) {
            const {unmount} = renderPlaceholder(stepWithType(bad));
            expect(
                screen.getByTestId("lesson-exercise-placeholder-missing"),
            ).toBeInTheDocument();
            unmount();
        }
    });

    it("missing type also when the step carries no exercise at all", () => {
        const step = {id: "s1", type: "exercise"} as ContentLessonStep;
        renderPlaceholder(step);
        expect(
            screen.getByTestId("lesson-exercise-placeholder-missing"),
        ).toBeInTheDocument();
    });

    it("shows the future-version (unsupported) message for a non-empty unknown type", () => {
        renderPlaceholder(stepWithType("crossword"));
        expect(
            screen.getByTestId("lesson-exercise-placeholder-unsupported"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("lesson-exercise-placeholder-missing"),
        ).toBeNull();
        const node = screen.getByTestId(
            "lesson-exercise-placeholder-unsupported",
        );
        expect(node.textContent).toMatch(/future version/i);
        // The concrete type is surfaced (not "unknown").
        expect(node.textContent).toMatch(/crossword/);
    });

    it("keeps the legacy ...-unknown testid for the missing case", () => {
        renderPlaceholder(stepWithType(""));
        expect(
            screen.getByTestId("lesson-exercise-placeholder-unknown"),
        ).toBeInTheDocument();
    });
});
