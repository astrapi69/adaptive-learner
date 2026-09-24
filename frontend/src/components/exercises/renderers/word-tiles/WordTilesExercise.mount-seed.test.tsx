/**
 * #3214 independence, part 2 (the clock), through the rendered component.
 *
 * The word-tiles family (word tiles, audio tiles, ordering, parsons) seeds
 * its scrambled bar per mount. Before #3214 that seed read ``Date.now()``, so
 * in visual runs the bar was stable only because the harness froze the clock:
 * a different frozen instant moved every tile baseline without touching the
 * exercise. Under the visual random pin the rendered bar must not depend on
 * the instant, and it must match what the frozen visual clock produced.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import WordTilesExercise from "./WordTilesExercise";
import type {ContentLessonExercise} from "../../../../storage/types";
import {
    FROZEN_VISUAL_NOW,
    OTHER_INSTANTS,
    VISUAL_RANDOM_PIN,
    clearRandomPin,
    installVisualRandomPin,
} from "../../../../test-utils/visual-random-pin";

const EXERCISE: ContentLessonExercise = {
    id: "ex-tiles-clock",
    type: "word_tiles",
    prompt: "Arrange the tiles.",
    card_ids: [],
    tiles: ["a", "b", "c", "d", "e", "f", "g"],
    distractors: [],
};

function scrambledBarAt(now: number): string[] {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const {unmount} = render(
        <WordTilesExercise exercise={EXERCISE} onComplete={vi.fn()} />,
    );
    const row = screen.getByTestId("word-tiles-scrambled-row");
    const order = within(row)
        .getAllByTestId(/^word-tile-scrambled-\d+$/)
        .map((tile) => tile.getAttribute("data-testid") ?? "");
    unmount();
    return order;
}

afterEach(() => {
    vi.restoreAllMocks();
    clearRandomPin();
});

describe("WordTilesExercise: production scrambled bar follows the clock (#3214)", () => {
    it("two mounts whose clock low bits differ render different bars", () => {
        const [first, second] = OTHER_INSTANTS;
        expect(scrambledBarAt(second.now)).not.toEqual(scrambledBarAt(first.now));
    });
});

describe("WordTilesExercise: scrambled bar under the visual random pin (#3214)", () => {
    it.each(OTHER_INSTANTS)("renders the frozen-clock bar at $name", ({now}) => {
        expect(now & 0xffff).not.toBe(VISUAL_RANDOM_PIN.mountSalt);
        const unpinnedAtFrozenClock = scrambledBarAt(FROZEN_VISUAL_NOW);
        installVisualRandomPin();
        expect(scrambledBarAt(now)).toEqual(unpinnedAtFrozenClock);
    });
});
