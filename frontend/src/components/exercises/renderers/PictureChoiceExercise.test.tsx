/**
 * Tests for the Picture Choice exercise component
 * (Phase 44 / EXP-002 / 3D / F-107).
 *
 * Pins selection + scoring + text-only fallback contract.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

// Phase 54C: stub the asset resolver so PictureChoiceExercise
// tests stay synchronous (no Dexie / API / storage mocking
// required at this layer). The default stub returns the
// "no asset" path so the legacyResolveSrc / text-fallback
// branches stay testable.
interface UseAssetStub {
    url: string | null;
    loading: boolean;
    error: boolean;
}
const useAssetMock = vi.fn<() => UseAssetStub>(() => ({
    url: null,
    loading: false,
    error: true,
}));
vi.mock("../../../hooks/ui/useAsset", () => ({
    useAsset: () => useAssetMock(),
}));

import PictureChoiceExercise from "./PictureChoiceExercise";
import type {ContentLessonExercise} from "../../../storage/types";

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

    it("equal-height tiles: grid uses auto-rows 1fr + tiles are h-full (#762)", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        // The grid equalises row heights so a tile whose label wraps to two
        // lines doesn't make its row-mates shorter (the equaliser is the
        // grid, not a hardcoded min-height).
        expect(screen.getByTestId("picture-grid").className).toContain(
            "[grid-auto-rows:1fr]",
        );
        for (let i = 0; i < 4; i++) {
            expect(
                screen.getByTestId(`picture-choice-${i}`).className,
            ).toContain("h-full");
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
        // Use the legacy resolver to produce an actual <img>
        // first; then the per-tile onError fallback fires.
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
                resolveImageSrc={(raw) => `/cdn/${raw}`}
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

    // Engine 0.13.0 / schema 1.8 (#1770): an uploaded card image is an
    // inline base64 data URI in ``src``. It is self-contained - render it
    // directly, no asset lookup, no placeholder.
    it("renders an inline data-URI src directly as the <img> src", () => {
        const inlineDataUri = `data:image/jpeg;base64,${"A".repeat(2000)}`;
        const withDataUri: ContentLessonExercise = {
            ...EXERCISE,
            images: [
                {src: inlineDataUri, label: "Cat", is_correct: "true"},
                {src: "assets/dog.png", label: "Dog"},
            ],
        };
        render(
            <PictureChoiceExercise
                exercise={withDataUri}
                onComplete={vi.fn()}
            />,
        );
        const tile = screen.getByTestId("picture-choice-0");
        expect(tile.className).not.toMatch(/is-placeholder/);
        const img = tile.querySelector("img");
        expect(img).toBeInTheDocument();
        expect(img?.getAttribute("src")).toBe(inlineDataUri);
    });

    it("renders a placeholder SVG when no asset AND no legacy resolver (Phase 54D)", () => {
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        // Every tile lands on the placeholder fallback since
        // useAsset returns error: true (the default mock) and
        // no legacyResolveSrc is supplied. The tile renders
        // an <img> whose src is a data: URI.
        for (let i = 0; i < 4; i++) {
            const tile = screen.getByTestId(`picture-choice-${i}`);
            expect(tile.className).toMatch(/is-placeholder/);
            const img = tile.querySelector("img");
            expect(img?.getAttribute("src")).toMatch(
                /^data:image\/svg\+xml/,
            );
        }
    });

    it("placeholder falls back to text-only when the SVG <img> also errors", () => {
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
            fireEvent.error(img1!);
        });
        expect(
            screen.getByTestId("picture-choice-1").className,
        ).toMatch(/is-text-fallback/);
    });

    it("renders skeleton while the asset resolver is loading", () => {
        useAssetMock.mockReturnValueOnce({
            url: null,
            loading: true,
            error: false,
        });
        // Subsequent calls (the other 3 tiles) use the default
        // stub (error: true) since mockReturnValueOnce only
        // fires once, so exactly one tile shows the skeleton.
        // The display order is shuffled (#2317), so assert on the
        // presence of a single skeleton rather than a fixed index.
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                source="owner/repo"
                setId="set-1"
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen
                .getByTestId("picture-grid")
                .querySelectorAll("[data-testid^='picture-tile-skeleton-']"),
        ).toHaveLength(1);
    });

    it("renders the resolved asset URL as the <img> src", () => {
        useAssetMock.mockReturnValue({
            url: "blob:test/asset",
            loading: false,
            error: false,
        });
        render(
            <PictureChoiceExercise
                exercise={EXERCISE}
                source="owner/repo"
                setId="set-1"
                onComplete={vi.fn()}
            />,
        );
        const tile = screen.getByTestId("picture-choice-0");
        const img = tile.querySelector("img");
        expect(img?.getAttribute("src")).toBe("blob:test/asset");
        expect(img?.getAttribute("alt")).toBe("Cat");
        // Reset for subsequent tests in the file.
        useAssetMock.mockReturnValue({
            url: null,
            loading: false,
            error: true,
        });
    });
});

describe("PictureChoiceExercise: answer-position shuffle (#2317)", () => {
    /** Display order of the tiles, as the original content indices they carry
     *  in their stable ``picture-choice-{index}`` testid. */
    function tileOrderIndices(): number[] {
        const grid = screen.getByTestId("picture-grid");
        return Array.from(
            grid.querySelectorAll("[data-testid^='picture-choice-']"),
        ).map((tile) =>
            Number(
                tile
                    .getAttribute("data-testid")!
                    .replace("picture-choice-", ""),
            ),
        );
    }

    function displayPositionOfCorrect(exerciseId: string): number {
        const {unmount} = render(
            <PictureChoiceExercise
                exercise={{...EXERCISE, id: exerciseId}}
                onComplete={vi.fn()}
            />,
        );
        const grid = screen.getByTestId("picture-grid");
        const tiles = Array.from(
            grid.querySelectorAll("[data-testid^='picture-choice-']"),
        );
        const pos = tiles.findIndex(
            (tile) => tile.getAttribute("data-correct") === "true",
        );
        unmount();
        return pos;
    }

    it("does not place the correct tile at the same display position across many exercises", () => {
        // The correct image is authored FIRST in EXERCISE (this mirrors the
        // shipped content: 87% of picture_choice sets author the correct tile
        // first). Without a display shuffle the correct tile is ALWAYS at
        // display position 0, so the learner can game the exercise by position.
        const positions = new Set<number>();
        for (let i = 0; i < 40; i++) {
            positions.add(displayPositionOfCorrect(`ex-shuffle-${i}`));
        }
        expect(positions.size).toBeGreaterThan(1);
    });

    it("keeps the option order stable within a session (no jitter on re-render)", () => {
        render(
            <PictureChoiceExercise
                exercise={{...EXERCISE, id: "ex-stable"}}
                onComplete={vi.fn()}
            />,
        );
        const before = tileOrderIndices();
        // Selecting a tile triggers a re-render; the order must not change
        // while the user is reading.
        fireEvent.click(screen.getByTestId("picture-choice-0"));
        const after = tileOrderIndices();
        expect(after).toEqual(before);
    });

    it("grades by content, not display position, after shuffling", () => {
        const onComplete = vi.fn();
        render(
            <PictureChoiceExercise
                exercise={{...EXERCISE, id: "ex-grade"}}
                setId="set-1"
                lessonId="lesson-1"
                onComplete={onComplete}
            />,
        );
        // Click whichever tile is marked correct, wherever the shuffle put it.
        const grid = screen.getByTestId("picture-grid");
        const correctTile = grid.querySelector<HTMLElement>(
            "[data-correct='true']",
        )!;
        fireEvent.click(correctTile);
        fireEvent.click(screen.getByTestId("picture-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 1, total: 1}),
        );
        const attempt = onComplete.mock.calls[0][0].attempts[0];
        expect(attempt.correct).toBe(true);
        // The SRS element_key is the correct image's label - content, not
        // position - so shuffling the display leaves progress untouched.
        expect(attempt.element_key).toBe("Cat");
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
