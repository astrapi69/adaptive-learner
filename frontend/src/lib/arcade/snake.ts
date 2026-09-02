/**
 * Pure snake game logic (#2887) - the classic reward mini-game of the
 * game mode's arcade. Deterministic and side-effect free: the caller
 * owns the tick timer and passes a ``rand`` source, so every rule
 * (movement, turning, growth, collision) is unit-testable.
 *
 * The round is time-boxed by the CALLER (the configured round length
 * from ``playfulArcadePref``); this module only ends a run on
 * collision. ``SNAKE_WIN_SCORE`` is the friendly winnable target the
 * UI celebrates.
 */

export interface Point {
    x: number;
    y: number;
}

export type SnakeDirection = "up" | "down" | "left" | "right";

export interface SnakeState {
    /** Segments, head first. */
    snake: Point[];
    /** Direction applied on the last step. */
    dir: SnakeDirection;
    /** Buffered input, applied on the next step (one turn per tick). */
    pendingDir: SnakeDirection;
    food: Point;
    score: number;
    status: "running" | "over";
}

export const SNAKE_GRID_SIZE = 15;

/** Friendly winnable target for a ~60s round. */
export const SNAKE_WIN_SCORE = 5;

const OPPOSITE: Record<SnakeDirection, SnakeDirection> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
};

const DELTA: Record<SnakeDirection, Point> = {
    up: {x: 0, y: -1},
    down: {x: 0, y: 1},
    left: {x: -1, y: 0},
    right: {x: 1, y: 0},
};

function samePoint(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y;
}

/** A food position on a free cell, chosen via ``rand`` in [0, 1). */
function placeFood(occupied: Point[], rand: () => number): Point {
    const free: Point[] = [];
    for (let y = 0; y < SNAKE_GRID_SIZE; y++) {
        for (let x = 0; x < SNAKE_GRID_SIZE; x++) {
            const cell = {x, y};
            if (!occupied.some((seg) => samePoint(seg, cell))) {
                free.push(cell);
            }
        }
    }
    if (free.length === 0) return {x: 0, y: 0};
    const index = Math.min(
        free.length - 1,
        Math.floor(rand() * free.length),
    );
    return free[index];
}

/** A fresh run: 3 segments mid-grid heading right, food on a free cell. */
export function initialSnake(rand: () => number): SnakeState {
    const mid = Math.floor(SNAKE_GRID_SIZE / 2);
    const snake: Point[] = [
        {x: mid, y: mid},
        {x: mid - 1, y: mid},
        {x: mid - 2, y: mid},
    ];
    return {
        snake,
        dir: "right",
        pendingDir: "right",
        food: placeFood(snake, rand),
        score: 0,
        status: "running",
    };
}

/** Buffer a turn; a 180-degree reversal against the current heading
 *  is ignored (the classic rule - you cannot run into your own neck). */
export function turnSnake(state: SnakeState, dir: SnakeDirection): SnakeState {
    if (state.status !== "running") return state;
    if (dir === OPPOSITE[state.dir]) return state;
    if (dir === state.pendingDir) return state;
    return {...state, pendingDir: dir};
}

/** Advance one tick: move, eat/grow, or die on wall/self collision. */
export function stepSnake(state: SnakeState, rand: () => number): SnakeState {
    if (state.status !== "running") return state;
    const dir = state.pendingDir;
    const delta = DELTA[dir];
    const head = state.snake[0];
    const nextHead = {x: head.x + delta.x, y: head.y + delta.y};

    if (
        nextHead.x < 0 ||
        nextHead.x >= SNAKE_GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= SNAKE_GRID_SIZE
    ) {
        return {...state, dir, status: "over"};
    }

    const eats = samePoint(nextHead, state.food);
    // The tail cell vacates this tick unless the snake grows, so a
    // non-growing move into the current tail is legal.
    const bodyToCheck = eats ? state.snake : state.snake.slice(0, -1);
    if (bodyToCheck.some((seg) => samePoint(seg, nextHead))) {
        return {...state, dir, status: "over"};
    }

    const grown = [nextHead, ...state.snake];
    if (eats) {
        return {
            ...state,
            dir,
            snake: grown,
            score: state.score + 1,
            food: placeFood(grown, rand),
        };
    }
    return {...state, dir, snake: grown.slice(0, -1)};
}
