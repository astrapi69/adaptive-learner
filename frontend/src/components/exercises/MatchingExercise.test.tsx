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

import MatchingExercise from "./MatchingExercise";
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
