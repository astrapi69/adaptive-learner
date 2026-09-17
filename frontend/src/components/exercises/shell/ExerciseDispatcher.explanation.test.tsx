/**
 * Integration guard for the #2991 post-answer explanation wiring: the
 * ``ExerciseDispatcher`` shell mounts ``ExerciseExplanation`` ONCE below
 * every renderer and feeds it the graded outcome, so the field renders on
 * every surface without per-renderer wiring. Drives a real multiple_choice
 * step through the real shell, as a lesson would.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {createRef} from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {ExerciseDispatcher} from "./ExerciseDispatcher";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import type {ExerciseHandle} from "./exercise-control";
import type {ContentLessonStep} from "../../../storage/types";

const EXPLANATION = "**Rule:** the adjective follows the noun.";

function mcStep(explanation: string | null): ContentLessonStep {
    return {
        id: "step-mc",
        type: "exercise",
        exercise: {
            id: "ex-mc",
            type: "multiple_choice",
            prompt: "Which is correct?",
            card_ids: [],
            distractors: [],
            options: [
                {text: "el coche rojo", correct: true},
                {text: "el rojo coche"},
            ],
            explanation,
        },
    } as ContentLessonStep;
}

function renderDispatcher(step: ContentLessonStep) {
    return render(
        <I18nProvider>
            <ExerciseDispatcher
                ref={createRef<ExerciseHandle>()}
                step={step}
                setId="es-a1"
                lessonId="01-adjectives.json"
                onComplete={vi.fn(async () => {})}
            />
        </I18nProvider>,
    );
}

const pick = (label: string) => fireEvent.click(screen.getByLabelText(label));
const check = () => fireEvent.click(screen.getByTestId("multiple-choice-submit"));

beforeEach(() => {
    localStorage.clear();
});

describe("ExerciseDispatcher -> post-answer explanation (#2991)", () => {
    it("reproduction: a wrong answer reveals the authored explanation, expanded", () => {
        renderDispatcher(mcStep(EXPLANATION));
        expect(screen.queryByTestId("exercise-explanation")).toBeNull();
        pick("el rojo coche");
        check();
        const section = screen.getByTestId("exercise-explanation");
        expect(section).toHaveAttribute("data-state", "open");
        expect(section).toHaveAttribute("data-outcome", "incorrect");
        expect(screen.getByTestId("exercise-explanation-body")).toHaveTextContent(
            "the adjective follows the noun",
        );
    });

    it("a fully correct answer keeps the explanation collapsed behind the toggle", () => {
        renderDispatcher(mcStep(EXPLANATION));
        pick("el coche rojo");
        check();
        const section = screen.getByTestId("exercise-explanation");
        expect(section).toHaveAttribute("data-state", "collapsed");
        expect(section).toHaveAttribute("data-outcome", "correct");
        expect(screen.queryByTestId("exercise-explanation-body")).toBeNull();
    });

    it("renders no explanation chrome for an exercise without one", () => {
        renderDispatcher(mcStep(null));
        pick("el rojo coche");
        check();
        expect(screen.getByTestId("multiple-choice-result")).toBeInTheDocument();
        expect(screen.queryByTestId("exercise-explanation")).toBeNull();
    });

    it("a revisited step mounts the explanation collapsed", () => {
        render(
            <I18nProvider>
                <ExerciseDispatcher
                    ref={createRef<ExerciseHandle>()}
                    step={mcStep(EXPLANATION)}
                    setId="es-a1"
                    lessonId="01-adjectives.json"
                    reviewed={{kind: "multiple_choice", selected: ["el rojo coche"]}}
                    onComplete={vi.fn(async () => {})}
                />
            </I18nProvider>,
        );
        const section = screen.getByTestId("exercise-explanation");
        expect(section).toHaveAttribute("data-state", "collapsed");
        expect(section).toHaveAttribute("data-outcome", "reviewed");
    });
});
