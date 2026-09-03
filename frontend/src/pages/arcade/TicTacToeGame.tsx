/**
 * TicTacToeGame (#2906) - the arcade's third mini-game: the learner
 * plays X against the deliberately beatable reducer AI (O). The AI
 * reply lands after a short "the app is thinking" beat so the two
 * moves read as turns; the timer is cleaned up on unmount. Rounds
 * end friendly in every outcome with a restart button.
 */

import {useEffect, useRef, useState} from "react";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../hooks/ui/useI18n";
import {
    aiMove,
    initialTtt,
    playerMove,
    type TttState,
} from "../../lib/arcade/tictactoe";

/** The "app is thinking" beat before the AI reply lands. */
const AI_DELAY_MS = 450;

export default function TicTacToeGame() {
    const {t} = useI18n();
    const [game, setGame] = useState<TttState>(() => initialTtt());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (game.turn !== "ai" || game.outcome !== "playing") return;
        timerRef.current = setTimeout(() => {
            setGame((state) => aiMove(state, Math.random));
        }, AI_DELAY_MS);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [game]);

    const status =
        game.outcome === "won"
            ? t("arcade.tictactoe.won", "You won - three in a row!")
            : game.outcome === "lost"
              ? t(
                    "arcade.tictactoe.lost",
                    "The app got this one - try again!",
                )
              : game.outcome === "draw"
                ? t("arcade.tictactoe.draw", "A draw - well defended!")
                : game.turn === "player"
                  ? t("arcade.tictactoe.your_turn", "Your turn (X)")
                  : t("arcade.tictactoe.ai_turn", "The app is thinking ...");

    return (
        <div className="flex flex-col gap-3" data-testid="arcade-tictactoe">
            <p
                className="text-sm font-medium"
                role="status"
                data-testid="arcade-ttt-status"
            >
                {status}
            </p>

            <div
                className="grid w-full max-w-[16rem] grid-cols-3 gap-2"
                role="group"
                aria-label={t(
                    "arcade.tictactoe.board_aria",
                    "Tic-tac-toe board - pick an empty cell",
                )}
                data-testid="arcade-ttt-board"
            >
                {game.board.map((cell, i) => {
                    const inLine = game.line?.includes(i) ?? false;
                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={
                                cell !== null ||
                                game.turn !== "player" ||
                                game.outcome !== "playing"
                            }
                            onClick={() =>
                                setGame((state) => playerMove(state, i))
                            }
                            data-testid={`arcade-ttt-cell-${i}`}
                            className={`flex aspect-square items-center justify-center rounded-[var(--radius-md)] border text-2xl font-semibold motion-safe:transition-colors ${
                                inLine
                                    ? "border-[var(--success)] bg-[var(--bg-elevated)]"
                                    : "border-[var(--border-strong)] bg-[var(--accent-subtle)]"
                            }`}
                        >
                            {cell === "x" ? "X" : cell === "o" ? "O" : ""}
                        </button>
                    );
                })}
            </div>

            {game.outcome !== "playing" && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setGame(initialTtt())}
                        data-testid="arcade-ttt-restart"
                    >
                        {t("arcade.restart", "Restart")}
                    </Button>
                </div>
            )}
        </div>
    );
}
