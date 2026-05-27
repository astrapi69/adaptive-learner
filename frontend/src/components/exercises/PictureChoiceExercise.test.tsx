/**
 * Tests for the Picture Choice exercise component
 * (Phase 44 / EXP-002 / 3D / F-107).
 *
 * Pins selection + scoring + text-only fallback contract.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import PictureChoiceExercise from "./PictureChoiceExercise";
import type {ContentLessonExercise} from "../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-pic",
    type: "picture_choice",
    prompt: "Which image shows 'chat' (cat)?",
    card_ids: [],
    images: [
        {src: "assets/cat.png", label: "Cat", is_correct: "true"},
        {src: "assets/dog.png", label: "Dog"},
        {src: "assets/bird.png", label: "Bird"},
        {src: "assets/fish.png", label: "Fish"},
    ],
    distractors: [],
};

describe("PictureChoiceExercise: render", () => {
    it("renders the prompt + 4 image tiles", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("picture-prompt")).toHaveTextContent(
            "Which image shows 'chat'",
        );
        for (let i = 0; i < 4; i++) {
            expect(
                screen.getByTestId(`picture-choice-${i}`),
            ).toBeInTheDocument();
        }
    });

    it("marks the correct tile via data-correct=true on exactly one", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const correct = screen.getByTestId("picture-choice-0");
        expect(correct.getAttribute("data-correct")).toBe("true");
        for (let i = 1; i < 4; i++) {
            expect(
                screen
                    .getByTestId(`picture-choice-${i}`)
                    .getAttribute("data-correct"),
            ).toBe("false");
        }
    });

    it("submit disabled until a tile is selected", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("picture-submit")).toBeDisabled();
        fireEvent.click(screen.getByTestId("picture-choice-0"));
        expect(screen.getByTestId("picture-submit")).not.toBeDisabled();
    });
});

describe("PictureChoiceExercise: scoring", () => {
    it("reports correct=1 on the correct pick", () => {
        const onComplete = vi.fn();
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(screen.getByTestId("picture-choice-0"));
        fireEvent.click(screen.getByTestId("picture-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
        expect(screen.getByTestId("picture-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("reports correct=0 on a wrong pick + reveals the right answer", () => {
        const onComplete = vi.fn();
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(screen.getByTestId("picture-choice-2"));
        fireEvent.click(screen.getByTestId("picture-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 0, total: 1}));
        expect(screen.getByTestId("picture-result")).toHaveAttribute(
            "data-result",
            "wrong",
        );
        // The correct tile renders the badge after submit so
        // the user sees what the right answer was.
        const correct = screen.getByTestId("picture-choice-0");
        expect(correct.className).toMatch(/is-correct/);
    });

    it("'Try again' resets selection + re-disables submit", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("picture-choice-2"));
        fireEvent.click(screen.getByTestId("picture-submit"));
        fireEvent.click(screen.getByTestId("picture-retry"));
        expect(screen.getByTestId("picture-submit")).toBeDisabled();
    });
});

describe("PictureChoiceExercise: text fallback on image error", () => {
    it("swaps to text-only when an image fails to load", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        const tile1 = screen.getByTestId("picture-choice-1");
        const img1 = tile1.querySelector("img");
        expect(img1).toBeInTheDocument();
        act(() => {
            // Simulate the browser's onerror fire.
            fireEvent.error(img1!);
        });
        // Tile re-renders with the text fallback class.
        expect(
            screen.getByTestId("picture-choice-1").className,
        ).toMatch(/is-text-fallback/);
    });
});

describe("PictureChoiceExercise: edge cases", () => {
    it("renders empty state when images is missing", () => {
        render(
            <PictureChoiceExercise
                exercise={{...EXERCISE, images: undefined}}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("picture-empty")).toBeInTheDocument();
    });

    it("uses resolveImageSrc when provided", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                resolveImageSrc={(raw) =>
                    `/api/cdn/${raw}`
                }
            />,
        );
        const tile = screen.getByTestId("picture-choice-0");
        const img = tile.querySelector("img");
        expect(img?.getAttribute("src")).toBe("/api/cdn/assets/cat.png");
    });
});
