/**
 * ArcadeCard (#2887) - the dashboard entry to the game-mode arcade.
 * Absent while the game mode is off (the card belongs to the game mode,
 * not to the dashboard). With the game mode on and the arcade switch
 * off it stays visible as a disabled card (#3216, the feature-state
 * policy: header stays, a notice names the switch that is off and links
 * to the settings, no controls); the #2887 exception that removed the
 * card entirely is lifted. Fully active only with both switches on.
 */

import {useEffect, useState} from "react";
import {Link, useNavigate} from "react-router";

import {Button} from "@/components/ui/button";
import {DashboardCard, DashboardCardTitle} from "@/shared/layout";

import {useArcadePrefs} from "../../hooks/settings/useArcadePrefs";
import {useI18n} from "../../hooks/ui/useI18n";
import {
    ARCADE_TICKET_CHANGE_EVENT,
    readTicketState,
} from "../../lib/arcade/ticket-store";
import {readLearnerState} from "../../lib/learning/learnerState";
import {readPlayfulMode} from "../../lib/learning/playful/playfulModePref";
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

    if (!prefs.active) {
        // Game mode off: the arcade is not part of this dashboard at all.
        if (!readPlayfulMode()) return null;
        // Game mode on, arcade switch off: disabled with the reason (#3216).
        return (
            <DashboardCard data-testid="arcade-card-disabled">
                <DashboardCardTitle>
                    {t("arcade.title", "Arcade")}
                </DashboardCardTitle>
                <p
                    className="text-sm text-[var(--fg-muted)]"
                    data-testid="arcade-card-disabled-reason"
                >
                    {t(
                        "arcade.requires_arcade_switch",
                        "The game mode is on, but the arcade switch is off. Turn on the arcade in the game mode details in the settings.",
                    )}
                </p>
                <Link
                    to="/settings?tab=learning&section=motivation"
                    className="text-sm underline"
                    data-testid="arcade-card-disabled-settings"
                >
                    {t("arcade.open_settings", "Open settings")}
                </Link>
            </DashboardCard>
        );
    }

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
