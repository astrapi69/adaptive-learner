/**
 * LessonExamNotice (#3742): exam mode moves on after each answer without
 * saying right or wrong and has no way back; the learner is told before
 * the first answer, not left to read it as a bug.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LessonExamNotice from "./LessonExamNotice";
import type {LessonProgress} from "../../storage/types";

function row(status: string, answered: number): LessonProgress {
    const step_results: Record<string, unknown> = {};
    for (let i = 0; i < answered; i++) step_results[`ex-${i}`] = {correct: 1, total: 1};
    return {status, step_results} as unknown as LessonProgress;
}

describe("LessonExamNotice (#3742)", () => {
    it.each([
        ["exam, fresh lesson", "exam", null, true],
        ["exam, run restarted (no answers)", "exam", row("in_progress", 0), true],
        ["exam, first answer given", "exam", row("in_progress", 1), false],
        ["exam, completed run reopened", "exam", row("completed", 3), true],
        ["practice, fresh lesson", "practice", null, false],
        ["timed, fresh lesson", "timed", null, false],
    ] as const)("%s", (_name, mode, progress, shown) => {
        render(<LessonExamNotice lessonMode={mode} progress={progress} />);
        const notice = screen.queryByTestId("lesson-exam-notice");
        if (shown) {
            expect(notice).toHaveTextContent(
                "Exam: you only see at the end whether an answer was right, and you cannot go back.",
            );
        } else {
            expect(notice).toBeNull();
        }
    });

    // #3752 - the first answer is saved asynchronously; waiting for it left
    // the notice on the next step for a frame, and its removal moved that
    // step's options up 60 px after they were painted.
    const STEPS = [{type: "theory"}, {type: "exercise"}, {type: "exercise"}];
    it.each([
        ["on the theory step", 0, true],
        ["on the first exercise", 1, true],
        ["past the first exercise, answer not stored yet", 2, false],
    ] as const)("exam, %s", (_name, currentStepIndex, shown) => {
        render(
            <LessonExamNotice
                lessonMode="exam"
                progress={null}
                steps={STEPS}
                currentStepIndex={currentStepIndex}
            />,
        );
        expect(screen.queryByTestId("lesson-exam-notice") !== null).toBe(shown);
    });
});
