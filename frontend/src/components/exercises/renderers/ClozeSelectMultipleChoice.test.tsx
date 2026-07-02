/**
 * Canonical single-answer multiple-choice = a one-blank ``cloze`` in
 * ``select`` mode (astrapi69/adaptive-learner#890 / EXP-036 §4.3): the
 * options are the correct answer + ``distractors``, rendered as one
 * ``<select>``, graded and recorded through ``ClozeExercise``.
 *
 * These tests lock the full MC flow — render options, grade correct, grade
 * wrong (feedback), report the SRS attempt, advance — after the
 * React-Grundlagen set was corrected from ``picture_choice`` (an image
 * picker whose missing assets rendered as placeholders) to this canonical
 * MC form (astrapi69/adaptive-learner-content-test#10).
 */
import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {createRef} from "react";
import {describe, expect, it, vi} from "vitest";

import ClozeExercise from "./ClozeExercise";
import type {ExerciseHandle} from "../shell/exercise-control";
import type {ContentLessonExercise} from "../../../storage/types";

const MC: ContentLessonExercise = {
    id: "ex-mc-usestate",
    type: "cloze",
    prompt: "Welcher Hook verwaltet lokalen State in einer Funktionskomponente?",
    card_ids: ["card-usestate"],
    sentence: "___",
    blanks: [{accept: ["useState"]}],
    cloze_mode: "select",
    distractors: ["useEffect", "useContext", "useRef"],
};

describe("multiple-choice via cloze-select — full flow", () => {
    it("renders one select whose options are the correct answer + distractors (single answer)", () => {
        render(<ClozeExercise exercise={MC} onComplete={vi.fn()} />);
        expect(screen.getByTestId("cloze-exercise")).toHaveAttribute(
            "data-cloze-mode",
            "select",
        );
        // Single-answer MC: exactly one blank / one <select>.
        expect(screen.getByTestId("cloze-select-0")).toBeInTheDocument();
        expect(screen.queryByTestId("cloze-select-1")).not.toBeInTheDocument();
        const values = Array.from(
            (screen.getByTestId("cloze-select-0") as HTMLSelectElement).options,
        ).map((o) => o.value);
        expect(values).toContain("useState");
        for (const distractor of MC.distractors ?? []) {
            expect(values).toContain(distractor);
        }
    });

    it("grades the correct option as correct", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MC} onComplete={onComplete} />);
        fireEvent.change(screen.getByTestId("cloze-select-0"), {
            target: {value: "useState"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("grades a wrong option as wrong and shows feedback", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MC} onComplete={onComplete} />);
        fireEvent.change(screen.getByTestId("cloze-select-0"), {
            target: {value: "useEffect"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
    });

    it("reports an SRS element-attempt for the pick (recording)", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MC} onComplete={onComplete} />);
        fireEvent.change(screen.getByTestId("cloze-select-0"), {
            target: {value: "useState"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        const scored = onComplete.mock.calls[0][0];
        expect(Array.isArray(scored.attempts)).toBe(true);
        expect(scored.attempts.length).toBeGreaterThanOrEqual(1);
    });

    it("advances to the next step after a correct pick (Continue)", () => {
        const onAdvance = vi.fn();
        const ref = createRef<ExerciseHandle>();
        render(
            <ClozeExercise
                ref={ref}
                exercise={MC}
                controlled
                onAdvance={onAdvance}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-select-0"), {
            target: {value: "useState"},
        });
        act(() => ref.current!.submit());
        fireEvent.click(screen.getByTestId("cloze-advance"));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });
});
