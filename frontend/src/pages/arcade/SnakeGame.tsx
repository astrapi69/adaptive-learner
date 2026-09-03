/**
 * SnakeGame (#2887) - the classic reward mini-game of the arcade,
 * rendered as a token-only DOM grid over the pure ``lib/arcade/snake``
 * logic. The round is time-boxed by the configured length
 * (``playfulArcadePref``); reaching ``SNAKE_WIN_SCORE`` before the
 * clock runs out wins the round. Keyboard (arrows/WASD) + swipe
 * control, pausable; the local best score is display-only (no XP).
 */

import {useCallback, useEffect, useRef, useState} from "react";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../hooks/ui/useI18n";
import {
    SNAKE_GRID_SIZE,
    SNAKE_WIN_SCORE,
    initialSnake,
    stepSnake,
    turnSnake,
    type SnakeDirection,
    type SnakeState,
} from "../../lib/arcade/snake";

const TICK_MS = 160;
const HIGHSCORE_KEY = "adaptive-learner.arcade.snake-highscore";

const KEY_DIRECTIONS: Record<string, SnakeDirection> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
};

function readHighscore(): number {
    try {
        const raw = localStorage.getItem(HIGHSCORE_KEY);
        const parsed = raw === null ? 0 : Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
    } catch {
        return 0;
    }
}

function writeHighscore(score: number): void {
    try {
        localStorage.setItem(HIGHSCORE_KEY, String(score));
    } catch {
        /* display-only convenience */
    }
}

export interface SnakeGameProps {
    /** Round length in seconds (already clamped by the pref). */
    seconds: number;
}

export default function SnakeGame({seconds}: SnakeGameProps) {
    const {t} = useI18n();
    const [game, setGame] = useState<SnakeState>(() =>
        initialSnake(Math.random),
    );
    const [timeLeft, setTimeLeft] = useState(seconds);
    const [paused, setPaused] = useState(false);
    const [highscore, setHighscore] = useState<number>(() => readHighscore());
    const touchStart = useRef<{x: number; y: number} | null>(null);

    const finished = game.status === "over" || timeLeft <= 0;
    const won = game.score >= SNAKE_WIN_SCORE;
    const running = !finished && !paused;

    useEffect(() => {
        if (!running) return;
        const tick = window.setInterval(() => {
            setGame((state) => stepSnake(state, Math.random));
        }, TICK_MS);
        return () => window.clearInterval(tick);
    }, [running]);

    useEffect(() => {
        if (!running) return;
        const clock = window.setInterval(() => {
            setTimeLeft((left) => Math.max(0, left - 1));
        }, 1000);
        return () => window.clearInterval(clock);
    }, [running]);

    useEffect(() => {
        if (finished && game.score > highscore) {
            setHighscore(game.score);
            writeHighscore(game.score);
        }
    }, [finished, game.score, highscore]);

    const turn = useCallback((dir: SnakeDirection) => {
        setGame((state) => turnSnake(state, dir));
    }, []);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const dir = KEY_DIRECTIONS[event.key];
            if (!dir) return;
            event.preventDefault();
            turn(dir);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [turn]);

    const restart = () => {
        setGame(initialSnake(Math.random));
        setTimeLeft(seconds);
        setPaused(false);
    };

    const onTouchStart = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        touchStart.current = {x: touch.clientX, y: touch.clientY};
    };

    const onTouchEnd = (event: React.TouchEvent) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            turn(dx > 0 ? "right" : "left");
        } else {
            turn(dy > 0 ? "down" : "up");
        }
    };

    const snakeCells = new Set(game.snake.map((seg) => `${seg.x}:${seg.y}`));
    const head = game.snake[0];

    return (
        <div className="flex flex-col gap-3" data-testid="arcade-snake">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span data-testid="arcade-snake-score" className="font-semibold">
                    {t("arcade.snake.score", "Points: {n}").replace(
                        "{n}",
                        String(game.score),
                    )}
                </span>
                <span data-testid="arcade-snake-time">
                    {t("arcade.snake.time_left", "Time: {n}s").replace(
                        "{n}",
                        String(timeLeft),
                    )}
                </span>
                <span className="text-[var(--fg-muted)]">
                    {t("arcade.snake.goal", "Goal: {n} points").replace(
                        "{n}",
                        String(SNAKE_WIN_SCORE),
                    )}
                </span>
                {highscore > 0 && (
                    <span
                        className="text-[var(--fg-muted)]"
                        data-testid="arcade-snake-highscore"
                    >
                        {t("arcade.snake.highscore", "Best: {n}").replace(
                            "{n}",
                            String(highscore),
                        )}
                    </span>
                )}
            </div>

            <div
                role="application"
                aria-label={t(
                    "arcade.snake.board_aria",
                    "Snake board - steer with the arrow keys or swipe",
                )}
                data-testid="arcade-snake-board"
                className="grid aspect-square w-full max-w-[24rem] touch-none select-none gap-px rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--border)] p-px"
                style={{
                    gridTemplateColumns: `repeat(${SNAKE_GRID_SIZE}, minmax(0, 1fr))`,
                }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {Array.from(
                    {length: SNAKE_GRID_SIZE * SNAKE_GRID_SIZE},
                    (_, index) => {
                        const x = index % SNAKE_GRID_SIZE;
                        const y = Math.floor(index / SNAKE_GRID_SIZE);
                        const isHead = head.x === x && head.y === y;
                        const isBody =
                            !isHead && snakeCells.has(`${x}:${y}`);
                        const isFood =
                            game.food.x === x && game.food.y === y;
                        const cellClass = isHead
                            ? "bg-[var(--accent)]"
                            : isBody
                              ? "bg-[var(--accent-subtle)]"
                              : isFood
                                ? "bg-[var(--method-contextual)]"
                                : "bg-[var(--bg-elevated)]";
                        return (
                            <div
                                key={index}
                                className={`aspect-square ${cellClass}`}
                            />
                        );
                    },
                )}
            </div>

            {finished && (
                <p
                    role="status"
                    data-testid="arcade-snake-result"
                    className="text-sm font-medium"
                >
                    {won
                        ? t(
                              "arcade.snake.won",
                              "Round won - {n} points!",
                          ).replace("{n}", String(game.score))
                        : t(
                              "arcade.snake.lost",
                              "Round over - {n} points. Try again!",
                          ).replace("{n}", String(game.score))}
                </p>
            )}

            <div className="flex flex-wrap gap-2">
                {!finished && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaused((p) => !p)}
                        data-testid="arcade-snake-pause"
                    >
                        {paused
                            ? t("arcade.resume", "Resume")
                            : t("arcade.pause", "Pause")}
                    </Button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={restart}
                    data-testid="arcade-snake-restart"
                >
                    {t("arcade.restart", "Restart")}
                </Button>
            </div>
        </div>
    );
}
