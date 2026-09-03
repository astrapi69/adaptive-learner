/**
 * Tictactoe reducer (#2906) - the arcade's third mini-game: the
 * learner plays X against an app AI (O) that is DELIBERATELY
 * beatable (the "winnable" guardrail of #2886): it takes its own
 * winning move, blocks a player threat only with
 * ``TTT_BLOCK_CHANCE``, and otherwise picks a rand-indexed free
 * cell. All transitions are pure with an injected rand, following
 * the snake/memory reducer pattern.
 *
 * The turn is two-phase (``player`` -> ``ai``) so the component can
 * show the "app is thinking" beat between the moves; ``aiMove`` is
 * only legal in the ``ai`` turn.
 */

export type TttCell = "x" | "o" | null;

export type TttOutcome = "playing" | "won" | "lost" | "draw";

export interface TttState {
    /** 9 cells, row-major. */
    board: TttCell[];
    turn: "player" | "ai";
    outcome: TttOutcome;
    /** Winning cell indices for the highlight, null otherwise. */
    line: number[] | null;
}

/** Probability that the AI blocks a player's winning move. Under 1 by
 *  design - an unbeatable reward game is the wrong reward. */
export const TTT_BLOCK_CHANCE = 0.7;

const LINES: readonly (readonly [number, number, number])[] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

/** A fresh game: empty board, the player (X) begins. */
export function initialTtt(): TttState {
    return {
        board: Array<TttCell>(9).fill(null),
        turn: "player",
        outcome: "playing",
        line: null,
    };
}

/** The completed line of ``mark`` on ``board``, or null. */
export function findWinningLine(
    board: readonly TttCell[],
    mark: "x" | "o",
): number[] | null {
    for (const line of LINES) {
        if (line.every((i) => board[i] === mark)) return [...line];
    }
    return null;
}

/** The cell that completes a line for ``mark`` next move, or null. */
function findFinishingCell(
    board: readonly TttCell[],
    mark: "x" | "o",
): number | null {
    for (const line of LINES) {
        const marks = line.filter((i) => board[i] === mark);
        const free = line.filter((i) => board[i] === null);
        if (marks.length === 2 && free.length === 1) return free[0];
    }
    return null;
}

function settle(
    state: TttState,
    board: TttCell[],
    mover: "x" | "o",
    nextTurn: "player" | "ai",
): TttState {
    const line = findWinningLine(board, mover);
    if (line) {
        return {
            board,
            turn: nextTurn,
            outcome: mover === "x" ? "won" : "lost",
            line,
        };
    }
    if (board.every((cell) => cell !== null)) {
        return {board, turn: nextTurn, outcome: "draw", line: null};
    }
    return {board, turn: nextTurn, outcome: "playing", line: null};
}

/** Place the player's X on ``index``; ignores occupied cells,
 *  finished games and out-of-turn calls. */
export function playerMove(state: TttState, index: number): TttState {
    if (
        state.outcome !== "playing" ||
        state.turn !== "player" ||
        state.board[index] !== null
    ) {
        return state;
    }
    const board = [...state.board];
    board[index] = "x";
    return settle(state, board, "x", "ai");
}

/**
 * The AI's cell choice on ``board``: its own winning move first, a
 * block of the player's winning move with ``TTT_BLOCK_CHANCE``
 * (first rand draw), otherwise the rand-indexed free cell.
 */
export function chooseAiMove(
    board: readonly TttCell[],
    rand: () => number,
): number {
    const ownWin = findFinishingCell(board, "o");
    if (ownWin !== null) return ownWin;
    const block = findFinishingCell(board, "x");
    if (block !== null && rand() < TTT_BLOCK_CHANCE) return block;
    const free = board
        .map((cell, i) => (cell === null ? i : -1))
        .filter((i) => i >= 0);
    return free[Math.floor(rand() * free.length)];
}

/** Resolve the AI's O move; a no-op outside the AI turn. */
export function aiMove(state: TttState, rand: () => number): TttState {
    if (state.outcome !== "playing" || state.turn !== "ai") return state;
    const board = [...state.board];
    board[chooseAiMove(board, rand)] = "o";
    return settle(state, board, "o", "player");
}
