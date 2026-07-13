/**
 * Dispatcher routing for the adopted extension type ext:al-categorization
 * (#1579): an adopted ext exercise reaches its renderer; an unadopted ext
 * type still lands on the "unsupported" placeholder (the render-time
 * backstop of the loud-refusal contract).
 */

import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";

import {ExerciseDispatcher} from "./ExerciseDispatcher";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import type {ContentLessonStep} from "../../../storage/types";

function extStep(type: string): ContentLessonStep {
    return {
        id: "s1",
        type: "exercise",
        exercise: {
            id: "ex1",
            type,
            prompt: "Ordne zu.",
            card_ids: [],
            distractors: [],
            ext_payload: {
                categories: [
                    {name: "Sichtzeichen", items: ["flache Hand"]},
                    {name: "Hoerzeichen", items: ["Sitz"]},
                ],
            },
        },
    } as unknown as ContentLessonStep;
}

function renderDispatcher(step: ContentLessonStep) {
    return render(
        <I18nProvider>
            <ExerciseDispatcher
                step={step}
                setId="set-1"
                lessonId="lesson-1"
                onComplete={vi.fn()}
            />
        </I18nProvider>,
    );
}

describe("ExerciseDispatcher — ext:al-categorization routing (#1579)", () => {
    it("routes the adopted extension type to the categorization renderer", () => {
        renderDispatcher(extStep("ext:al-categorization"));
        expect(screen.getByTestId("categorization-exercise")).toBeInTheDocument();
    });

    it("routes ext:al-error-correction to its renderer (#1579 second adoption)", () => {
        const step = {
            id: "s2",
            type: "exercise",
            exercise: {
                id: "ex2",
                type: "ext:al-error-correction",
                prompt: "Ein Wort ist falsch.",
                card_ids: [],
                distractors: [],
                ext_payload: {
                    tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
                    error_index: 3,
                    accept: ["dem"],
                },
            },
        } as unknown as ContentLessonStep;
        renderDispatcher(step);
        expect(
            screen.getByTestId("error-correction-exercise"),
        ).toBeInTheDocument();
    });

    it("routes ext:al-reading-comprehension to its renderer (#1579 third adoption)", () => {
        const step = {
            id: "s3",
            type: "exercise",
            exercise: {
                id: "ex3",
                type: "ext:al-reading-comprehension",
                prompt: "Lies und antworte.",
                card_ids: [],
                distractors: [],
                ext_payload: {
                    passage: "Rex lief in den Garten.",
                    questions: [
                        {
                            prompt: "Wohin?",
                            type: "multiple_choice",
                            options: [{ text: "Garten", correct: true }, { text: "Strasse" }],
                        },
                    ],
                },
            },
        } as unknown as ContentLessonStep;
        renderDispatcher(step);
        expect(
            screen.getByTestId("reading-comprehension-exercise"),
        ).toBeInTheDocument();
    });

    it("routes ext:al-graded-quiz to its renderer (#1579 fourth adoption)", () => {
        const step = {
            id: "s4",
            type: "exercise",
            exercise: {
                id: "ex4",
                type: "ext:al-graded-quiz",
                prompt: "Quiz.",
                card_ids: [],
                distractors: [],
                ext_payload: {
                    pass_threshold: 60,
                    questions: [
                        { prompt: "2+2?", type: "multiple_choice", options: [{ text: "4", correct: true }, { text: "5" }], points: 2 },
                    ],
                },
            },
        } as unknown as ContentLessonStep;
        renderDispatcher(step);
        expect(screen.getByTestId("graded-quiz-exercise")).toBeInTheDocument();
    });

    it("an unadopted ext type still falls to the unsupported placeholder", () => {
        renderDispatcher(extStep("ext:acme-cards"));
        expect(
            screen.getByTestId("lesson-exercise-placeholder-unsupported"),
        ).toBeInTheDocument();
    });
});
