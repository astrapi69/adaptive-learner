/**
 * SimonGame (#2907) - the arcade's color-sequence memory game over
 * the pure ``lib/arcade/simon`` reducer. Playback is driven by a
 * tick interval (like the snake tick); each lit pad also plays its
 * synth tone through the game-mode sound infrastructure (#2875) -
 * silent without the sound opt-in, the colors carry the
 * information. Highlighting is a plain state change (token swap +
 * ring), so reduced-motion users get no flashing animation; the
 * scale pop is motion-safe only.
 */

import {useEffect, useRef, useState} from "react";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../hooks/ui/useI18n";
import {
    SIMON_PAD_COUNT,
    type SimonState,
    initialSimon,
    pressPad,
    stepPlayback,
} from "../../lib/arcade/simon";
import {playSound, type SoundName} from "../../lib/audio/sound-effects";

/** Playback tick: one tick lights a pad, the next is the gap. */
const TICK_MS = 420;

/** How long a pressed pad stays highlighted in the input phase. */
const PRESS_FLASH_MS = 250;

const PAD_SOUNDS: SoundName[] = ["simon_1", "simon_2", "simon_3", "simon_4"];

/** The classic simon palette, one status/brand token per pad. */
const PAD_CLASSES = [
    "bg-[var(--success)]",
    "bg-[var(--error)]",
    "bg-[var(--warning)]",
    "bg-[var(--accent)]",
];

export interface SimonGameProps {
    /** Winning sequence length (already clamped by the pref). */
    target: number;
}

export default function SimonGame({target}: SimonGameProps) {
    const {t} = useI18n();
    const [game, setGame] = useState<SimonState>(() =>
        initialSimon(target, Math.random),
    );
    const [pressedPad, setPressedPad] = useState<number | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (game.phase !== "playback") return;
        const tick = window.setInterval(() => {
            setGame((state) => stepPlayback(state));
        }, TICK_MS);
        return () => window.clearInterval(tick);
    }, [game.phase]);

    // The playback tone follows the lit pad; playSound self-gates on
    // the sound opt-in, so this is a silent no-op by default.
    useEffect(() => {
        if (game.litPad !== null) playSound(PAD_SOUNDS[game.litPad]);
    }, [game.litPad]);

    useEffect(
        () => () => {
            if (flashTimer.current) clearTimeout(flashTimer.current);
        },
        [],
    );

    const press = (pad: number) => {
        playSound(PAD_SOUNDS[pad]);
        setPressedPad(pad);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(
            () => setPressedPad(null),
            PRESS_FLASH_MS,
        );
        setGame((state) => pressPad(state, pad, Math.random));
    };

    const restart = () => {
        setPressedPad(null);
        setGame(initialSimon(target, Math.random));
    };

    const status =
        game.phase === "won"
            ? t("arcade.simon.won", "You did it - the whole sequence!")
            : game.phase === "lost"
              ? t(
                    "arcade.simon.lost",
                    "Oops - you reached length {n}. Try again!",
                ).replace("{n}", String(game.reached))
              : game.phase === "input"
                ? t(
                      "arcade.simon.your_turn",
                      "Your turn - repeat the sequence",
                  )
                : t("arcade.simon.watch", "Watch the sequence ...");

    return (
        <div className="flex flex-col gap-3" data-testid="arcade-simon">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span
                    className="font-medium"
                    role="status"
                    data-testid="arcade-simon-status"
                >
                    {status}
                </span>
                <span
                    className="text-[var(--fg-muted)]"
                    data-testid="arcade-simon-round"
                >
                    {t("arcade.simon.round_label", "Sequence {n} of {m}")
                        .replace("{n}", String(game.sequence.length))
                        .replace("{m}", String(game.target))}
                </span>
            </div>

            <div
                role="group"
                aria-label={t(
                    "arcade.simon.board_aria",
                    "Simon board - four color fields",
                )}
                data-testid="arcade-simon-board"
                className="grid w-full max-w-[16rem] grid-cols-2 gap-2"
            >
                {Array.from({length: SIMON_PAD_COUNT}, (_, pad) => {
                    const lit = game.litPad === pad || pressedPad === pad;
                    return (
                        <button
                            key={pad}
                            type="button"
                            disabled={game.phase !== "input"}
                            onClick={() => press(pad)}
                            aria-label={t(
                                "arcade.simon.pad_aria",
                                "Color field {n}",
                            ).replace("{n}", String(pad + 1))}
                            data-testid={`arcade-simon-pad-${pad}`}
                            data-lit={lit ? "true" : undefined}
                            className={`aspect-square rounded-[var(--radius-md)] border motion-safe:transition-all ${
                                PAD_CLASSES[pad]
                            } ${
                                lit
                                    ? "border-[var(--fg-primary)] ring-2 ring-[var(--fg-primary)] motion-safe:scale-105"
                                    : "border-transparent opacity-40"
                            }`}
                        />
                    );
                })}
            </div>

            {(game.phase === "won" || game.phase === "lost") && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={restart}
                        data-testid="arcade-simon-restart"
                    >
                        {t("arcade.restart", "Restart")}
                    </Button>
                </div>
            )}
        </div>
    );
}
