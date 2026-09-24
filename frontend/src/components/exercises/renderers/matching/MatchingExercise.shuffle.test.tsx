/**
 * Distribution + stability pins for the Matching column shuffle (#2371).
 *
 * The pre-fix local `_shuffle` (acc*31 hash + LCG 1103515245) degenerated
 * into a near-reversal: with 4 pairs the first-authored right item landed
 * on the LAST display position in 99.8% of mounts and never on the first,
 * so the learner could pair by position (first left = last right) instead
 * of content. These tests pin, over many mounts:
 * - the right column has no fixed position for the first-authored item,
 * - the left column stays in authored order (#2882 - never shuffled),
 * - the order is stable within one mount (no reshuffle under the user),
 * - the solve view keeps the displayed left order (#2872),
 * - grading stays value-based and untouched by display order.
 *
 * #3214 adds both directions of the per-mount seed: in production the right
 * column follows ``Date.now() & 0xffff`` (a learner never sees the same order
 * on every encounter), under the visual random pin it ignores the clock and
 * keeps the order the frozen visual clock produced before.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import MatchingExercise from "./MatchingExercise";
import {seededShuffle} from "../../../../lib/exercises/grading/seeded-shuffle";
import {
    FROZEN_VISUAL_NOW,
    OTHER_INSTANTS,
    VISUAL_RANDOM_PIN,
    clearRandomPin,
    installVisualRandomPin,
} from "../../../../test-utils/visual-random-pin";
import type {ContentLessonExercise} from "../../../../storage/types";

function makeExercise(id: string): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: "Match the pairs.",
        card_ids: [],
        pairs: [
            {left: "L0", right: "R0"},
            {left: "L1", right: "R1"},
            {left: "L2", right: "R2"},
            {left: "L3", right: "R3"},
        ],
        distractors: [],
    };
}

/** Labels of one column in display order. */
function columnLabels(testId: string, labelPattern: RegExp): string[] {
    const column = screen.getByTestId(testId);
    return within(column)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.match(labelPattern)?.[0] ?? "");
}

beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(123456789);
});

afterEach(() => {
    vi.restoreAllMocks();
    clearRandomPin();
});

