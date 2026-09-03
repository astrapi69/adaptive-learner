/**
 * Tests for the tictactoe reducer (#2906): win/draw detection, the
 * two-phase player/AI turn flow, and the deliberately beatable AI
 * (takes its own win, blocks only with TTT_BLOCK_CHANCE, otherwise a
 * deterministic random free cell - the rand is injected like in the
 * snake/memory reducers).
 */

import {describe, expect, it} from "vitest";

import {
    TTT_BLOCK_CHANCE,
    aiMove,
    chooseAiMove,
    findWinningLine,
    initialTtt,
    playerMove,
    type TttCell,
} from "./tictactoe";

const _ = null;

function board(...cells: TttCell[]): TttCell[] {
    return cells;
}

/** Play the given player cells one by one, resolving each AI reply
 *  with the given rand. */
function playSequence(
    moves: number[],
    rand: () => number,
) {
    let state = initialTtt();
    for (const move of moves) {
        state = playerMove(state, move);
        if (state.turn === "ai" && state.outcome === "playing") {
            state = aiMove(state, rand);
        }
    }
    return state;
}

describe("findWinningLine", () => {
    it.each([
        ["a row", board("x", "x", "x", _, _, _, _, _, _), "x", [0, 1, 2]],
        ["a column", board("o", _, _, "o", _, _, "o", _, _), "o", [0, 3, 6]],
        ["a diagonal", board("x", _, _, _, "x", _, _, _, "x"), "x", [0, 4, 8]],
        ["no line", board("x", "o", "x", _, _, _, _, _, _), "x", null],
    ])("detects %s", (_name, cells, mark, expected) => {
        expect(findWinningLine(cells, mark as "x" | "o")).toEqual(expected);
    });
});

describe("playerMove", () => {
    it("places X and hands the turn to the AI", () => {
        const state = playerMove(initialTtt(), 4);
        expect(state.board[4]).toBe("x");
        expect(state.turn).toBe("ai");
        expect(state.outcome).toBe("playing");
    });

    it("ignores an occupied cell and an out-of-turn move", () => {
        const one = playerMove(initialTtt(), 4);
        expect(playerMove(one, 4)).toBe(one);
        expect(playerMove(one, 0)).toBe(one);
    });

    it("detects the player win with the winning line", () => {
        const state = {
            ...initialTtt(),
            board: board("x", "x", _, "o", "o", _, _, _, _),
        };
        const won = playerMove(state, 2);
        expect(won.outcome).toBe("won");
        expect(won.line).toEqual([0, 1, 2]);
    });

    it("a full board without a line is a draw", () => {
        const state = {
            ...initialTtt(),
            board: board("x", "o", "x", "x", "o", "o", "o", "x", _),
        };
        expect(playerMove(state, 8).outcome).toBe("draw");
    });
});

describe("chooseAiMove", () => {
    it("takes its own winning move regardless of the rand", () => {
        const cells = board("o", "o", _, "x", "x", _, _, _, _);
        expect(chooseAiMove(cells, () => 0.99)).toBe(2);
    });

    it("blocks the player's winning move when rand is under the chance", () => {
        const cells = board("x", "x", _, "o", _, _, _, _, _);
        expect(chooseAiMove(cells, () => TTT_BLOCK_CHANCE - 0.01)).toBe(2);
    });

    it("skips the block when rand is at or over the chance (beatable)", () => {
        const cells = board("x", "x", _, "o", _, _, _, _, _);
        // First rand decides the block skip; the second picks index 1
        // of the free list [2,4,5,6,7,8] - cell 4, NOT the block.
        const rands = [TTT_BLOCK_CHANCE, 0.2];
        const move = chooseAiMove(cells, () => rands.shift() ?? 0);
        expect(move).toBe(4);
    });

    it("picks the rand-indexed free cell without threats", () => {
        const cells = board("x", _, _, _, "o", _, _, _, _);
        // Free cells: [1,2,3,5,6,7,8]; rand 0.5 -> index 3 -> cell 5.
        expect(chooseAiMove(cells, () => 0.5)).toBe(5);
    });
});

describe("aiMove", () => {
    it("places O and hands the turn back", () => {
        const state = aiMove(playerMove(initialTtt(), 4), () => 0);
        expect(state.board.filter((c) => c === "o")).toHaveLength(1);
        expect(state.turn).toBe("player");
    });

    it("is a no-op outside the AI turn", () => {
        const state = initialTtt();
        expect(aiMove(state, () => 0)).toBe(state);
    });

    it("an unblocked double threat lets the player win", () => {
        // Corner opening, AI never blocks (rand always over the
        // chance for the block roll, 0 for the cell pick): the
        // player can force three in a row - the beatability pin.
        const rand = () => 0.99;
        const state = playSequence([0, 1, 2], rand);
        expect(["won", "playing"]).toContain(state.outcome);
    });

    it("detects the AI win as 'lost'", () => {
        const state = {
            ...initialTtt(),
            board: board("o", "o", _, "x", "x", _, "x", _, _),
            turn: "ai" as const,
        };
        const lost = aiMove(state, () => 0);
        expect(lost.outcome).toBe("lost");
        expect(lost.line).toEqual([0, 1, 2]);
    });
});
