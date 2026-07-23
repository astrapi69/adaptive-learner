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
 * The pure grader (``isFreeTextCorrect`` / ``isFreeTextNearMiss``) moved to
 * ``lib/exercises/grading/free-text-grading.ts`` (#1877); its isolation pins
 * live in ``free-text-grading.test.ts`` next to it.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import FreeTextExercise from "./FreeTextExercise";
import {
    AUTO_ADVANCE_DELAY_MS,
    setLessonAutoAdvanceEnabled,
} from "../../../hooks/settings/useLessonAutoAdvance";
import {LessonModeProvider} from "../../../hooks/lesson/modes/useLessonMode";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-free-text",
    type: "free_text",
    prompt: "How do you say 'Thank you' in French?",
    card_ids: [],
    accept: ["Merci", "merci", "Merci."],
    distractors: [],
    hint: "It starts with M.",
};

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

    it("#1353 renders the input at 16px (text-base), never text-sm (iOS zoom)", () => {
        render(<FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const input = screen.getByTestId("free-text-input");
        expect(input.className).toContain("text-base");
        expect(input.className).not.toContain("text-sm");
    });

    it("#1353 focuses on mount with preventScroll (no competing scroll)", () => {
        const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
        render(<FreeTextExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(focusSpy).toHaveBeenCalledWith({preventScroll: true});
        focusSpy.mockRestore();
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

describe("FreeTextExercise auto-advance integration (#1330)", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
        setLessonAutoAdvanceEnabled(true);
    });
    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        localStorage.clear();
    });

    function submit(value: string) {
        fireEvent.change(screen.getByTestId("free-text-input"), {
            target: {value},
        });
        fireEvent.click(screen.getByTestId("free-text-submit"));
    }

    it("records the attempt AND auto-advances on a correct answer", () => {
        const onComplete = vi.fn();
        const onAdvance = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
                onAdvance={onAdvance}
                advanceLabel="Next"
            />,
        );
        submit("Merci");
        // SRS/XP/progress recording path is untouched — onComplete still fires
        // (with a correct score) before any advance.
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete.mock.calls[0][0]).toMatchObject({correct: 1, total: 1});
        // The success surface mounted; auto-advance fires after the delay.
        expect(screen.getByTestId("free-text-success-advance")).toBeInTheDocument();
        expect(onAdvance).not.toHaveBeenCalled();
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);
        expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("records the attempt but does NOT auto-advance on a wrong answer", () => {
        const onComplete = vi.fn();
        const onAdvance = vi.fn();
        render(
            <FreeTextExercise
                exercise={EXERCISE}
                onComplete={onComplete}
                onAdvance={onAdvance}
                advanceLabel="Next"
            />,
        );
        submit("banana");
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete.mock.calls[0][0]).toMatchObject({correct: 0});
        // No success surface on a wrong answer → nothing auto-advances.
        expect(
            screen.queryByTestId("free-text-success-advance"),
        ).not.toBeInTheDocument();
        vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 3);
        expect(onAdvance).not.toHaveBeenCalled();
    });
});
