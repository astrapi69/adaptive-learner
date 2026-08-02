/**
 * Test-mode coercion seam (#2319): the shared exercise lifecycle accepts any
 * answer as correct while test mode is active, and reports the real verdict
 * otherwise. Proven through the hook itself with a tiny harness (decoupled
 * from any specific renderer).
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {useRef} from "react";

import {useControlledExercise} from "./useControlledExercise";
import {TestModeContext} from "../../hooks/lesson/modes/useTestMode";
import type {
    ExerciseHandle,
    ExerciseScored,
} from "../../components/exercises/shell/exercise-control";

/** A wrong answer: 0 of 1 correct, the single attempt marked incorrect. */
function wrongScore(): ExerciseScored {
    return {
        correct: 0,
        total: 1,
        attempts: [
            {
                set_id: "s",
                lesson_id: "l",
                exercise_id: "e",
                direction: "source_to_target",
                element_key: "k",
                element_type: "vocabulary",
                user_answer: "wrong",
                correct_answer: "right",
                correct: false,
            },
        ],
        raw_answer: undefined,
    };
}

function Harness({onComplete}: {onComplete: (s: ExerciseScored) => void}) {
    const ref = useRef<ExerciseHandle>(null);
    const {result, submit} = useControlledExercise({
        ref,
        controlled: false,
        isAnswerable: true,
        onComplete,
        score: wrongScore,
    });
    return (
        <>
            <span data-testid="result">
                {result ? `${result.correct}/${result.total}` : "none"}
            </span>
            <button data-testid="submit" onClick={submit}>
                submit
            </button>
        </>
    );
}

function renderWith(enabled: boolean, onComplete: (s: ExerciseScored) => void) {
    return render(
        <TestModeContext.Provider
            value={{
                available: enabled,
                enabled,
                enable: () => {},
                disable: () => {},
            }}
        >
            <Harness onComplete={onComplete} />
        </TestModeContext.Provider>,
    );
}

describe("useControlledExercise: test-mode coercion", () => {
    it("reports the REAL (wrong) verdict when test mode is off", () => {
        const onComplete = vi.fn();
        renderWith(false, onComplete);
        fireEvent.click(screen.getByTestId("submit"));
        expect(screen.getByTestId("result").textContent).toBe("0/1");
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0}),
        );
        expect(onComplete.mock.calls[0][0].attempts[0].correct).toBe(false);
    });

    it("accepts a wrong answer as correct when test mode is on", () => {
        const onComplete = vi.fn();
        renderWith(true, onComplete);
        fireEvent.click(screen.getByTestId("submit"));
        expect(screen.getByTestId("result").textContent).toBe("1/1");
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
        expect(onComplete.mock.calls[0][0].attempts[0].correct).toBe(true);
    });
});
