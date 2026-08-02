/**
 * Test-mode "no writes" proof (#2319): while test mode is active,
 * LessonStepView.handleComplete persists NOTHING - no per-step progress and no
 * per-element SRS / error rows - so a device walk-through cannot pollute the
 * data it is meant to verify. The control case (test mode off) proves the
 * guard is what skips the writes, not that writes never happen.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {createRef} from "react";

const recordBulk = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../storage", () => ({
    getStorage: () => ({elementErrors: {recordBulk}}),
}));

import LessonStepView from "./LessonStepView";
import {LessonModeProvider} from "../../../hooks/lesson/modes/useLessonMode";
import {
    TestModeContext,
    type TestModeContextValue,
} from "../../../hooks/lesson/modes/useTestMode";
import type {ExerciseHandle} from "../../exercises";
import type {
    ContentLesson,
    ContentLessonStep,
    LessonStepResult,
} from "../../../storage/types";
import type {ReadAloudController} from "../../../hooks/lesson/audio/useReadAloud";

const STEP = {
    id: "s1",
    type: "exercise",
    exercise: {
        id: "ex1",
        type: "multiple_choice",
        prompt: "Pick one",
        card_ids: [],
        distractors: [],
        options: [
            {text: "A", correct: true},
            {text: "B"},
        ],
    },
} as unknown as ContentLessonStep;

const LESSON = {
    id: "lesson-1",
    title: "L",
    target_language: "es",
    source_language: "de",
    steps: [STEP],
} as unknown as ContentLesson;

const TTS = {
    supported: false,
    enabled: false,
    voiceAvailable: false,
    speaking: false,
    paused: false,
    activeId: null,
    boundaryIndex: -1,
    speed: 1,
    setSpeed: () => {},
    speak: () => {},
    pause: () => {},
    resume: () => {},
    stop: () => {},
} as unknown as ReadAloudController;

function renderStep(
    testMode: boolean,
    recordStepResult: (r: LessonStepResult) => Promise<void>,
) {
    const ref = createRef<ExerciseHandle>();
    const value: TestModeContextValue = {
        available: testMode,
        enabled: testMode,
        enable: () => {},
        disable: () => {},
    };
    render(
        <TestModeContext.Provider value={value}>
            <LessonModeProvider mode="practice">
                <LessonStepView
                    step={STEP}
                    lesson={LESSON}
                    setId="set-1"
                    lessonFilename="lesson-1.json"
                    source="owner/repo"
                    tts={TTS}
                    precedingTheoryIndex={null}
                    theoryReturnIndex={null}
                    openTheoryFromExercise={() => {}}
                    returnToExercise={() => {}}
                    goToStepById={() => {}}
                    enteredReviewed={false}
                    reviewedRaw={null}
                    progress={null}
                    exerciseRef={ref}
                    learnerUserId="user-1"
                    onInteraction={() => {}}
                    onChecked={() => {}}
                    recordStepResult={recordStepResult}
                    onAdvance={() => {}}
                    advanceLabel="Next"
                />
            </LessonModeProvider>
        </TestModeContext.Provider>,
    );
    return ref;
}

afterEach(() => {
    recordBulk.mockClear();
});

describe("LessonStepView test-mode: no writes", () => {
    it("writes NOTHING when test mode is active", async () => {
        const recordStepResult = vi.fn().mockResolvedValue(undefined);
        const ref = renderStep(true, recordStepResult);
        // Answer, then drive the controlled submit via the exercise ref.
        fireEvent.click(screen.getByTestId("multiple-choice-input-0"));
        await act(async () => {
            ref.current?.submit();
        });
        expect(recordStepResult).not.toHaveBeenCalled();
        expect(recordBulk).not.toHaveBeenCalled();
    });

    it("writes normally when test mode is off (the guard is what skips)", async () => {
        const recordStepResult = vi.fn().mockResolvedValue(undefined);
        const ref = renderStep(false, recordStepResult);
        fireEvent.click(screen.getByTestId("multiple-choice-input-0"));
        await act(async () => {
            ref.current?.submit();
        });
        expect(recordStepResult).toHaveBeenCalledTimes(1);
        expect(recordBulk).toHaveBeenCalledTimes(1);
    });
});
