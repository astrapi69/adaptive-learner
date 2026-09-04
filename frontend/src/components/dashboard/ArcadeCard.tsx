/**
 * ArcadeCard (#2887) - the dashboard entry to the game-mode arcade.
 * Self-gating: renders ONLY while the game mode AND the arcade switch
 * are on (the issue's decided exception to "never hidden" - turning
 * the arcade switch off removes the card entirely; the arcade page
 * itself keeps the visible-with-reason notice for direct visits).
 */

import {useEffect, useState} from "react";
import {useNavigate} from "react-router";

import {Button} from "@/components/ui/button";
import {DashboardCard, DashboardCardTitle} from "@/shared/layout";

import {useArcadePrefs} from "../../hooks/settings/useArcadePrefs";
import {useI18n} from "../../hooks/ui/useI18n";
import {
    ARCADE_TICKET_CHANGE_EVENT,
    readTicketState,
} from "../../lib/arcade/ticket-store";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    PLAYFUL_TICKETS_CHANGE_EVENT,
    playfulTicketsActive,
} from "../../lib/learning/playful/playfulTicketsPref";

export default function ArcadeCard() {
    const {t} = useI18n();
    const navigate = useNavigate();
    const prefs = useArcadePrefs();

    // #2889 - the ticket balance on the dashboard card, live via the
    // store + pref change events.
    const userId = readLearnerState().userId ?? "";
    const [ticketsOn, setTicketsOn] = useState(() => playfulTicketsActive());
    const [tickets, setTickets] = useState(() =>
        userId ? readTicketState(userId).tickets : 0,
    );
    useEffect(() => {
        const refresh = () => {
            setTicketsOn(playfulTicketsActive());
            setTickets(userId ? readTicketState(userId).tickets : 0);
        };
        window.addEventListener(ARCADE_TICKET_CHANGE_EVENT, refresh);
        window.addEventListener(PLAYFUL_TICKETS_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener(ARCADE_TICKET_CHANGE_EVENT, refresh);
            window.removeEventListener(PLAYFUL_TICKETS_CHANGE_EVENT, refresh);
        };
    }, [userId]);

    if (!prefs.active) return null;

    return (
        <DashboardCard data-testid="arcade-card">
            <DashboardCardTitle>
                {t("arcade.title", "Arcade")}
            </DashboardCardTitle>
            <p className="text-sm text-[var(--fg-muted)]">
                {t(
                    "arcade.card_description",
                    "Short rounds of Learn Memory and Snake - your game-mode reward.",
                )}
            </p>
            {ticketsOn && (
                <p
                    className="text-sm font-medium"
                    data-testid="arcade-card-tickets"
                >
                    {t("arcade.tickets_label", "Tickets: {n}").replace(
                        "{n}",
                        String(tickets),
                    )}
                </p>
            )}
            <Button
                type="button"
                size="sm"
                onClick={() => navigate("/arcade")}
                data-testid="arcade-card-open"
            >
                {t("arcade.card_open", "To the arcade")}
            </Button>
        </DashboardCard>
    );
}
