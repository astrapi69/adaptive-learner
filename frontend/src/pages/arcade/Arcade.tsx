/**
 * Arcade page (#2887) - the game-mode arcade: two short, winnable
 * mini-games (learn memory free, classic snake XP-unlockable via the
 * shared cosmetics flow #2861). Reachable from the dashboard arcade
 * card; gated on the game mode AND the arcade switch - a direct visit
 * with the gate off shows a friendly notice instead of a dead page
 * (feature-state policy #335). Games award NO XP.
 */

import {useEffect, useState} from "react";
import {Link} from "react-router";

import {Button} from "@/components/ui/button";
import {DashboardCard, DashboardCardTitle} from "@/shared/layout";

import MemoryGame from "./MemoryGame";
import SnakeGame from "./SnakeGame";
import {useArcadePrefs} from "../../hooks/settings/useArcadePrefs";
import {useXpPurchase} from "../../hooks/gamification/useXpPurchase";
import {useI18n} from "../../hooks/ui/useI18n";
import {
    ARCADE_GAMES,
    type ArcadeGameId,
} from "../../lib/arcade/arcade-games";
import {
    ARCADE_UNLOCK_CHANGE_EVENT,
    addPurchasedArcadeGame,
    readArcadeUnlockState,
} from "../../lib/arcade/arcade-unlock-store";
import {
    ARCADE_TICKET_CHANGE_EVENT,
    readTicketState,
    spendTicket,
} from "../../lib/arcade/ticket-store";
import {
    PLAYFUL_TICKETS_CHANGE_EVENT,
    playfulTicketsActive,
} from "../../lib/learning/playful/playfulTicketsPref";
import {isUnlocked} from "../../lib/gamification/unlockables";
import {readLearnerState} from "../../lib/learning/learnerState";
import {getStorage} from "../../storage";

