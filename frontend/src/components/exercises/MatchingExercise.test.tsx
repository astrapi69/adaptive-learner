/**
 * Tests for the Matching exercise component
 * (Phase 44 / EXP-002 / 3C / F-106).
 *
 * Pins the tap-to-pair UX + scoring contract:
 * - Counter updates on each pair / unpair.
 * - Tapping a paired tile undoes the pair.
 * - Submit disabled until all pairs are made.
 * - Submit reports {correct, total} to the parent via
 *   onComplete with the right count.
 * - 'Try again' resets state so the user can retry.
 * - Empty pairs surface the empty-state testid.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import MatchingExercise, {
    MATCHING_PAIR_COLORS,
    matchingPairColorVar,
} from "./MatchingExercise";
import type {ContentLessonExercise} from "../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-match",
    type: "matching",
    prompt: "Match each French word with its English translation.",
    card_ids: [],
    pairs: [
        {left: "Bonjour", right: "Hello"},
        {left: "Merci", right: "Thank you"},
        {left: "Au revoir", right: "Goodbye"},
    ],
    distractors: [],
};

beforeEach(() => {
    vi.useRealTimers();
});

describe("MatchingExercise: pair lifecycle", () => {
    it("renders the prompt + counter + columns", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        expect(screen.getByTestId("matching-prompt")).toHaveTextContent(
            "Match each French word",
        );
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
        expect(screen.getByTestId("matching-left")).toBeInTheDocument();
        expect(screen.getByTestId("matching-right")).toBeInTheDocument();
    });

    it("shows instructions + visible column headers (UX bugfix)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        expect(
            screen.getByTestId("matching-instructions"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("matching-left-header"),
        ).toHaveTextContent("Term");
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Translation");
    });

    it("hides the first-pair flow hint once a pair is made", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        expect(screen.getByTestId("matching-flow-hint")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(
            screen.queryByTestId("matching-flow-hint"),
        ).not.toBeInTheDocument();
    });

    it("counter increments on each tap-pair", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /1\s*\/\s*3/,
        );
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /2\s*\/\s*3/,
        );
    });

    it("tapping a paired left undoes the pair", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /1\s*\/\s*3/,
        );
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
    });

    it("submit button disabled until all pairs made", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const submit = screen.getByTestId("matching-submit");
        expect(submit).toBeDisabled();
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(submit).toBeDisabled();
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        expect(submit).not.toBeDisabled();
    });
});

describe("MatchingExercise: scoring + completion", () => {
    it("reports {correct, total} on submit with all correct", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 3, total: 3}));
        expect(screen.getByTestId("matching-result")).toHaveTextContent(
            /3\s*\/\s*3/,
        );
    });

    it("scores wrong pairs as incorrect", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        // 0→1 (wrong), 1→0 (wrong), 2→2 (correct)
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 3}));
    });

    it("keeps pair badges visible and marks correct pairs green on BOTH sides after checking (#183)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        // Badges persist after submit (used to vanish), once per side.
        expect(screen.getAllByTestId("matching-pair-badge-1")).toHaveLength(2);
        // Both tiles of each correct pair are flagged correct.
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "is-correct",
        );
        expect(screen.getByTestId("matching-right-0").className).toContain(
            "is-correct",
        );
        // No spurious correct-partner hint when everything is right.
        expect(
            screen.queryByTestId("matching-correct-hint-0"),
        ).not.toBeInTheDocument();
    });

    it("marks wrong pairs red on both sides and shows the correct partner (#183)", () => {
        render(
            <MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />,
        );
        // 0→1 (wrong), 1→0 (wrong), 2→2 (correct)
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        // The wrongly-paired left + the right it chose are both flagged wrong.
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "is-wrong",
        );
        expect(screen.getByTestId("matching-right-1").className).toContain(
            "is-wrong",
        );
        // #191 — the wrong pair spells out BOTH sides: the learner picked
        // right-1 ("Thank you") for left-0, whose correct partner is "Hello".
        expect(
            screen.getByTestId("matching-your-answer-0"),
        ).toHaveTextContent("Thank you");
        expect(
            screen.getByTestId("matching-correct-hint-0"),
        ).toHaveTextContent("Hello");
        // The one correct pair stays green on both sides.
        expect(screen.getByTestId("matching-left-2").className).toContain(
            "is-correct",
        );
        expect(screen.getByTestId("matching-right-2").className).toContain(
            "is-correct",
        );
        // Badges still present after checking.
        expect(
            screen.getAllByTestId("matching-pair-badge-1").length,
        ).toBeGreaterThan(0);
    });

    it("'Try again' resets state and re-enables interaction", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByTestId(`matching-left-${i}`));
            fireEvent.click(screen.getByTestId(`matching-right-${i}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        fireEvent.click(screen.getByTestId("matching-retry"));
        expect(screen.getByTestId("matching-counter")).toHaveTextContent(
            /0\s*\/\s*3/,
        );
        expect(screen.getByTestId("matching-submit")).toBeDisabled();
    });
});

describe("MatchingExercise: edge cases", () => {
    it("renders empty state when pairs is missing", () => {
        render(
            <MatchingExercise
                exercise={{
                    ...EXERCISE,
                    pairs: [],
                }}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("matching-empty")).toBeInTheDocument();
    });
});

describe("MatchingExercise: selection visibility + language labels + a11y (UX bugfix)", () => {
    it("selecting a left tile marks it is-selected + aria-pressed", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const tile = screen.getByTestId("matching-left-0");
        expect(tile).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(tile);
        expect(tile.className).toContain("is-selected");
        expect(tile).toHaveAttribute("aria-pressed", "true");
        // Sibling left tiles are not selected.
        expect(screen.getByTestId("matching-left-1")).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    it("announces the current selection to screen readers", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const status = screen.getByTestId("matching-sr-status");
        expect(status).toHaveTextContent("");
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(status).toHaveTextContent(/Bonjour/);
    });

    it("a paired tile gets the is-paired class", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        expect(screen.getByTestId("matching-left-0").className).toContain(
            "is-paired",
        );
    });

    it("column headers show language NAMES when the pair is known", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                targetLanguage="fr"
                sourceLanguage="en"
                onComplete={vi.fn()}
            />,
        );
        // Receptive default: left = target (fr), right = source (en).
        // The exact localised name depends on the UI language; the
        // contract is only that the generic fallbacks are replaced.
        const left = screen.getByTestId("matching-left-header");
        const right = screen.getByTestId("matching-right-header");
        expect(left).not.toHaveTextContent("Term");
        expect(right).not.toHaveTextContent("Translation");
        expect(left.textContent?.length ?? 0).toBeGreaterThan(0);
        expect(right.textContent?.length ?? 0).toBeGreaterThan(0);
    });

    it("falls back to generic labels when the language pair is unknown", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("matching-left-header")).toHaveTextContent(
            "Term",
        );
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Translation");
    });
});

describe("MatchingExercise: side distinction (#108)", () => {
    it("each header carries a non-color A / B letter cue", () => {
        // The two sides are tinted via design tokens; an aria-hidden
        // letter chip in each header reinforces the distinction for
        // color-vision-deficient users (color is not the only signal).
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        const leftChip = screen
            .getByTestId("matching-left-header")
            .querySelector("[aria-hidden='true']");
        const rightChip = screen
            .getByTestId("matching-right-header")
            .querySelector("[aria-hidden='true']");
        expect(leftChip).not.toBeNull();
        expect(rightChip).not.toBeNull();
        expect(leftChip).toHaveTextContent("A");
        expect(rightChip).toHaveTextContent("B");
    });
});

describe("MatchingExercise: knowledge-domain wording (#149)", () => {
    it("uses Term / Definition + a non-translation instruction for a non-language domain", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                domain="psychology"
                targetLanguage="de"
                sourceLanguage="de"
            />,
        );
        expect(
            screen.getByTestId("matching-left-header"),
        ).toHaveTextContent("Term");
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Definition");
        expect(
            screen.getByTestId("matching-instructions").textContent,
        ).not.toMatch(/translation/i);
    });

    it("treats source==target as knowledge even without an explicit domain", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                targetLanguage="de"
                sourceLanguage="de"
            />,
        );
        expect(
            screen.getByTestId("matching-right-header"),
        ).toHaveTextContent("Definition");
    });

    it("keeps the translation wording for a real language pair", () => {
        render(
            <MatchingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                domain="language"
                targetLanguage="es"
                sourceLanguage="de"
            />,
        );
        // Language names render when the pair is known; the generic
        // 'Definition' knowledge label must NOT appear.
        expect(
            screen.getByTestId("matching-right-header").textContent,
        ).not.toContain("Definition");
    });
});

describe("MatchingExercise: per-pair color + label (#145)", () => {
    it("matchingPairColorVar cycles through the red-free matching-pair tokens (#181)", () => {
        expect(matchingPairColorVar(0)).toBe("var(--matching-pair-1)");
        expect(matchingPairColorVar(2)).toBe("var(--matching-pair-3)");
        // Wraps after the last palette entry, never touches --chart-*
        // (which carries red in several themes).
        expect(matchingPairColorVar(MATCHING_PAIR_COLORS)).toBe(
            "var(--matching-pair-1)",
        );
        for (let slot = 0; slot < MATCHING_PAIR_COLORS * 2; slot += 1) {
            expect(matchingPairColorVar(slot)).not.toContain("--chart-");
        }
    });

    it("labels both tiles of a matched pair with the same number", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        // Pair the first left term with its correct right tile.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        // Both tiles now carry the pair-1 badge (color + number).
        expect(
            screen.getAllByTestId("matching-pair-badge-1"),
        ).toHaveLength(2);
    });

    it("assigns the next number to a second pair and frees it on undo", () => {
        render(<MatchingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        expect(screen.getAllByTestId("matching-pair-badge-1")).toHaveLength(2);
        expect(screen.getAllByTestId("matching-pair-badge-2")).toHaveLength(2);
        // Undo the first pair: its slot (1) is released, so a fresh
        // pair reuses it rather than climbing to 3.
        fireEvent.click(screen.getByTestId("matching-left-0"));
        expect(screen.queryAllByTestId("matching-pair-badge-1")).toHaveLength(
            0,
        );
        fireEvent.click(screen.getByTestId("matching-left-2"));
        fireEvent.click(screen.getByTestId("matching-right-2"));
        expect(screen.getAllByTestId("matching-pair-badge-1")).toHaveLength(2);
    });
});
