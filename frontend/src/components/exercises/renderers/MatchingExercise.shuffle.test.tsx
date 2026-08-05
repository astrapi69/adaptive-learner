/**
 * Distribution + stability pins for the Matching column shuffle (#2371).
 *
 * The pre-fix local `_shuffle` (acc*31 hash + LCG 1103515245) degenerated
 * into a near-reversal: with 4 pairs the first-authored right item landed
 * on the LAST display position in 99.8% of mounts and never on the first,
 * so the learner could pair by position (first left = last right) instead
 * of content. These tests pin, over many mounts:
 * - the right column has no fixed position for the first-authored item,
 * - the left column is shuffled too (independently),
 * - the order is stable within one mount (no reshuffle under the user),
 * - grading stays value-based and untouched by display order.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import MatchingExercise from "./MatchingExercise";
import type {ContentLessonExercise} from "../../../storage/types";

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

    it("shuffles the left column too, independently of the right", () => {
        const leftOrders = new Set<string>();
        const relations = new Set<string>();
        for (let mount = 0; mount < 40; mount++) {
            const {unmount} = render(
                <MatchingExercise
                    exercise={makeExercise(`ex-match-left-${mount}`)}
                    onComplete={vi.fn()}
                />,
            );
            const left = columnLabels("matching-left", /L\d/);
            const right = columnLabels("matching-right", /R\d/);
            leftOrders.add(left.join(","));
            relations.add(
                `${left.indexOf("L0")}->${right.indexOf("R0")}`,
            );
            unmount();
        }
        expect(leftOrders.size).toBeGreaterThan(1);
        expect(relations.size).toBeGreaterThan(1);
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