export default function Arcade() {
    const {t} = useI18n();
    const prefs = useArcadePrefs();
    const userId = readLearnerState().userId ?? "";
    const [totalXp, setTotalXp] = useState(0);
    const [purchased, setPurchased] = useState<string[]>(() =>
        userId ? readArcadeUnlockState(userId).purchased : [],
    );
    const [activeGame, setActiveGame] = useState<ArcadeGameId | null>(null);

    // #2889 - the ticket economy: the balance + the switch, both kept
    // live via their change events (a summary award in another tab or
    // a settings flip updates the open page).
    const [ticketsOn, setTicketsOn] = useState(() => playfulTicketsActive());
    const [tickets, setTickets] = useState(() =>
        userId ? readTicketState(userId).tickets : 0,
    );
    useEffect(() => {
        const refreshTickets = () => {
            setTicketsOn(playfulTicketsActive());
            setTickets(userId ? readTicketState(userId).tickets : 0);
        };
        window.addEventListener(ARCADE_TICKET_CHANGE_EVENT, refreshTickets);
        window.addEventListener(PLAYFUL_TICKETS_CHANGE_EVENT, refreshTickets);
        return () => {
            window.removeEventListener(
                ARCADE_TICKET_CHANGE_EVENT,
                refreshTickets,
            );
            window.removeEventListener(
                PLAYFUL_TICKETS_CHANGE_EVENT,
                refreshTickets,
            );
        };
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        void (async () => {
            try {
                const state = await getStorage().gamification.getState(userId);
                if (!cancelled && state) setTotalXp(state.total_xp);
            } catch {
                /* the buy button self-disables at 0 XP */
            }
        })();
        const refresh = () =>
            setPurchased(readArcadeUnlockState(userId).purchased);
        window.addEventListener(ARCADE_UNLOCK_CHANGE_EVENT, refresh);
        return () => {
            cancelled = true;
            window.removeEventListener(ARCADE_UNLOCK_CHANGE_EVENT, refresh);
        };
    }, [userId]);

    const purchase = useXpPurchase({
        userId,
        totalXp,
        reason: "arcade_game",
        failedText: t("settings.unlock_buy_failed", "Purchase failed."),
        onPurchased: (id, next) => {
            addPurchasedArcadeGame(userId, id);
            setTotalXp(next.total_xp);
        },
    });

    const unlockCtx = {
        level: 0,
        earnedBadgeKeys: new Set<string>(),
        purchased: new Set(purchased),
    };

    if (!prefs.active) {
        return (
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <h1>{t("arcade.title", "Arcade")}</h1>
                <DashboardCard data-testid="arcade-gate-notice">
                    <p className="text-sm">
                        {t(
                            "arcade.requires_playful",
                            "The arcade is part of the game mode. Turn on the game mode (and the arcade switch) in the settings.",
                        )}
                    </p>
                    <Link
                        to="/settings?tab=learning"
                        className="text-sm font-medium text-[var(--accent-text)]"
                    >
                        {t("arcade.open_settings", "Open settings")}
                    </Link>
                </DashboardCard>
            </div>
        );
    }

    return (
        <div
            className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6"
            data-testid="arcade-page"
        >
            <h1>{t("arcade.title", "Arcade")}</h1>
            <p className="text-sm text-[var(--fg-muted)]">
                {t(
                    "arcade.subtitle",
                    "Short rounds, one to two minutes - a game-mode reward. No XP, just fun.",
                )}
            </p>

            {/* #2889 - the ticket balance + how to earn more. */}
            {ticketsOn && (
                <div data-testid="arcade-tickets">
                    <p className="text-sm font-medium">
                        {t("arcade.tickets_label", "Tickets: {n}").replace(
                            "{n}",
                            String(tickets),
                        )}
                    </p>
                    <p className="text-xs text-[var(--fg-muted)]">
                        {t(
                            "arcade.tickets_hint",
                            "Earn tickets with perfect lessons, runs with all hearts, and streak milestones.",
                        )}
                    </p>
                </div>
            )}

            {activeGame === null ? (
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {ARCADE_GAMES.map((gameEntry) => {
                        const unlocked = isUnlocked(
                            gameEntry.id,
                            gameEntry.unlock,
                            unlockCtx,
                        );
                        const cost =
                            gameEntry.unlock.kind === "xp"
                                ? gameEntry.unlock.cost
                                : 0;
                        return (
                            <DashboardCard
                                key={gameEntry.id}
                                data-testid={`arcade-game-${gameEntry.id}`}
                            >
                                <DashboardCardTitle>
                                    {t(
                                        gameEntry.nameKey,
                                        gameEntry.nameFallback,
                                    )}
                                </DashboardCardTitle>
                                <p className="text-sm text-[var(--fg-muted)]">
                                    {t(
                                        gameEntry.descriptionKey,
                                        gameEntry.descriptionFallback,
                                    )}
                                </p>
                                {unlocked ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                            setActiveGame(gameEntry.id)
                                        }
                                        data-testid={`arcade-play-${gameEntry.id}`}
                                    >
                                        {t("arcade.play", "Play")}
                                    </Button>
                                ) : (
                                    <>
                                    {/* #2889 - one ticket buys one round of
                                        the locked game, next to the
                                        permanent XP unlock. */}
                                    {ticketsOn && tickets > 0 && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                                if (spendTicket(userId)) {
                                                    setActiveGame(
                                                        gameEntry.id,
                                                    );
                                                }
                                            }}
                                            data-testid={`arcade-ticket-play-${gameEntry.id}`}
                                        >
                                            {t(
                                                "arcade.ticket_play",
                                                "Play one round with a ticket",
                                            )}
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                            !userId ||
                                            purchase.busy ||
                                            totalXp < cost
                                        }
                                        title={
                                            totalXp < cost
                                                ? t(
                                                      "arcade.unlock_not_enough_xp",
                                                      "Not enough XP yet - keep learning!",
                                                  )
                                                : undefined
                                        }
                                        onClick={() =>
                                            void purchase.buy(
                                                gameEntry.id,
                                                cost,
                                            )
                                        }
                                        data-testid={`arcade-unlock-${gameEntry.id}`}
                                    >
                                        {purchase.confirmId === gameEntry.id
                                            ? t(
                                                  "arcade.unlock_confirm",
                                                  "Really unlock for {n} XP?",
                                              ).replace("{n}", String(cost))
                                            : t(
                                                  "arcade.unlock_for_xp",
                                                  "Unlock for {n} XP",
                                              ).replace("{n}", String(cost))}
                                    </Button>
                                    </>
                                )}
                            </DashboardCard>
                        );
                    })}
                </section>
            ) : (
                <section className="flex flex-col gap-3">
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveGame(null)}
                            data-testid="arcade-back"
                        >
                            {t("arcade.back_to_games", "Back to the games")}
                        </Button>
                    </div>
                    {activeGame === "snake" ? (
                        <SnakeGame seconds={prefs.snakeSeconds} />
                    ) : (
                        <MemoryGame pairCount={prefs.memoryPairs} />
                    )}
                </section>
            )}
        </div>
    );
}
