/**
 * Tests for the OrderingExercise renderer (#3110, ``ext:al-ordering``).
 *
 * Pins the tap-to-place UX + scoring contract, mirroring
 * WordTilesExercise.test.tsx's shape:
 * - Initial render: prompt + scrambled bar + empty answer placeholder.
 * - Tap a scrambled tile → moves to answer row.
 * - Submit disabled until all items are placed.
 * - Submit reports {correct: 1, total: 1} for the canonical order.
 * - Submit reports {correct: 0, total: 1} for any other order.
 * - Try-again resets state.
 * - reviewed reconstruction restores the exact placed order, locked.
 * - Malformed payload surfaces the empty-state testid.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import OrderingExercise from "./OrderingExercise";
import type {ContentLessonExercise} from "../../../../storage/types";
import {ORDERING_EXT_TYPE} from "../../../../lib/exercises/payload/ordering";

const EXERCISE: ContentLessonExercise = {
    id: "ex-ordering",
    type: ORDERING_EXT_TYPE,
    prompt: "Put the hill-start steps in order.",
    card_ids: [],
    distractors: [],
    ext_payload: {items: ["Engage clutch", "Select gear", "Release clutch"]},
};

describe("OrderingExercise: initial render", () => {
    it("renders the prompt and an empty-answer placeholder", () => {
        render(<OrderingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("ordering-prompt")).toHaveTextContent(
            "Put the hill-start steps in order.",
        );
        expect(screen.getByTestId("ordering-answer-empty")).toBeInTheDocument();
    });

    it("renders one scrambled tile button per item", () => {
        render(<OrderingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("ordering-scrambled-0")).toBeInTheDocument();
        expect(screen.getByTestId("ordering-scrambled-1")).toBeInTheDocument();
        expect(screen.getByTestId("ordering-scrambled-2")).toBeInTheDocument();
    });

    it("surfaces the empty-state testid for a malformed payload", () => {
        const broken: ContentLessonExercise = {...EXERCISE, ext_payload: {items: "not-an-array"}};
        render(<OrderingExercise exercise={broken} onComplete={vi.fn()} />);
        expect(screen.getByTestId("ordering-empty")).toBeInTheDocument();
    });
});

describe("OrderingExercise: tap-to-place + scoring", () => {
    it("disables submit until all items are placed", () => {
        render(<OrderingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        expect(screen.getByTestId("ordering-submit")).toBeDisabled();
        fireEvent.click(screen.getByTestId("ordering-scrambled-0"));
        expect(screen.getByTestId("ordering-submit")).toBeDisabled();
        fireEvent.click(screen.getByTestId("ordering-scrambled-1"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-2"));
        expect(screen.getByTestId("ordering-submit")).toBeEnabled();
    });

    it("reports {correct: 1, total: 1} for the canonical order", () => {
        const onComplete = vi.fn();
        render(<OrderingExercise exercise={EXERCISE} onComplete={onComplete} />);
        fireEvent.click(screen.getByTestId("ordering-scrambled-0"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-1"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-2"));
        fireEvent.click(screen.getByTestId("ordering-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({
                correct: 1,
                total: 1,
                raw_answer: {kind: "al_ordering", placed: [0, 1, 2]},
            }),
        );
        expect(screen.getByTestId("ordering-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("reports {correct: 0, total: 1} for a wrong order", () => {
        const onComplete = vi.fn();
        render(<OrderingExercise exercise={EXERCISE} onComplete={onComplete} />);
        fireEvent.click(screen.getByTestId("ordering-scrambled-1"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-0"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-2"));
        fireEvent.click(screen.getByTestId("ordering-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
        expect(screen.getByTestId("ordering-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
    });

    it("try-again resets the placed tiles", () => {
        render(<OrderingExercise exercise={EXERCISE} onComplete={vi.fn()} />);
        fireEvent.click(screen.getByTestId("ordering-scrambled-1"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-0"));
        fireEvent.click(screen.getByTestId("ordering-scrambled-2"));
        fireEvent.click(screen.getByTestId("ordering-submit"));
        fireEvent.click(screen.getByTestId("ordering-retry"));
        expect(screen.getByTestId("ordering-answer-empty")).toBeInTheDocument();
        expect(screen.getByTestId("ordering-submit")).toBeDisabled();
    });
});

describe("OrderingExercise: reviewed (revisited, locked) reconstruction", () => {
    it("restores the exact placed order and shows the locked result", () => {
        render(
            <OrderingExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                reviewed={{kind: "al_ordering", placed: [0, 1, 2]}}
            />,
        );
        expect(screen.getByTestId("ordering-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
        expect(screen.queryByTestId("ordering-scrambled-row")).not.toBeInTheDocument();
    });
});