describe("MatchingExercise: column shuffle distribution (#2371)", () => {
    it("does not pin the first-authored right item to a fixed display position", () => {
        const positions: number[] = [];
        for (let mount = 0; mount < 60; mount++) {
            const {unmount} = render(
                <MatchingExercise
                    exercise={makeExercise(`ex-match-${mount}`)}
                    onComplete={vi.fn()}
                />,
            );
            positions.push(columnLabels("matching-right", /R\d/).indexOf("R0"));
            unmount();
        }
        const lastShare =
            positions.filter((p) => p === 3).length / positions.length;
        expect(new Set(positions).size).toBeGreaterThan(1);
        expect(lastShare).toBeLessThan(0.6);
        expect(positions).toContain(0);
    });

    it("keeps the left column in authored order on every mount (#2882)", () => {
        // Deliberate revision of the #2371 left shuffle: a shuffled left
        // column reads as random noise to the learner. Only the RIGHT
        // column shuffles - that alone prevents pairing by position.
        for (let mount = 0; mount < 25; mount++) {
            const {unmount} = render(
                <MatchingExercise
                    exercise={makeExercise(`ex-match-left-${mount}`)}
                    onComplete={vi.fn()}
                />,
            );
            expect(columnLabels("matching-left", /L\d/)).toEqual([
                "L0",
                "L1",
                "L2",
                "L3",
            ]);
            unmount();
        }
    });

    it("keeps both column orders stable across re-renders within one mount", () => {
        const exercise = makeExercise("ex-match-stable");
        const {rerender} = render(
            <MatchingExercise exercise={exercise} onComplete={vi.fn()} />,
        );
        const leftBefore = columnLabels("matching-left", /L\d/);
        const rightBefore = columnLabels("matching-right", /R\d/);
        fireEvent.click(screen.getByTestId("matching-left-0"));
        rerender(
            <MatchingExercise exercise={exercise} onComplete={vi.fn()} />,
        );
        expect(columnLabels("matching-left", /L\d/)).toEqual(leftBefore);
        expect(columnLabels("matching-right", /R\d/)).toEqual(rightBefore);
    });

    it("keeps the displayed left order in the solve view (#2872)", () => {
        // The interactive left column is shuffled (#2371). Clicking
        // "Auflösen" must NOT reorder it back to authored order: the
        // resolution's left column mirrors the column the learner just
        // saw, each row shows the correct partner on the right, and the
        // number badges run sequentially down the rows.
        for (let mount = 0; mount < 10; mount++) {
            const {unmount} = render(
                <MatchingExercise
                    exercise={makeExercise(`ex-resolve-order-${mount}`)}
                    onComplete={vi.fn()}
                />,
            );
            const displayedLeft = columnLabels("matching-left", /L\d/);
            // Two pairs swapped (wrong), two correct: a fully correct answer
            // has nothing to solve and offers no Solve button (#3140).
            fireEvent.click(screen.getByTestId("matching-left-0"));
            fireEvent.click(screen.getByTestId("matching-right-1"));
            fireEvent.click(screen.getByTestId("matching-left-1"));
            fireEvent.click(screen.getByTestId("matching-right-0"));
            for (let pair = 2; pair < 4; pair++) {
                fireEvent.click(screen.getByTestId(`matching-left-${pair}`));
                fireEvent.click(screen.getByTestId(`matching-right-${pair}`));
            }
            fireEvent.click(screen.getByTestId("matching-submit"));
            fireEvent.click(screen.getByTestId("matching-resolve"));
            for (let row = 0; row < 4; row++) {
                const leftTile = screen.getByTestId(
                    `matching-resolved-a-${row}`,
                );
                const rightTile = screen.getByTestId(
                    `matching-resolved-b-${row}`,
                );
                const label = displayedLeft[row];
                // Tile text = sequential number badge + label; the
                // row-aligned correct partner is R{n} for L{n}.
                expect(leftTile.textContent).toBe(`${row + 1}${label}`);
                expect(rightTile.textContent).toBe(
                    `${row + 1}${label.replace("L", "R")}`,
                );
            }
            unmount();
        }
    });

    it("grades by pair identity, untouched by display order", () => {
        const onComplete = vi.fn();
        render(
            <MatchingExercise
                exercise={makeExercise("ex-match-grading")}
                onComplete={onComplete}
            />,
        );
        for (let pair = 0; pair < 4; pair++) {
            fireEvent.click(screen.getByTestId(`matching-left-${pair}`));
            fireEvent.click(screen.getByTestId(`matching-right-${pair}`));
        }
        fireEvent.click(screen.getByTestId("matching-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 4, total: 4}),
        );
    });
});

const CLOCK_ID = "ex-match-clock";
const SIX_RIGHT = ["R0", "R1", "R2", "R3", "R4", "R5"];

function makeSixPairExercise(id: string): ContentLessonExercise {
    return {
        ...makeExercise(id),
        pairs: SIX_RIGHT.map((right, i) => ({left: `L${i}`, right})),
    };
}

function rightColumnAt(now: number): string[] {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const {unmount} = render(
        <MatchingExercise
            exercise={makeSixPairExercise(CLOCK_ID)}
            onComplete={vi.fn()}
        />,
    );
    const labels = columnLabels("matching-right", /R\d/);
    unmount();
    return labels;
}

/** The right-column order ``seededShuffle`` gives for a mount suffix. */
function rightOrderForSuffix(suffix: number): string[] {
    return seededShuffle(SIX_RIGHT, `${CLOCK_ID}#${suffix}#right`);
}

describe("MatchingExercise: production mount seed follows the clock (#3214)", () => {
    it.each([
        {name: "the frozen visual instant", now: FROZEN_VISUAL_NOW},
        ...OTHER_INSTANTS,
    ])("seeds with id#(Date.now() & 0xffff) at $name", ({now}) => {
        expect(rightColumnAt(now)).toEqual(rightOrderForSuffix(now & 0xffff));
        expect(Date.now).toHaveBeenCalled();
    });

    it("two mounts whose clock low bits differ get different orders", () => {
        const [first, second] = OTHER_INSTANTS;
        expect(first.now & 0xffff).not.toBe(second.now & 0xffff);
        expect(rightColumnAt(second.now)).not.toEqual(rightColumnAt(first.now));
    });
});

describe("MatchingExercise: mount seed under the visual random pin (#3214)", () => {
    it.each(OTHER_INSTANTS)(
        "renders the visual-seed order at $name",
        ({now}) => {
            expect(now & 0xffff).not.toBe(VISUAL_RANDOM_PIN.mountSalt);
            installVisualRandomPin();
            expect(rightColumnAt(now)).toEqual(
                rightOrderForSuffix(VISUAL_RANDOM_PIN.mountSalt),
            );
        },
    );

    it("keeps the order the frozen visual clock produced before #3214", () => {
        const unpinnedAtFrozenClock = rightColumnAt(FROZEN_VISUAL_NOW);
        installVisualRandomPin();
        expect(rightColumnAt(OTHER_INSTANTS[1].now)).toEqual(unpinnedAtFrozenClock);
    });
});
