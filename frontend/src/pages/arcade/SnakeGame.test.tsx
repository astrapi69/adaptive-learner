/**
 * Tests for the SnakeGame component shell (#2887): board rendering,
 * the round clock, pause, and restart. The game rules themselves are
 * pinned by the pure-logic tests in ``lib/arcade/snake.test.ts``.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import SnakeGame from "./SnakeGame";
import {SNAKE_GRID_SIZE} from "../../lib/arcade/snake";

beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("SnakeGame", () => {
    it("renders the full board with score 0 and the configured time", () => {
        render(<SnakeGame seconds={45} />);
        const board = screen.getByTestId("arcade-snake-board");
        expect(board.children).toHaveLength(SNAKE_GRID_SIZE * SNAKE_GRID_SIZE);
        expect(screen.getByTestId("arcade-snake-score")).toHaveTextContent(
            "Points: 0",
        );
        expect(screen.getByTestId("arcade-snake-time")).toHaveTextContent(
            "Time: 45s",
        );
    });

    it("counts the clock down while running and holds it while paused", () => {
        render(<SnakeGame seconds={45} />);
        // Only 1s: the unsteered snake hits the wall after ~1.3s.
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByTestId("arcade-snake-time")).toHaveTextContent(
            "Time: 44s",
        );
        fireEvent.click(screen.getByTestId("arcade-snake-pause"));
        act(() => {
            vi.advanceTimersByTime(3000);
        });
        expect(screen.getByTestId("arcade-snake-time")).toHaveTextContent(
            "Time: 44s",
        );
    });

    it("restart resets the clock and keeps playing after arrow input", () => {
        render(<SnakeGame seconds={45} />);
        fireEvent.keyDown(window, {key: "ArrowUp"});
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        fireEvent.click(screen.getByTestId("arcade-snake-restart"));
        expect(screen.getByTestId("arcade-snake-time")).toHaveTextContent(
            "Time: 45s",
        );
        expect(
            screen.queryByTestId("arcade-snake-result"),
        ).not.toBeInTheDocument();
    });

    it("time running out shows the round result", () => {
        render(<SnakeGame seconds={45} />);
        act(() => {
            vi.advanceTimersByTime(45_000);
        });
        expect(screen.getByTestId("arcade-snake-result")).toBeInTheDocument();
    });
});
