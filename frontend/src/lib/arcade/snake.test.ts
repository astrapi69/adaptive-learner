/**
 * Tests for the pure snake step/collision logic (#2887): movement,
 * turning (with the 180-degree ban), food growth + scoring, wall and
 * self collision, and the terminal no-op.
 */

import {describe, expect, it} from "vitest";

import {
    SNAKE_GRID_SIZE,
    SNAKE_WIN_SCORE,
    initialSnake,
    stepSnake,
    turnSnake,
    type SnakeState,
} from "./snake";

/** A deterministic rand always returning ``value``. */
function fixedRand(value: number): () => number {
    return () => value;
}

/** A hand-built state: 3-segment snake heading right, food far away. */
function baseState(): SnakeState {
    return {
        snake: [
            {x: 7, y: 7},
            {x: 6, y: 7},
            {x: 5, y: 7},
        ],
        dir: "right",
        pendingDir: "right",
        food: {x: 12, y: 12},
        score: 0,
        status: "running",
    };
}

describe("initialSnake", () => {
    it("starts running with a 3-segment snake and food off the snake", () => {
        const state = initialSnake(fixedRand(0));
        expect(state.status).toBe("running");
        expect(state.score).toBe(0);
        expect(state.snake).toHaveLength(3);
        for (const seg of state.snake) {
            expect(state.food).not.toEqual(seg);
            expect(seg.x).toBeGreaterThanOrEqual(0);
            expect(seg.x).toBeLessThan(SNAKE_GRID_SIZE);
            expect(seg.y).toBeGreaterThanOrEqual(0);
            expect(seg.y).toBeLessThan(SNAKE_GRID_SIZE);
        }
    });
});

describe("stepSnake movement", () => {
    it("moves the head one cell in the current direction and drops the tail", () => {
        const next = stepSnake(baseState(), fixedRand(0));
        expect(next.snake[0]).toEqual({x: 8, y: 7});
        expect(next.snake).toHaveLength(3);
        expect(next.snake).not.toContainEqual({x: 5, y: 7});
        expect(next.status).toBe("running");
    });

    it.each([
        ["up", {x: 7, y: 6}],
        ["down", {x: 7, y: 8}],
        ["left", null],
    ] as const)("applies the pending turn: %s", (dir, expectedHead) => {
        const turned = turnSnake(baseState(), dir);
        const next = stepSnake(turned, fixedRand(0));
        if (expectedHead === null) {
            // 180-degree reversal is ignored - keeps going right.
            expect(next.snake[0]).toEqual({x: 8, y: 7});
        } else {
            expect(next.snake[0]).toEqual(expectedHead);
        }
    });
});

describe("stepSnake food", () => {
    it("eating grows the snake, scores, and respawns food off the snake", () => {
        const state: SnakeState = {...baseState(), food: {x: 8, y: 7}};
        const next = stepSnake(state, fixedRand(0));
        expect(next.score).toBe(1);
        expect(next.snake).toHaveLength(4);
        expect(next.snake[0]).toEqual({x: 8, y: 7});
        for (const seg of next.snake) {
            expect(next.food).not.toEqual(seg);
        }
    });

    it("the win score is a friendly reachable target", () => {
        expect(SNAKE_WIN_SCORE).toBeGreaterThan(0);
        expect(SNAKE_WIN_SCORE).toBeLessThanOrEqual(10);
    });
});

describe("stepSnake collisions", () => {
    it("hitting the wall ends the run", () => {
        const state: SnakeState = {
            ...baseState(),
            snake: [
                {x: SNAKE_GRID_SIZE - 1, y: 7},
                {x: SNAKE_GRID_SIZE - 2, y: 7},
                {x: SNAKE_GRID_SIZE - 3, y: 7},
            ],
        };
        const next = stepSnake(state, fixedRand(0));
        expect(next.status).toBe("over");
        expect(next.snake).toEqual(state.snake);
    });

    it("hitting the own body ends the run", () => {
        // A 5-segment hook: head turns down into its own body.
        const state: SnakeState = {
            snake: [
                {x: 7, y: 7},
                {x: 7, y: 8},
                {x: 8, y: 8},
                {x: 8, y: 7},
                {x: 8, y: 6},
            ],
            dir: "left",
            pendingDir: "down",
            food: {x: 1, y: 1},
            score: 0,
            status: "running",
        };
        const next = stepSnake(state, fixedRand(0));
        expect(next.status).toBe("over");
    });

    it("moving into the vacating tail cell is allowed", () => {
        // A 4-segment square: the head chases the tail, which moves away
        // this same tick.
        const state: SnakeState = {
            snake: [
                {x: 7, y: 7},
                {x: 8, y: 7},
                {x: 8, y: 8},
                {x: 7, y: 8},
            ],
            dir: "left",
            pendingDir: "down",
            food: {x: 1, y: 1},
            score: 0,
            status: "running",
        };
        const next = stepSnake(state, fixedRand(0));
        expect(next.status).toBe("running");
        expect(next.snake[0]).toEqual({x: 7, y: 8});
    });

    it("a finished run is a no-op", () => {
        const over: SnakeState = {...baseState(), status: "over"};
        expect(stepSnake(over, fixedRand(0))).toBe(over);
    });
});
