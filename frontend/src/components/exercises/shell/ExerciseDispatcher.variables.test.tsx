/**
 * Dispatcher wiring for parametric exercises (#3109, schema v1.14):
 * ``resolveExerciseVariables`` runs ONCE per attempt, right where the
 * dispatcher extracts ``step.exercise`` - before any renderer sees it -
 * and its output (a concrete, brace-free exercise) is what every renderer
 * receives, unchanged as far as they're concerned.
 */

import "@testing-library/jest-dom/vitest";
import {describe, expect, it, vi, beforeEach, afterEach} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";

import {ExerciseDispatcher} from "./ExerciseDispatcher";
import type {ExerciseDispatcherProps} from "./ExerciseDispatcher";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import type {ContentLessonStep} from "../../../storage/types";

function parametricStep(): ContentLessonStep {
    return {
        id: "s1",
        type: "exercise",
        exercise: {
            id: "e1",
            type: "free_text",
            prompt: "Was ist {{a}} + {{b}}?",
            card_ids: [],
            distractors: [],
            variables: [
                {name: "a", min: 1, max: 20},
                {name: "b", min: 1, max: 20, step: 0.5},
                {name: "sum", expression: "a + b", tolerance: 0.01},
            ],
            accept: ["{{sum}}"],
            explanation: "Die Summe von {{a}} und {{b}} ist {{sum}}.",
        },
    } as unknown as ContentLessonStep;
}

function renderDispatcher(
    step: ContentLessonStep,
    extra: Partial<ExerciseDispatcherProps> = {},
) {
    return render(
        <I18nProvider>
            <ExerciseDispatcher
                step={step}
                setId="set-1"
                lessonId="lesson-1"
                onComplete={vi.fn()}
                {...extra}
            />
        </I18nProvider>,
    );
}

describe("ExerciseDispatcher variables wiring (#3109)", () => {
    let randomSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Fixed draw: random() === 0 picks the minimum for both sampled
        // variables (a=1, b=1), so sum = 2.
        randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    });
    afterEach(() => {
        randomSpy.mockRestore();
    });

    it("substitutes every {{name}} before the exercise reaches its renderer", () => {
        renderDispatcher(parametricStep());
        expect(screen.getByText("Was ist 1 + 1?")).toBeInTheDocument();
        expect(document.body.textContent).not.toContain("{{");
    });

    it("does not re-sample on an unrelated re-render (typing)", () => {
        renderDispatcher(parametricStep());
        expect(screen.getByText("Was ist 1 + 1?")).toBeInTheDocument();
        // A different draw would change the prompt if resolution re-ran.
        randomSpy.mockReturnValue(0.9);
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "2"},
        });
        expect(screen.getByText("Was ist 1 + 1?")).toBeInTheDocument();
    });

    it("grades the substituted accept value within the variable's tolerance", () => {
        const onComplete = vi.fn();
        renderDispatcher(parametricStep(), {onComplete});
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "2.005"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });

    it("records the drawn values on raw_answer.resolved_variables", () => {
        const onComplete = vi.fn();
        renderDispatcher(parametricStep(), {onComplete});
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "2"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                raw_answer: expect.objectContaining({
                    resolved_variables: {a: 1, b: 1, sum: 2},
                }),
            }),
        );
    });

    it("replays the exact persisted instance on revisit, ignoring a fresh random draw", () => {
        // A revisit would draw very different values (max end of range) if
        // resolution re-sampled instead of reusing the persisted ones.
        randomSpy.mockReturnValue(0.999999);
        renderDispatcher(parametricStep(), {
            reviewed: {
                kind: "free_text",
                input: "10",
                resolved_variables: {a: 4, b: 6, sum: 10},
            },
        });
        expect(screen.getByText("Was ist 4 + 6?")).toBeInTheDocument();
    });

    it("records resolved_variables for a non-free_text kind too (multiple_choice)", () => {
        const onComplete = vi.fn();
        const step: ContentLessonStep = {
            id: "s1",
            type: "exercise",
            exercise: {
                id: "e1",
                type: "multiple_choice",
                prompt: "What is {{a}} + {{b}}?",
                card_ids: [],
                distractors: [],
                variables: [
                    {name: "a", min: 1, max: 1},
                    {name: "b", min: 1, max: 1},
                ],
                options: [
                    {text: "{{a}} plus {{b}} equals 2", correct: true},
                    {text: "3", correct: false},
                ],
            },
        } as unknown as ContentLessonStep;
        renderDispatcher(step, {onComplete});
        fireEvent.click(screen.getByTestId("multiple-choice-input-0"));
        fireEvent.click(screen.getByTestId("multiple-choice-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                raw_answer: expect.objectContaining({
                    kind: "multiple_choice",
                    resolved_variables: {a: 1, b: 1},
                }),
            }),
        );
    });

    it("replays the exact persisted instance on a non-free_text revisit (multiple_choice)", () => {
        // A revisit would draw a different instance (max end of range) if
        // resolution re-sampled instead of reusing the persisted ones.
        randomSpy.mockReturnValue(0.999999);
        const step: ContentLessonStep = {
            id: "s1",
            type: "exercise",
            exercise: {
                id: "e1",
                type: "multiple_choice",
                prompt: "What is {{a}} + {{b}}?",
                card_ids: [],
                distractors: [],
                variables: [
                    {name: "a", min: 1, max: 20},
                    {name: "b", min: 1, max: 20},
                ],
                options: [
                    {text: "{{a}} plus {{b}}", correct: true},
                    {text: "nope", correct: false},
                ],
            },
        } as unknown as ContentLessonStep;
        renderDispatcher(step, {
            reviewed: {
                kind: "multiple_choice",
                selected: ["4 plus 6"],
                resolved_variables: {a: 4, b: 6},
            },
        });
        expect(screen.getByText("What is 4 + 6?")).toBeInTheDocument();
    });

    it("leaves a lesson without variables untouched (Jinja2 braces stay literal)", () => {
        const step: ContentLessonStep = {
            id: "s1",
            type: "exercise",
            exercise: {
                id: "e1",
                type: "free_text",
                prompt: "Render the template {{ server }} with Jinja2.",
                card_ids: [],
                distractors: [],
                accept: ["{{ server }}"],
            },
        } as unknown as ContentLessonStep;
        renderDispatcher(step);
        expect(
            screen.getByText("Render the template {{ server }} with Jinja2."),
        ).toBeInTheDocument();
    });
});
