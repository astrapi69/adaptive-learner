/**
 * MemoryGame (#2887) - the content mini-game of the arcade: pairs of
 * term and translation drawn from the REAL cards of a downloaded set,
 * loaded through the storage abstraction so both modes work. The set
 * is picked in a dropdown (only sets whose content is actually
 * cached, #1816); the pair count comes from ``playfulArcadePref``.
 * Reduced motion keeps the reveal free of flip effects (plain state
 * swap, no transition).
 */

import {useEffect, useMemo, useState} from "react";

import {Button} from "@/components/ui/button";

import {useI18n} from "../../hooks/ui/useI18n";
import {
    initialMemory,
    drawMemoryPairs,
    revealCard,
    type MemoryPairInput,
    type MemoryState,
} from "../../lib/arcade/memory";
import {getStorage} from "../../storage";

type LoadStatus = "loading" | "ready" | "empty" | "error";

interface SetOption {
    source: string;
    id: string;
    title: string;
}

export interface MemoryGameProps {
    /** Pair count (already clamped by the pref). */
    pairCount: number;
}

export default function MemoryGame({pairCount}: MemoryGameProps) {
    const {t} = useI18n();
    const [sets, setSets] = useState<SetOption[]>([]);
    const [setId, setSetId] = useState<string>("");
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [pairs, setPairs] = useState<MemoryPairInput[]>([]);
    const [game, setGame] = useState<MemoryState | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const list = await getStorage().contentLoader.listSets();
                if (cancelled) return;
                // #1816 — the index lists every set of a registered repo;
                // only sets with cached content are playable offline.
                const cached = list.sets
                    .filter((s) => s.cached_version !== null)
                    .map((s) => ({source: s.source, id: s.id, title: s.title}));
                setSets(cached);
                if (cached.length === 0) {
                    setStatus("empty");
                } else {
                    setSetId((current) => current || cached[0].id);
                }
            } catch {
                if (!cancelled) setStatus("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!setId) return;
        const match = sets.find((s) => s.id === setId);
        if (!match) return;
        let cancelled = false;
        setStatus("loading");
        setGame(null);
        void (async () => {
            try {
                const storage = getStorage();
                const list = await storage.contentLoader.listLessons(
                    match.source,
                    match.id,
                );
                if (cancelled) return;
                const cards: {front: string; back: string}[] = [];
                for (const filename of list.lessons) {
                    if (cancelled) return;
                    try {
                        const lesson = await storage.contentLoader.getLesson(
                            match.source,
                            match.id,
                            filename,
                        );
                        cards.push(...lesson.cards);
                    } catch {
                        // Skip lessons we can't fetch (evicted from cache).
                    }
                }
                if (cancelled) return;
                const drawn = drawMemoryPairs(cards, pairCount, Math.random);
                if (drawn.length < 2) {
                    setStatus("empty");
                    return;
                }
                setPairs(drawn);
                setGame(initialMemory(drawn, Math.random));
                setStatus("ready");
            } catch {
                if (!cancelled) setStatus("error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [setId, sets, pairCount]);

    const columns = useMemo(() => {
        const cardCount = (game?.cards.length ?? pairCount * 2) || 8;
        return cardCount <= 12 ? 4 : cardCount <= 20 ? 5 : 6;
    }, [game, pairCount]);

    const restart = () => {
        if (pairs.length >= 2) {
            setGame(initialMemory(pairs, Math.random));
        }
    };

    return (
        <div className="flex flex-col gap-3" data-testid="arcade-memory">
            <label className="flex flex-wrap items-center gap-2 text-sm">
                {t("arcade.memory.set_label", "Lesson set")}
                <select
                    className="min-w-0"
                    value={setId}
                    onChange={(e) => setSetId(e.target.value)}
                    data-testid="arcade-memory-set"
                >
                    {sets.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.title}
                        </option>
                    ))}
                </select>
            </label>

            {status === "loading" && (
                <p className="text-sm text-[var(--fg-muted)]">
                    {t("arcade.memory.loading", "Loading cards ...")}
                </p>
            )}
            {status === "empty" && (
                <p className="text-sm" data-testid="arcade-memory-empty">
                    {t(
                        "arcade.memory.empty",
                        "No downloaded set with enough cards found. Download a lesson set first.",
                    )}
                </p>
            )}
            {status === "error" && (
                <p className="text-sm" data-testid="arcade-memory-error">
                    {t(
                        "arcade.memory.load_failed",
                        "Loading the cards failed. Try another set.",
                    )}
                </p>
            )}

            {status === "ready" && game && (
                <>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span data-testid="arcade-memory-progress">
                            {t("arcade.memory.progress", "Pairs: {a} / {b}")
                                .replace("{a}", String(game.matched.length))
                                .replace(
                                    "{b}",
                                    String(game.cards.length / 2),
                                )}
                        </span>
                        <span className="text-[var(--fg-muted)]">
                            {t(
                                "arcade.memory.attempts",
                                "Tries: {n}",
                            ).replace("{n}", String(game.attempts))}
                        </span>
                    </div>

                    <div
                        className="grid w-full max-w-[28rem] gap-2"
                        style={{
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        }}
                        data-testid="arcade-memory-board"
                    >
                        {game.cards.map((card) => {
                            const matched = game.matched.includes(card.pairId);
                            const revealed =
                                matched || game.revealed.includes(card.id);
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    disabled={matched || game.won}
                                    onClick={() =>
                                        setGame((state) =>
                                            state
                                                ? revealCard(state, card.id)
                                                : state,
                                        )
                                    }
                                    aria-pressed={revealed}
                                    data-testid={`arcade-memory-card-${card.id}`}
                                    className={`flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-md)] border p-1 text-center text-xs leading-tight motion-safe:transition-colors ${
                                        matched
                                            ? "border-[var(--success)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                                            : revealed
                                              ? "border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                                              : "border-[var(--border-strong)] bg-[var(--accent-subtle)] text-transparent"
                                    }`}
                                >
                                    <span className="line-clamp-3 wrap-anywhere">
                                        {revealed ? card.text : "?"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {game.won && (
                        <p
                            role="status"
                            data-testid="arcade-memory-won"
                            className="text-sm font-medium"
                        >
                            {t(
                                "arcade.memory.won",
                                "All pairs found in {n} tries!",
                            ).replace("{n}", String(game.attempts))}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={restart}
                            data-testid="arcade-memory-restart"
                        >
                            {t("arcade.restart", "Restart")}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
