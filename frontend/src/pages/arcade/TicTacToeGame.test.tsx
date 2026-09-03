/**
 * Tests for the TicTacToeGame component (#2906): placing X, the
 * delayed AI reply (fake timers), the disabled states, and the
 * win flow with the restart button. The reducer itself is pinned by
 * ``lib/arcade/tictactoe.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import TicTacToeGame from "./TicTacToeGame";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function advanceAi() {
    act(() => {
        vi.advanceTimersByTime(500);
    });
}

describe("TicTacToeGame", () => {
    it("places X, shows the thinking beat, then the AI's O lands", () => {
        render(<TicTacToeGame />);
        fireEvent.click(screen.getByTestId("arcade-ttt-cell-4"));
        expect(screen.getByTestId("arcade-ttt-cell-4")).toHaveTextContent(
            "X",
        );
        expect(screen.getByTestId("arcade-ttt-status")).toHaveTextContent(
            "thinking",
        );
        advanceAi();
        const cells = screen.getByTestId("arcade-ttt-board").children;
        const os = [...cells].filter((c) => c.textContent === "O");
        expect(os).toHaveLength(1);
        expect(screen.getByTestId("arcade-ttt-status")).toHaveTextContent(
            "Your turn",
        );
    });

    it("occupied cells and the AI turn are disabled", () => {
        render(<TicTacToeGame />);
        fireEvent.click(screen.getByTestId("arcade-ttt-cell-4"));
        // During the AI beat every cell is disabled.
        expect(screen.getByTestId("arcade-ttt-cell-0")).toBeDisabled();
        advanceAi();
        expect(screen.getByTestId("arcade-ttt-cell-4")).toBeDisabled();
    });

    it("a player win shows the friendly result and the restart resets", () => {
        // rand 0.99 makes the AI never block (and pick the LAST free
        // cell), so the top row is open: 0, 1, 2 wins.
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        render(<TicTacToeGame />);
        for (const cell of [0, 1]) {
            fireEvent.click(screen.getByTestId(`arcade-ttt-cell-${cell}`));
            advanceAi();
        }
        fireEvent.click(screen.getByTestId("arcade-ttt-cell-2"));
        expect(screen.getByTestId("arcade-ttt-status")).toHaveTextContent(
            "You won",
        );
        fireEvent.click(screen.getByTestId("arcade-ttt-restart"));
        expect(screen.getByTestId("arcade-ttt-status")).toHaveTextContent(
            "Your turn",
        );
        expect(screen.getByTestId("arcade-ttt-cell-0")).toHaveTextContent("");
    });
});
