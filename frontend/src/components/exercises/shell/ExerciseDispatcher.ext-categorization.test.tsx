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

    it("an unadopted ext type still falls to the unsupported placeholder", () => {
        renderDispatcher(extStep("ext:acme-cards"));
        expect(
            screen.getByTestId("lesson-exercise-placeholder-unsupported"),
        ).toBeInTheDocument();
    });
});
