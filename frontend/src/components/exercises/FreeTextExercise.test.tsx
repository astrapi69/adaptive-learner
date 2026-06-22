/**
 * Tests for the Free-Text exercise component
 * (Phase 45 / EXP-002 / 3E / F-108).
 *
 * Pins:
 * - Render: prompt, input, submit button visible.
 * - Validation: exact-match (case-insensitive, NFC), and
 *   Levenshtein <= 1 typo tolerance.
 * - Submit disabled while input is empty / whitespace.
 * - Enter key submits when input is non-empty.
 * - Wrong attempt surfaces the canonical (first) accept entry.
 * - Hint toggle: shown only when ``exercise.hint`` is set,
 *   reveals the hint, hides itself once revealed.
 * - Try-again resets state.
 * - Empty ``accept`` surfaces the empty-state testid.
 *
 * Also unit-tests the ``isFreeTextCorrect`` matcher in
 * isolation — it is the regression-pin contract for the D1
 * "threshold = 1, case-insensitive, NFC" decision.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import FreeTextExercise, {
    isFreeTextCorrect,
    isFreeTextNearMiss,
} from "./FreeTextExercise";
import {LessonModeProvider} from "../../hooks/lesson/useLessonMode";
import type {ContentLessonExercise} from "../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-free-text",
    type: "free_text",
    prompt: "How do you say 'Thank you' in French?",
    card_ids: [],
    accept: ["Merci", "merci", "Merci."],
    distractors: [],
    hint: "It starts with M.",
};

describe("isFreeTextCorrect (matcher)", () => {
    const accept = ["Merci"] as const;

    it("matches exact authored entry", () => {
        expect(isFreeTextCorrect("Merci", accept)).toBe(true);
    });

    it("matches case-insensitively", () => {
        expect(isFreeTextCorrect("MERCI", accept)).toBe(true);
        expect(isFreeTextCorrect("merci", accept)).toBe(true);
        expect(isFreeTextCorrect("MeRcI", accept)).toBe(true);
    });

    it("trims surrounding whitespace before comparing", () => {
        expect(isFreeTextCorrect("  merci  ", accept)).toBe(true);
        expect(isFreeTextCorrect("\tmerci\n", accept)).toBe(true);
    });

    it("normalises NFC variants", () => {
        // 'é' as combining sequence (U+0065 U+0301) vs precomposed U+00E9
        expect(
            isFreeTextCorrect("café", ["café"]),
        ).toBe(true);
    });

    it("accepts single-edit typos (Levenshtein <= 1)", () => {
        expect(isFreeTextCorrect("Mercii", accept)).toBe(true); // insertion
        expect(isFreeTextCorrect("Merc", accept)).toBe(true); // deletion
        expect(isFreeTextCorrect("Mercy", accept)).toBe(true); // substitution
    });

    it("rejects answers more than one edit away", () => {
        expect(isFreeTextCorrect("Mercii!", accept)).toBe(false); // 2 inserts (i + !)
        expect(isFreeTextCorrect("Mer", accept)).toBe(false); // 2 deletes
        expect(isFreeTextCorrect("Marcy", accept)).toBe(false); // 2 substitutions
    });

    it("rejects empty / whitespace-only input even with a permissive accept list", () => {
        expect(isFreeTextCorrect("", accept)).toBe(false);
        expect(isFreeTextCorrect("   ", accept)).toBe(false);
        expect(isFreeTextCorrect("\n\t", accept)).toBe(false);
    });

    it("matches against any entry in a multi-entry accept list", () => {
        const multi = ["Bonjour", "Salut"];
        expect(isFreeTextCorrect("bonjour", multi)).toBe(true);
        expect(isFreeTextCorrect("salut", multi)).toBe(true);
        expect(isFreeTextCorrect("salu", multi)).toBe(true); // 1 edit from "salut"
        expect(isFreeTextCorrect("hola", multi)).toBe(false);
    });

    it("returns false when accept list is empty", () => {
        expect(isFreeTextCorrect("anything", [])).toBe(false);
    });
});

describe("isFreeTextCorrect (code mode, schema v1.3)", () => {
    const accept = ["print('Hallo Welt')"] as const;

    it("tolerates whitespace differences", () => {
        expect(isFreeTextCorrect("print( 'Hallo Welt' )", accept, true)).toBe(
            true,
        );
        expect(isFreeTextCorrect("print('Hallo Welt')", accept, true)).toBe(
            true,
        );
    });

    it("treats single and double quotes as equivalent", () => {
        expect(isFreeTextCorrect('print("Hallo Welt")', accept, true)).toBe(
            true,
        );
    });

    it("is case-sensitive (code is)", () => {
        // Plain mode would accept this; code mode must not.
        expect(isFreeTextCorrect("PRINT('Hallo Welt')", accept, true)).toBe(
            false,
        );
        expect(isFreeTextCorrect("PRINT('Hallo Welt')", accept, false)).toBe(
            true,
        );
    });

    it("rejects genuinely different code", () => {
        expect(isFreeTextCorrect("println('Hallo Welt')", accept, true)).toBe(
            false,
        );
    });
});

describe("FreeTextExercise: My-answer / Solution toggle (#1005)", () => {
    function submitWrong() {
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "wrongword"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
    }

    it("after a wrong answer, toggles to the accepted-answers solution", () => {
        render(<FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        submitWrong();
        // My-answer view (default) shows the token diff.
        expect(screen.getByTestId("free-text-answer-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("free-text-diff-row")).toBeInTheDocument();
        // Solution view lists the accepted answers.
        fireEvent.click(screen.getByTestId("free-text-solution"));
        const solution = screen.getByTestId("free-text-solution-view");
        expect(solution).toHaveTextContent("Merci");
        expect(screen.queryByTestId("free-text-diff-row")).toBeNull();
    });

    it("hides the toggle in exam mode (no solution reveal)", () => {
        render(
            <LessonModeProvider mode="exam">
                <FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />
            </LessonModeProvider>,
        );
        submitWrong();
        expect(screen.queryByTestId("free-text-answer-toggle")).toBeNull();
        expect(screen.queryByTestId("free-text-diff-row")).toBeNull();
    });
});

describe("FreeTextExercise: render", () => {
    it("renders the prompt + input + submit button", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("free-text-prompt")).toHaveTextContent(
            "How do you say 'Thank you'",
        );
        expect(screen.getByTestId("free-text-input")).toBeInTheDocument();
        expect(
            screen.getByTestId("free-text-submit"),
        ).toBeInTheDocument();
    });

    it("disables submit while the input is empty", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const submit = screen.getByTestId("free-text-submit");
        expect(submit).toBeDisabled();
    });

    it("renders a monospace textarea + language label in code mode", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                codeMode
                codeLanguage="python"
                onComplete={vi.fn()}
            />,
        );
        const input = screen.getByTestId("free-text-input");
        expect(input.tagName).toBe("TEXTAREA");
        expect(input).toHaveClass("free-text-input-code");
        expect(input).toHaveAttribute("spellcheck", "false");
        expect(screen.getByTestId("free-text-code-lang").textContent).toBe(
            "python",
        );
    });

    it("renders a plain text input when not in code mode", () => {
        render(
            <FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("free-text-input").tagName).toBe("INPUT");
    });

    it("#692 auto-focuses the input on mount (type immediately, no click)", () => {
        render(<FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("free-text-input")).toHaveFocus();
    });

    it("#692 auto-focuses the code textarea on mount", () => {
        render(
            <FreeTextExercise exercise={EXERCISE} codeMode onComplete={vi.fn()} />,
        );
        const field = screen.getByTestId("free-text-input");
        expect(field.tagName).toBe("TEXTAREA");
        expect(field).toHaveFocus();
    });

    it("#692 focuses the new input on step change (keyed remount)", () => {
        const second: ContentLessonExercise = {...EXERCISE, id: "ex-2"};
        const {rerender} = render(
            <FreeTextExercise key="ex-1" exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("free-text-input")).toHaveFocus();
        // The dispatcher keys each step by id → a new step remounts the
        // renderer, and the fresh input claims focus.
        rerender(
            <FreeTextExercise key="ex-2" exercise={second} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("free-text-input")).toHaveFocus();
    });

    it("#692 does not focus a reviewed (read-only) field", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "free_text", input: "Merci"}}
            />,
        );
        expect(screen.getByTestId("free-text-input")).not.toHaveFocus();
    });

    it("enables submit once the user types non-whitespace", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const input = screen.getByTestId(
            "free-text-input",
        ) as HTMLInputElement;
        const submit = screen.getByTestId("free-text-submit");
        fireEvent.change(input, {target: {value: "Merci"}});
        expect(submit).not.toBeDisabled();
    });

    it("submit stays disabled for whitespace-only input", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const input = screen.getByTestId("free-text-input");
        const submit = screen.getByTestId("free-text-submit");
        fireEvent.change(input, {target: {value: "   "}});
        expect(submit).toBeDisabled();
    });
});

describe("FreeTextExercise: submit lifecycle", () => {
    it("reports {correct: 1, total: 1} for an exact match", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Merci"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
        expect(screen.getByTestId("free-text-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("reports {correct: 1, total: 1} for a case-insensitive match", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "MERCI"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
    });

    it("reports {correct: 1, total: 1} for a single-edit typo", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Mercii"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
    });

    it("reports {correct: 0, total: 1} for a wrong answer and shows the token diff", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Bonjour"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 0, total: 1}));
        const result = screen.getByTestId("free-text-result");
        expect(result).toHaveAttribute("data-result", "wrong");
        // Phase 52C / v1.35.0 — the canonical surfaces inside the
        // DiffHighlight component sibling, NOT inline in the result
        // paragraph (which is now just "Not quite.").
        expect(result).not.toHaveTextContent("Merci");
        const diffRow = screen.getByTestId("free-text-diff-row");
        expect(diffRow).toBeInTheDocument();
        expect(diffRow).toHaveTextContent("Merci");
    });

    it("Enter key submits when input is non-empty", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        const input = screen.getByTestId("free-text-input");
        fireEvent.change(input, {target: {value: "Merci"}});
        fireEvent.keyDown(input, {key: "Enter"});
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
    });

    it("Enter key does nothing on an empty input", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.keyDown(screen.getByTestId("free-text-input"), {
            key: "Enter",
        });
        expect(onComplete).not.toHaveBeenCalled();
    });

    it("Try-again resets state so the user can retry", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Bonjour"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(screen.getByTestId("free-text-result")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("free-text-retry"));
        expect(
            screen.queryByTestId("free-text-result"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("free-text-input"),
        ).toHaveValue("");
        expect(screen.getByTestId("free-text-submit")).toBeDisabled();
    });

    it("does not call onComplete twice on repeat submit clicks", () => {
        const onComplete = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Merci"},
        });
        const submit = screen.getByTestId("free-text-submit");
        fireEvent.click(submit);
        // After submit the result screen replaces the submit button, so a
        // second click would land on a different element. We assert
        // onComplete was called exactly once instead.
        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});

describe("FreeTextExercise: hint affordance", () => {
    it("renders the hint toggle when exercise.hint is set", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("free-text-hint-show"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("free-text-hint"),
        ).not.toBeInTheDocument();
    });

    it("reveals the hint and hides the toggle on click", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("free-text-hint-show"));
        expect(screen.getByTestId("free-text-hint")).toHaveTextContent(
            "It starts with M.",
        );
        expect(
            screen.queryByTestId("free-text-hint-show"),
        ).not.toBeInTheDocument();
    });

    it("does not render the hint toggle when exercise.hint is absent", () => {
        const noHint: ContentLessonExercise = {...EXERCISE, hint: null};
        render(
            <FreeTextExercise
                exercise={noHint}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.queryByTestId("free-text-hint-show"),
        ).not.toBeInTheDocument();
    });

    it("hides the hint toggle after submit", () => {
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Merci"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        expect(
            screen.queryByTestId("free-text-hint-show"),
        ).not.toBeInTheDocument();
    });
});

describe("FreeTextExercise: edge cases", () => {
    it("renders the empty-state when accept is missing", () => {
        const empty: ContentLessonExercise = {
            ...EXERCISE,
            accept: null,
        };
        render(
            <FreeTextExercise
                exercise={empty}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("free-text-empty")).toBeInTheDocument();
    });

    it("renders the empty-state when accept is an empty list", () => {
        const empty: ContentLessonExercise = {
            ...EXERCISE,
            accept: [],
        };
        render(
            <FreeTextExercise
                exercise={empty}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("free-text-empty")).toBeInTheDocument();
    });
});

describe("isFreeTextNearMiss (#627)", () => {
    const accept = ["Merci"] as const;

    it("is true for a wrong answer within 2 edits", () => {
        expect(isFreeTextNearMiss("Mercxy", accept)).toBe(true);
    });

    it("is false for an accepted answer (already correct)", () => {
        expect(isFreeTextNearMiss("Merci", accept)).toBe(false);
        // ≤1-edit typo is accepted, so not a "near miss".
        expect(isFreeTextNearMiss("Merc", accept)).toBe(false);
    });

    it("is false for a far miss", () => {
        expect(isFreeTextNearMiss("banana", accept)).toBe(false);
    });

    it("is false for empty input", () => {
        expect(isFreeTextNearMiss("", accept)).toBe(false);
    });
});

describe("FreeTextExercise: near-miss feedback (#627)", () => {
    it("shows 'Almost!' on a near-miss wrong answer", () => {
        render(<FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "Mercxy"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        const result = screen.getByTestId("free-text-result");
        expect(result).toHaveAttribute("data-result", "wrong");
        expect(result).toHaveTextContent("Almost!");
    });

    it("shows 'Not quite.' on a far-miss wrong answer", () => {
        render(<FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value: "banana"},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
        const result = screen.getByTestId("free-text-result");
        expect(result).toHaveAttribute("data-result", "wrong");
        expect(result).toHaveTextContent("Not quite.");
    });
});
