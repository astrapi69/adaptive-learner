/**
 * Canonical single-answer multiple-choice = a one-blank `cloze` in `select`
 * mode (astrapi69/adaptive-learner#890 / EXP-036 §4.3). The options are the
 * correct answer + `distractors`; the data model is unchanged.
 *
 * Presentation (#1341): the options render as a tappable **button
 * radiogroup** (`ChoiceButtonGroup`), NOT a native `<select>` — the dropdown
 * mis-hit taps on iOS. These tests lock the full MC flow on the button UI:
 * render options / tap-select / grade correct / grade wrong + feedback / SRS
 * attempt / advance / lock after submit / long-text wrap.
 */
import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen, within} from "@testing-library/react";
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

function pick(name: string) {
    fireEvent.click(screen.getByRole("radio", {name}));
}

describe("multiple-choice via cloze-select — button radiogroup (#1341)", () => {
    it("renders the options as buttons (correct + distractors), one radiogroup, no native <select>", () => {
        render(<ClozeExercise exercise={MC} onComplete={vi.fn()} />);
        expect(screen.getByTestId("cloze-exercise")).toHaveAttribute(
            "data-cloze-mode",
            "select",
        );
        // No native <select> anymore.
        expect(screen.queryByTestId("cloze-select-0")).not.toBeInTheDocument();
        // Exactly one radiogroup for the single blank.
        const group = screen.getByTestId("cloze-choices-0");
        expect(group).toHaveAttribute("role", "radiogroup");
        expect(screen.queryByTestId("cloze-choices-1")).not.toBeInTheDocument();
        const names = within(group)
            .getAllByRole("radio")
            .map((b) => b.textContent);
        expect(names).toContain("useState");
        for (const distractor of MC.distractors ?? []) {
            expect(names).toContain(distractor);
        }
        expect(names).toHaveLength(4);
    });

    it("tapping an option selects it (visible selected state)", () => {
        render(<ClozeExercise exercise={MC} onComplete={vi.fn()} />);
        const btn = screen.getByRole("radio", {name: "useEffect"});
        expect(btn).toHaveAttribute("aria-checked", "false");
        fireEvent.click(btn);
        expect(btn).toHaveAttribute("aria-checked", "true");
        expect(btn).toHaveAttribute("data-selected", "true");
    });

    it("grades the correct option as correct (button shows the correct state)", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MC} onComplete={onComplete} />);
        pick("useState");
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(screen.getByRole("radio", {name: "useState"})).toHaveAttribute(
            "data-state",
            "correct",
        );
    });

    it("grades a wrong option as wrong, marks it, and reveals the correct one", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MC} onComplete={onComplete} />);
        pick("useEffect");
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        expect(screen.getByRole("radio", {name: "useEffect"})).toHaveAttribute(
            "data-state",
            "wrong",
        );
        expect(screen.getByRole("radio", {name: "useState"})).toHaveAttribute(
            "data-state",
            "correct",
        );
    });

    it("reports an SRS element-attempt for the pick (recording)", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MC} onComplete={onComplete} />);
        pick("useState");
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
        pick("useState");
        act(() => ref.current!.submit());
        fireEvent.click(screen.getByTestId("cloze-advance"));
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("locks the options after submit (a later tap cannot change the grade)", () => {
        render(<ClozeExercise exercise={MC} onComplete={vi.fn()} />);
        pick("useEffect");
        fireEvent.click(screen.getByTestId("cloze-submit"));
        // Tapping the correct option after submit must not re-grade.
        fireEvent.click(screen.getByRole("radio", {name: "useState"}));
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
    });

    it("wraps a long option instead of truncating it", () => {
        const longMC: ContentLessonExercise = {
            ...MC,
            id: "ex-mc-long",
            blanks: [
                {
                    accept: [
                        "Ein sehr langer Antworttext, der über mehrere Zeilen umbrechen muss und nicht abgeschnitten werden darf",
                    ],
                },
            ],
            distractors: ["kurz", "auch kurz", "noch kürzer"],
        };
        render(<ClozeExercise exercise={longMC} onComplete={vi.fn()} />);
        const long = screen.getByRole("radio", {name: /sehr langer Antworttext/});
        expect(long.className).toMatch(/break-words/);
        expect(long.className).toMatch(/whitespace-normal/);
    });
});
