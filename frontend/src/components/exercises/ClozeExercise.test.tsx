/**
 * Tests for the Cloze exercise renderer
 * (Phase 52D / v1.35.0 / P-127 + F-111).
 *
 * Pins both modes (type + select), per-blank scoring with the
 * existing FreeText Levenshtein-tolerant matcher, the per-blank
 * SRS attempt fan-out, the diff display on wrong blanks, and the
 * empty-state guard.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ClozeExercise from "./ClozeExercise";
import type {ContentLessonExercise} from "../../storage/types";

const SINGLE_BLANK: ContentLessonExercise = {
    id: "ex-cloze-1",
    type: "cloze",
    prompt: "Fill in the article.",
    card_ids: [],
    sentence: "Je vois ___ chat dans le jardin.",
    blanks: [
        {
            accept: ["un", "Un"],
            hint: "indefinite article",
            placeholder: "?",
        },
    ],
    distractors: ["le", "la", "les"],
};

const TWO_BLANKS: ContentLessonExercise = {
    id: "ex-cloze-2",
    type: "cloze",
    prompt: "Fill in both articles.",
    card_ids: [],
    sentence: "J'ai ___ ami et ___ amie.",
    blanks: [
        {accept: ["un"]},
        {accept: ["une"]},
    ],
    distractors: [],
};

const SELECT_MODE: ContentLessonExercise = {
    id: "ex-cloze-sel",
    type: "cloze",
    prompt: "Pick the right article.",
    card_ids: [],
    sentence: "Je vois ___ chat.",
    blanks: [{accept: ["un"]}],
    cloze_mode: "select",
    distractors: ["le", "la", "les"],
};

describe("ClozeExercise: render (type mode default)", () => {
    it("renders prompt + sentence + one input per blank", () => {
        render(
            <ClozeExercise
                exercise={SINGLE_BLANK}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("cloze-prompt")).toHaveTextContent(
            "Fill in the article",
        );
        expect(screen.getByTestId("cloze-sentence")).toBeInTheDocument();
        expect(screen.getByTestId("cloze-input-0")).toBeInTheDocument();
        expect(
            screen.getByTestId("cloze-exercise"),
        ).toHaveAttribute("data-cloze-mode", "type");
    });

    it("renders one input per blank for multi-blank exercises", () => {
        render(
            <ClozeExercise
                exercise={TWO_BLANKS}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("cloze-input-0")).toBeInTheDocument();
        expect(screen.getByTestId("cloze-input-1")).toBeInTheDocument();
    });

    it("#692 auto-focuses the FIRST blank on mount", () => {
        render(<ClozeExercise exercise={TWO_BLANKS} onComplete={vi.fn()} />);
        expect(screen.getByTestId("cloze-input-0")).toHaveFocus();
        expect(screen.getByTestId("cloze-input-1")).not.toHaveFocus();
    });

    it("#692 does not auto-focus a select-mode blank", () => {
        render(<ClozeExercise exercise={SELECT_MODE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("cloze-select-0")).not.toHaveFocus();
    });

    it("applies the monospace code class in code mode (schema v1.3)", () => {
        render(
            <ClozeExercise
                exercise={SINGLE_BLANK}
                codeMode
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("cloze-sentence")).toHaveClass(
            "cloze-sentence-code",
        );
    });

    it("omits the code class when not in code mode", () => {
        render(
            <ClozeExercise exercise={SINGLE_BLANK} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("cloze-sentence")).not.toHaveClass(
            "cloze-sentence-code",
        );
    });

    it("renders the placeholder character on the input", () => {
        render(
            <ClozeExercise
                exercise={SINGLE_BLANK}
                onComplete={vi.fn()}
            />,
        );
        const input = screen.getByTestId(
            "cloze-input-0",
        ) as HTMLInputElement;
        expect(input.placeholder).toBe("?");
    });

    it("submit is disabled until every blank is filled", () => {
        render(
            <ClozeExercise
                exercise={TWO_BLANKS}
                onComplete={vi.fn()}
            />,
        );
        const submit = screen.getByTestId(
            "cloze-submit",
        ) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        expect(submit.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("cloze-input-1"), {
            target: {value: "une"},
        });
        expect(submit.disabled).toBe(false);
    });

    it("renders an empty-state notice when sentence + blanks are absent", () => {
        const broken: ContentLessonExercise = {
            id: "ex-broken",
            type: "cloze",
            prompt: "",
            card_ids: [],
            sentence: "",
            blanks: [],
            distractors: [],
        };
        render(
            <ClozeExercise exercise={broken} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("cloze-empty")).toBeInTheDocument();
    });
});

describe("ClozeExercise: scoring", () => {
    it("all-correct: reports total/total + result_correct + no diff row", () => {
        const onComplete = vi.fn();
        render(
            <ClozeExercise
                exercise={TWO_BLANKS}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        fireEvent.change(screen.getByTestId("cloze-input-1"), {
            target: {value: "une"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 2, total: 2}),
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(
            screen.queryByTestId("cloze-diff-row"),
        ).not.toBeInTheDocument();
    });

    it("partial: reports correct/total + diff row only for wrong blanks", () => {
        const onComplete = vi.fn();
        render(
            <ClozeExercise
                exercise={TWO_BLANKS}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        fireEvent.change(screen.getByTestId("cloze-input-1"), {
            target: {value: "le"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 2}),
        );
        expect(screen.getByTestId("cloze-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        const diffRow = screen.getByTestId("cloze-diff-row");
        // Only the wrong blank renders a diff — diff row has 1 child.
        expect(diffRow.querySelectorAll("[data-testid='diff-highlight']")).toHaveLength(1);
        // Diff for the second blank contains the canonical "une".
        expect(diffRow).toHaveTextContent("une");
    });

    it("Levenshtein tolerance per blank: single typo still counts as correct", () => {
        const onComplete = vi.fn();
        render(
            <ClozeExercise
                exercise={SINGLE_BLANK}
                onComplete={onComplete}
            />,
        );
        // "un" canonical, "Unn" is Levenshtein 1 → tolerated.
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "Unn"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });

    it("flags each blank's individual data-result after submit", () => {
        render(
            <ClozeExercise
                exercise={TWO_BLANKS}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        fireEvent.change(screen.getByTestId("cloze-input-1"), {
            target: {value: "le"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(screen.getByTestId("cloze-blank-0")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(screen.getByTestId("cloze-blank-1")).toHaveAttribute(
            "data-result",
            "wrong",
        );
    });
});

describe("ClozeExercise: select mode", () => {
    it("renders a <select> per blank with options drawn from accept + distractors", () => {
        render(
            <ClozeExercise
                exercise={SELECT_MODE}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("cloze-exercise"),
        ).toHaveAttribute("data-cloze-mode", "select");
        const sel = screen.getByTestId(
            "cloze-select-0",
        ) as HTMLSelectElement;
        // Canonical + 3 distractors + 1 placeholder = 5 options.
        expect(sel.options.length).toBe(5);
        const values = Array.from(sel.options).map((o) => o.value);
        expect(values).toContain("un");
        expect(values).toContain("le");
        expect(values).toContain("la");
        expect(values).toContain("les");
    });

    it("select-mode submit scores against the chosen option", () => {
        const onComplete = vi.fn();
        render(
            <ClozeExercise
                exercise={SELECT_MODE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-select-0"), {
            target: {value: "un"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });
});

describe("ClozeExercise: multiselect dispatch (#1195)", () => {
    const MULTISELECT: ContentLessonExercise = {
        id: "ex-cloze-ms",
        type: "cloze",
        cloze_mode: "multiselect",
        prompt: "Select all that apply.",
        card_ids: [],
        sentence: "Which cities are in Germany?",
        accept: ["Berlin", "Hamburg"],
        distractors: ["Vienna", "Zurich"],
    };

    it("routes a multiselect cloze to the checkbox renderer, not the blank one", () => {
        render(<ClozeExercise exercise={MULTISELECT} onComplete={vi.fn()} />);
        expect(
            screen.getByTestId("cloze-multiselect-exercise"),
        ).toBeInTheDocument();
        // The blank-based renderer must NOT mount for multiselect.
        expect(screen.queryByTestId("cloze-exercise")).not.toBeInTheDocument();
        expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    });

    it("scores the dispatched multiselect end to end", () => {
        const onComplete = vi.fn();
        render(<ClozeExercise exercise={MULTISELECT} onComplete={onComplete} />);
        fireEvent.click(screen.getByRole("checkbox", {name: "Berlin"}));
        fireEvent.click(screen.getByRole("checkbox", {name: "Hamburg"}));
        fireEvent.click(screen.getByTestId("cloze-multiselect-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
    });
});

describe("ClozeExercise: attempts fan-out", () => {
    it("emits one ElementAttempt per blank with the per-blank canonical", () => {
        const onComplete = vi.fn();
        render(
            <ClozeExercise
                exercise={TWO_BLANKS}
                setId="set-x"
                lessonId="lesson-y"
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "un"},
        });
        fireEvent.change(screen.getByTestId("cloze-input-1"), {
            target: {value: "le"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        const call = onComplete.mock.calls[0][0];
        expect(call.attempts).toHaveLength(2);
        expect(call.attempts[0]).toEqual(
            expect.objectContaining({
                set_id: "set-x",
                lesson_id: "lesson-y",
                exercise_id: "ex-cloze-2",
                element_key: "un",
                user_answer: "un",
                correct: true,
            }),
        );
        expect(call.attempts[1]).toEqual(
            expect.objectContaining({
                element_key: "une",
                user_answer: "le",
                correct: false,
            }),
        );
    });
});

describe("ClozeExercise: retry resets state", () => {
    it("retry clears inputs and returns to the input phase", () => {
        render(
            <ClozeExercise
                exercise={SINGLE_BLANK}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId("cloze-input-0"), {
            target: {value: "wrong"},
        });
        fireEvent.click(screen.getByTestId("cloze-submit"));
        expect(screen.getByTestId("cloze-result")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("cloze-retry"));
        expect(
            screen.queryByTestId("cloze-result"),
        ).not.toBeInTheDocument();
        const input = screen.getByTestId(
            "cloze-input-0",
        ) as HTMLInputElement;
        expect(input.value).toBe("");
    });
});

describe("ClozeExercise: Tab advances to the next blank (#623)", () => {
    it("focuses the next blank input on Tab", () => {
        render(<ClozeExercise exercise={TWO_BLANKS} onComplete={vi.fn()} />);
        const first = screen.getByTestId("cloze-input-0");
        const second = screen.getByTestId("cloze-input-1");
        first.focus();
        fireEvent.keyDown(first, {key: "Tab"});
        expect(document.activeElement).toBe(second);
    });

    it("does not intercept Tab on the last blank (native flow)", () => {
        render(<ClozeExercise exercise={TWO_BLANKS} onComplete={vi.fn()} />);
        const second = screen.getByTestId("cloze-input-1");
        second.focus();
        const ev = fireEvent.keyDown(second, {key: "Tab"});
        // Not prevented -> the browser's native tab order takes over.
        expect(ev).toBe(true);
    });

    it("ignores shift-Tab (lets focus move backward natively)", () => {
        render(<ClozeExercise exercise={TWO_BLANKS} onComplete={vi.fn()} />);
        const second = screen.getByTestId("cloze-input-1");
        second.focus();
        fireEvent.keyDown(second, {key: "Tab", shiftKey: true});
        expect(document.activeElement).toBe(second);
    });
});
