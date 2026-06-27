/**
 * Tests for the Word-Tiles exercise component
 * (Phase 45 / EXP-002 / 3F / F-109).
 *
 * Pins the tap-to-place UX + scoring contract:
 * - Initial render: prompt + scrambled bar + empty answer
 *   placeholder.
 * - Tap a scrambled tile → moves to answer row, vanishes
 *   from scrambled bar.
 * - Tap a placed tile → returns to scrambled bar at its
 *   original display position.
 * - Submit disabled until all tiles are placed.
 * - Submit reports {correct: 1, total: 1} when the placed
 *   order matches the canonical OR an accept_orderings
 *   permutation.
 * - Submit reports {correct: 0, total: 1} when the order is
 *   wrong; wrong-result message surfaces the canonical
 *   "tiles joined by space" form.
 * - accept_orderings absent: ONLY canonical order accepted
 *   (D4 confirmed).
 * - accept_orderings present: any listed permutation passes.
 * - Try-again resets state.
 * - Hint toggle: shown only when ``exercise.hint`` is set.
 * - Empty ``tiles`` surfaces the empty-state testid.
 *
 * Also unit-tests the ``isWordTilesCorrect`` matcher in
 * isolation — it is the regression-pin contract for the D4
 * "absent accept_orderings = canonical-only" decision.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import WordTilesExercise, {
    applyDragReorder,
    isWordTilesCorrect,
    wordTilesPerTileCorrect,
} from "./WordTilesExercise";
import type {ContentLessonExercise} from "../../../storage/types";

const EXERCISE: ContentLessonExercise = {
    id: "ex-word-tiles",
    type: "word_tiles",
    prompt: "Arrange the tiles to spell the standard farewell.",
    card_ids: [],
    tiles: ["Au", "revoir"],
    distractors: [],
    hint: "Two short words; the first is two letters long.",
};

const EXERCISE_MULTI_ORDER: ContentLessonExercise = {
    id: "ex-word-tiles-multi",
    type: "word_tiles",
    prompt: "Arrange the tiles into a valid sentence.",
    card_ids: [],
    tiles: ["I", "really", "love", "you"],
    // Canonical: [0, 1, 2, 3] -> "I really love you"
    // Alt:       [0, 2, 3]   -> NOT a permutation; skip.
    // Alt:       [0, 2, 1, 3] -> "I love really you" (silly but a permutation)
    accept_orderings: [[0, 2, 1, 3]],
    distractors: [],
};

describe("wordTilesPerTileCorrect (#1005)", () => {
    it("marks every position correct when the whole answer is accepted", () => {
        expect(wordTilesPerTileCorrect([1, 0], true)).toEqual([true, true]);
    });

    it("marks each position by its canonical slot when wrong", () => {
        // slot 0 holds tile 0 (correct), slot 1 holds tile 0? no — [0, 2, 1]:
        // slot0=0 ✓, slot1=2 ✗, slot2=1 ✗
        expect(wordTilesPerTileCorrect([0, 2, 1], false)).toEqual([
            true,
            false,
            false,
        ]);
    });
});

describe("isWordTilesCorrect (matcher)", () => {
    // Generic non-connector tiles so Mechanism B (connector-move
    // equivalence) never fires — these pin the exact-match contract.
    const T2 = ["x", "y"];
    const T3 = ["x", "y", "z"];
    const T4 = ["w", "x", "y", "z"];

    it("accepts the canonical order when accept_orderings is absent", () => {
        expect(isWordTilesCorrect([0, 1, 2], T3, null)).toBe(true);
        expect(isWordTilesCorrect([0, 1], T2, undefined)).toBe(true);
    });

    it("rejects any non-canonical order when accept_orderings is absent (D4)", () => {
        expect(isWordTilesCorrect([1, 0], T2, null)).toBe(false);
        expect(isWordTilesCorrect([2, 0, 1], T3, undefined)).toBe(false);
        expect(isWordTilesCorrect([2, 1, 0], T3, null)).toBe(false);
    });

    it("rejects an incomplete placement", () => {
        expect(isWordTilesCorrect([0], T2, null)).toBe(false);
        expect(isWordTilesCorrect([], T2, null)).toBe(false);
        expect(isWordTilesCorrect([0, 1], T3, null)).toBe(false);
    });

    it("accepts any listed accept_orderings permutation", () => {
        const accept = [
            [0, 2, 1, 3],
            [3, 2, 1, 0],
        ];
        expect(isWordTilesCorrect([0, 2, 1, 3], T4, accept)).toBe(true);
        expect(isWordTilesCorrect([3, 2, 1, 0], T4, accept)).toBe(true);
    });

    it("still accepts the canonical order even when accept_orderings is present", () => {
        // Per schema: accept_orderings adds alternatives; it does
        // NOT replace the canonical.
        const accept = [[0, 2, 1, 3]];
        expect(isWordTilesCorrect([0, 1, 2, 3], T4, accept)).toBe(true);
    });

    it("rejects a permutation not in accept_orderings (and not canonical)", () => {
        const accept = [[0, 2, 1, 3]];
        expect(isWordTilesCorrect([3, 2, 1, 0], T4, accept)).toBe(false);
    });

    it("rejects when accept_orderings is an empty list and order is non-canonical", () => {
        // Schema gates empty-list separately, but if it ever
        // lands here the matcher should still fall back to
        // canonical-only.
        expect(isWordTilesCorrect([1, 0], T2, [])).toBe(false);
        expect(isWordTilesCorrect([0, 1], T2, [])).toBe(true);
    });
});

describe("WordTilesExercise: initial render", () => {
    it("renders the prompt and an empty-answer placeholder", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("word-tiles-prompt")).toHaveTextContent(
            "Arrange the tiles",
        );
        expect(
            screen.getByTestId("word-tiles-answer-empty"),
        ).toBeInTheDocument();
    });

    it("renders one scrambled tile button per tile", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        // Both tiles appear in the scrambled bar by index.
        expect(
            screen.getByTestId("word-tile-scrambled-0"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("word-tile-scrambled-1"),
        ).toBeInTheDocument();
    });

    it("disables submit until all tiles are placed", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("word-tiles-submit")).toBeDisabled();
    });
});

describe("WordTilesExercise: tap-to-place lifecycle", () => {
    it("placing a tile moves it from scrambled bar to answer row", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        // Scrambled bar no longer has tile 0; answer row slot 0 does.
        expect(
            screen.queryByTestId("word-tile-scrambled-0"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("word-tile-placed-0"),
        ).toBeInTheDocument();
        expect(
            screen
                .getByTestId("word-tile-placed-0")
                .getAttribute("data-tile-index"),
        ).toBe("0");
    });

    it("tapping a placed tile returns it to the scrambled bar", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-placed-0"));
        expect(
            screen.queryByTestId("word-tile-placed-0"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("word-tile-scrambled-0"),
        ).toBeInTheDocument();
    });

    it("submit enables once all tiles are placed", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        expect(screen.getByTestId("word-tiles-submit")).not.toBeDisabled();
        // The answer row replaces the empty placeholder.
        expect(
            screen.queryByTestId("word-tiles-answer-empty"),
        ).not.toBeInTheDocument();
        // The scrambled bar surfaces an "all placed" indicator.
        expect(
            screen.getByTestId("word-tiles-scrambled-empty"),
        ).toBeInTheDocument();
    });
});

describe("WordTilesExercise: submit lifecycle", () => {
    it("canonical order reports correct=1", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
        expect(screen.getByTestId("word-tiles-result")).toHaveAttribute(
            "data-result",
            "correct",
        );
    });

    it("wrong order: My-answer view shows the user's order with per-tile state; Solution view shows the readable canonical (#1005)", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        // Place "revoir" then "Au" -> [1, 0] = "revoir Au" (wrong).
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 0, total: 1}));
        const result = screen.getByTestId("word-tiles-result");
        expect(result).toHaveAttribute("data-result", "wrong");
        // The toggle replaces the old (squished) diff row.
        expect(screen.queryByTestId("word-tiles-diff-row")).toBeNull();
        expect(screen.getByTestId("word-tiles-answer-toggle")).toBeInTheDocument();

        // My-answer view is the default: the learner's order, both tiles
        // marked incorrect (neither sits in its canonical slot).
        const myView = screen.getByTestId("word-tiles-my-answer-view");
        expect(myView).toHaveTextContent("revoir");
        expect(screen.getByTestId("word-tiles-my-answer-view-tile-0")).toHaveAttribute(
            "data-correct",
            "false",
        );

        // Toggle to the Solution view: readable canonical order, all green.
        fireEvent.click(screen.getByTestId("word-tiles-solution"));
        const solution = screen.getByTestId("word-tiles-solution-view");
        expect(solution).toHaveTextContent("Au");
        expect(solution).toHaveTextContent("revoir");
        expect(screen.getByTestId("word-tiles-solution-view-tile-0")).toHaveAttribute(
            "data-correct",
            "true",
        );
        // The interactive answer row + scrambled bar are gone after check.
        expect(screen.queryByTestId("word-tiles-scrambled-row")).toBeNull();
    });

    it("any accept_orderings permutation reports correct=1", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={onComplete}
            />,
        );
        // Place in alt order [0, 2, 1, 3] -> "I love really you"
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-2"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-3"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 1, total: 1}));
    });

    it("non-listed permutation reports correct=0 even when accept_orderings is set", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={onComplete}
            />,
        );
        // Place in [3, 2, 1, 0] which is NOT in accept_orderings.
        fireEvent.click(screen.getByTestId("word-tile-scrambled-3"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-2"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({correct: 0, total: 1}));
    });

    it("Try-again resets state so the user can retry", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        fireEvent.click(screen.getByTestId("word-tiles-retry"));
        expect(
            screen.queryByTestId("word-tiles-result"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("word-tiles-answer-empty"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("word-tile-scrambled-0"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("word-tile-scrambled-1"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("word-tiles-submit")).toBeDisabled();
    });
});

describe("WordTilesExercise: hint affordance", () => {
    it("renders the hint toggle when exercise.hint is set", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("word-tiles-hint-show"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("word-tiles-hint"),
        ).not.toBeInTheDocument();
    });

    it("reveals the hint on click and hides the toggle", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tiles-hint-show"));
        expect(screen.getByTestId("word-tiles-hint")).toHaveTextContent(
            "Two short words",
        );
        expect(
            screen.queryByTestId("word-tiles-hint-show"),
        ).not.toBeInTheDocument();
    });

    it("does not render the hint toggle when exercise.hint is absent", () => {
        const noHint: ContentLessonExercise = {...EXERCISE, hint: null};
        render(
            <WordTilesExercise
                exercise={noHint}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.queryByTestId("word-tiles-hint-show"),
        ).not.toBeInTheDocument();
    });

    it("hides the hint toggle after submit", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-scrambled-1"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        expect(
            screen.queryByTestId("word-tiles-hint-show"),
        ).not.toBeInTheDocument();
    });
});

describe("WordTilesExercise: edge cases", () => {
    it("renders the empty-state when tiles is missing", () => {
        const empty: ContentLessonExercise = {
            ...EXERCISE,
            tiles: null,
        };
        render(
            <WordTilesExercise
                exercise={empty}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("word-tiles-empty")).toBeInTheDocument();
    });

    it("renders the empty-state when tiles is an empty list", () => {
        const empty: ContentLessonExercise = {
            ...EXERCISE,
            tiles: [],
        };
        render(
            <WordTilesExercise
                exercise={empty}
                onComplete={vi.fn()}
            />,
        );
        expect(screen.getByTestId("word-tiles-empty")).toBeInTheDocument();
    });

    it("ignores a repeat-click on the same placed tile (defensive)", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={onComplete}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        // The scrambled-0 button no longer exists, so a defensive
        // re-find by data-tile-index on the placed slot proves the
        // tile only appears once anywhere in the DOM.
        const placedSlots = screen.queryAllByTestId(/word-tile-placed-/);
        expect(placedSlots).toHaveLength(1);
        expect(placedSlots[0].getAttribute("data-tile-index")).toBe("0");
    });
});

describe("WordTilesExercise: reorder within answer (UX bugfix)", () => {
    function tileIndexAt(slot: number): string | null {
        return screen
            .getByTestId(`word-tile-placed-${slot}`)
            .getAttribute("data-tile-index");
    }

    function placeCanonical(count: number) {
        for (let i = 0; i < count; i++) {
            fireEvent.click(screen.getByTestId(`word-tile-scrambled-${i}`));
        }
    }

    it("renders the reorder instructions", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId("word-tiles-instructions"),
        ).toBeInTheDocument();
    });

    it("move-right swaps a placed tile with the next one", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={vi.fn()}
            />,
        );
        placeCanonical(4); // placed = [0,1,2,3]
        expect(tileIndexAt(0)).toBe("0");
        expect(tileIndexAt(1)).toBe("1");
        fireEvent.click(screen.getByTestId("word-tile-move-right-0"));
        // placed = [1,0,2,3]
        expect(tileIndexAt(0)).toBe("1");
        expect(tileIndexAt(1)).toBe("0");
    });

    it("keyboard ArrowLeft moves a placed tile toward the front", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={vi.fn()}
            />,
        );
        placeCanonical(4); // [0,1,2,3]
        fireEvent.keyDown(screen.getByTestId("word-tile-placed-2"), {
            key: "ArrowLeft",
        });
        // tile at slot 2 (index 2) moves to slot 1 -> [0,2,1,3]
        expect(tileIndexAt(1)).toBe("2");
        expect(tileIndexAt(2)).toBe("1");
    });

    it("move arrows are bounded at the ends", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={vi.fn()}
            />,
        );
        placeCanonical(4);
        expect(
            (screen.getByTestId("word-tile-move-left-0") as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(
            (
                screen.getByTestId(
                    "word-tile-move-right-3",
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it("reorder produces a different submitted score (order matters)", () => {
        const onComplete = vi.fn();
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={onComplete}
            />,
        );
        placeCanonical(4); // [0,1,2,3] == canonical -> correct
        // Reorder to a wrong order: move slot 0 right twice -> [1,2,0,3].
        fireEvent.click(screen.getByTestId("word-tile-move-right-0"));
        fireEvent.click(screen.getByTestId("word-tile-move-right-1"));
        fireEvent.click(screen.getByTestId("word-tiles-submit"));
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({correct: 0, total: 1}),
        );
    });
});

describe("applyDragReorder (pointer/touch drag contract)", () => {
    // @dnd-kit replaced native HTML5 drag (which never fired on touch).
    // The pointer/touch drag path resolves to this pure helper on
    // drag-end; simulating real pointer drag in happy-dom is
    // unreliable (see lessons-learned "Radix DropdownMenu +
    // happy-dom"), so the reorder contract is pinned here directly.
    // ``placed`` holds tile indices; sortable ids are their strings.

    it("drags a tile from position 0 to position 2", () => {
        // placed = [3,1,2,0]; drag the tile with index 3 (slot 0) onto
        // the tile with index 2 (slot 2) -> [1,2,3,0].
        expect(applyDragReorder([3, 1, 2, 0], "3", "2")).toEqual([
            1, 2, 3, 0,
        ]);
    });

    it("drags a tile backward (later slot onto an earlier one)", () => {
        // placed = [0,1,2,3]; drag index 3 (slot 3) onto index 1
        // (slot 1) -> [0,3,1,2].
        expect(applyDragReorder([0, 1, 2, 3], "3", "1")).toEqual([
            0, 3, 1, 2,
        ]);
    });

    it("is a no-op (returns a copy) when active === over", () => {
        const placed = [0, 1, 2];
        const next = applyDragReorder(placed, "1", "1");
        expect(next).toEqual([0, 1, 2]);
        expect(next).not.toBe(placed); // fresh array, never mutated
    });

    it("is a no-op when an id is not currently placed (defensive)", () => {
        expect(applyDragReorder([0, 1, 2], "9", "1")).toEqual([0, 1, 2]);
        expect(applyDragReorder([0, 1, 2], "0", "9")).toEqual([0, 1, 2]);
    });

    it("never mutates the input array", () => {
        const placed = [2, 0, 1];
        const snapshot = [...placed];
        applyDragReorder(placed, "2", "1");
        expect(placed).toEqual(snapshot);
    });
});

describe("WordTilesExercise: @dnd-kit sortable rendering", () => {
    function placeCanonical(count: number) {
        for (let i = 0; i < count; i++) {
            fireEvent.click(screen.getByTestId(`word-tile-scrambled-${i}`));
        }
    }

    it("mounts cleanly inside DndContext with no floating overlay at rest", () => {
        render(
            <WordTilesExercise
                exercise={EXERCISE_MULTI_ORDER}
                onComplete={vi.fn()}
            />,
        );
        placeCanonical(4);
        // The DragOverlay only renders its floating copy mid-drag.
        expect(
            screen.queryByTestId("word-tile-drag-overlay"),
        ).not.toBeInTheDocument();
        // Each placed tile is a sortable item — @dnd-kit marks the
        // activator with aria-roledescription="sortable".
        const placedTile = screen.getByTestId("word-tile-placed-0");
        expect(placedTile).toHaveAttribute(
            "aria-roledescription",
            "sortable",
        );
    });

    it("tap (click, no pointer drag) still removes a placed tile", () => {
        // 5px activation distance means a plain click is never a drag,
        // so the existing tap-to-remove contract is preserved.
        render(
            <WordTilesExercise
                exercise={EXERCISE}
                onComplete={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("word-tile-scrambled-0"));
        fireEvent.click(screen.getByTestId("word-tile-placed-0"));
        expect(
            screen.queryByTestId("word-tile-placed-0"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("word-tile-scrambled-0"),
        ).toBeInTheDocument();
    });
});
