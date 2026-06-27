/**
 * Tests for the Cloze multiselect renderer (#1195).
 *
 * Pins the checkbox-group render, the empty-submission guard, exact-set
 * scoring (all correct vs missing vs extra), the per-option resolution
 * verdicts (correct / wrong / missed), the raw_answer + single SRS
 * attempt, and the reviewed (read-only) restore.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ClozeMultiSelect from "./ClozeMultiSelect";
import type {ContentLessonExercise} from "../../../storage/types";

const MULTISELECT: ContentLessonExercise = {
    id: "ex-ms-1",
    type: "cloze",
    cloze_mode: "multiselect",
    prompt: "Select all that apply.",
    card_ids: [],
    sentence: "Which cities are in Germany?",
    accept: ["Berlin", "Hamburg"],
    distractors: ["Vienna", "Zurich"],
};

const checkbox = (name: string) =>
    screen.getByRole("checkbox", {name}) as HTMLInputElement;

const verdictOf = (name: string) =>
    checkbox(name).closest("label")?.getAttribute("data-verdict");

describe("ClozeMultiSelect: render", () => {
    it("renders the question + instruction + one checkbox per option", () => {
        render(<ClozeMultiSelect exercise={MULTISELECT} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("cloze-multiselect-question"),
        ).toHaveTextContent("Which cities are in Germany?");
        expect(
            screen.getByTestId("cloze-multiselect-instruction"),
        ).toBeInTheDocument();
        // accept (2) + distractors (2) = 4 checkboxes.
        expect(screen.getAllByRole("checkbox")).toHaveLength(4);
        for (const opt of ["Berlin", "Hamburg", "Vienna", "Zurich"]) {
            expect(checkbox(opt)).toBeInTheDocument();
        }
        expect(
            screen.getByTestId("cloze-multiselect-exercise"),
        ).toHaveAttribute("data-cloze-mode", "multiselect");
    });

    it("renders an empty-state notice when accept is absent", () => {
        const broken: ContentLessonExercise = {
            ...MULTISELECT,
            accept: [],
        };
        render(<ClozeMultiSelect exercise={broken} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("cloze-multiselect-empty"),
        ).toBeInTheDocument();
    });
});

describe("ClozeMultiSelect: empty-submission guard", () => {
    it("disables Check until at least one box is chosen", () => {
        render(<ClozeMultiSelect exercise={MULTISELECT} onComplete={vi.fn()} />);
        const submit = screen.getByTestId(
            "cloze-multiselect-submit",
        ) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.click(checkbox("Berlin"));
        expect(submit.disabled).toBe(false);
        // Unchecking the only choice disables it again.
        fireEvent.click(checkbox("Berlin"));
        expect(submit.disabled).toBe(true);
    });
});

describe("ClozeMultiSelect: exact-set scoring", () => {
    it("all correct chosen, nothing extra -> correct (1/1)", () => {
        const onComplete = vi.fn();
        render(
            <ClozeMultiSelect exercise={MULTISELECT} onComplete={onComplete} />,
        );
        fireEvent.click(checkbox("Berlin"));
        fireEvent.click(checkbox("Hamburg"));
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
        expect(screen.getByTestId("cloze-multiselect-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("a correct option missing -> wrong (0/1)", () => {
        const onComplete = vi.fn();
        render(
            <ClozeMultiSelect exercise={MULTISELECT} onComplete={onComplete} />,
        );
        fireEvent.click(checkbox("Berlin"));
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("cloze-multiselect-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
    });

    it("an extra distractor chosen -> wrong (0/1)", () => {
        const onComplete = vi.fn();
        render(
            <ClozeMultiSelect exercise={MULTISELECT} onComplete={onComplete} />,
        );
        fireEvent.click(checkbox("Berlin"));
        fireEvent.click(checkbox("Hamburg"));
        fireEvent.click(checkbox("Vienna"));
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
    });
});

describe("ClozeMultiSelect: resolution verdicts", () => {
    it("marks chosen-correct, chosen-distractor, and missed-correct", () => {
        render(<ClozeMultiSelect exercise={MULTISELECT} onComplete={vi.fn()} />);
        fireEvent.click(checkbox("Berlin")); // correct, chosen
        fireEvent.click(checkbox("Vienna")); // distractor, chosen
        // Hamburg correct but NOT chosen -> missed.
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        expect(verdictOf("Berlin")).toBe("correct");
        expect(verdictOf("Vienna")).toBe("wrong");
        expect(verdictOf("Hamburg")).toBe("missed");
        // An unchosen distractor stays neutral.
        expect(verdictOf("Zurich")).toBe("neutral");
    });
});

describe("ClozeMultiSelect: raw_answer + attempt", () => {
    it("emits the chosen set + one exact-set SRS attempt", () => {
        const onComplete = vi.fn();
        render(
            <ClozeMultiSelect
                exercise={MULTISELECT}
                setId="set-x"
                lessonId="lesson-y"
                onComplete={onComplete}
            />,
        );
        fireEvent.click(checkbox("Berlin"));
        fireEvent.click(checkbox("Hamburg"));
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        const call = onComplete.mock.calls[0][0];
        expect(call.raw_answer).toEqual({
            kind: "cloze_multiselect",
            selected: ["Berlin", "Hamburg"],
        });
        expect(call.attempts).toHaveLength(1);
        expect(call.attempts[0]).toEqual(
            expect.objectContaining({
                set_id: "set-x",
                lesson_id: "lesson-y",
                exercise_id: "ex-ms-1",
                element_key: "Berlin, Hamburg",
                correct_answer: "Berlin, Hamburg",
                user_answer: "Berlin, Hamburg",
                correct: true,
            }),
        );
    });
});

describe("ClozeMultiSelect: reviewed restore", () => {
    it("restores the chosen set, locks it, and scores it", () => {
        render(
            <ClozeMultiSelect
                exercise={MULTISELECT}
                onComplete={vi.fn()}
                reviewed={{
                    kind: "cloze_multiselect",
                    selected: ["Berlin", "Hamburg"],
                }}
            />,
        );
        expect(checkbox("Berlin").checked).toBe(true);
        expect(checkbox("Hamburg").checked).toBe(true);
        expect(checkbox("Vienna").checked).toBe(false);
        // Locked (read-only) on review.
        expect(checkbox("Berlin").disabled).toBe(true);
        expect(screen.getByTestId("cloze-multiselect-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });
});

describe("ClozeMultiSelect: retry", () => {
    it("clears the chosen set and returns to the answer phase", () => {
        render(<ClozeMultiSelect exercise={MULTISELECT} onComplete={vi.fn()} />);
        fireEvent.click(checkbox("Vienna"));
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        expect(
            screen.getByTestId("cloze-multiselect-result"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("cloze-multiselect-retry"));
        expect(
            screen.queryByTestId("cloze-multiselect-result"),
        ).not.toBeInTheDocument();
        expect(checkbox("Vienna").checked).toBe(false);
    });
});
