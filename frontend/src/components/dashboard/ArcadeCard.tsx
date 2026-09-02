/**
 * ArcadeCard (#2887) - the dashboard entry to the game-mode arcade.
 * Self-gating: renders ONLY while the game mode AND the arcade switch
 * are on (the issue's decided exception to "never hidden" - turning
 * the arcade switch off removes the card entirely; the arcade page
 * itself keeps the visible-with-reason notice for direct visits).
 */

import {useNavigate} from "react-router";

import {Button} from "@/components/ui/button";
import {DashboardCard, DashboardCardTitle} from "@/shared/layout";

import {useArcadePrefs} from "../../hooks/settings/useArcadePrefs";
import {useI18n} from "../../hooks/ui/useI18n";

export default function ArcadeCard() {
    const {t} = useI18n();
    const navigate = useNavigate();
    const prefs = useArcadePrefs();

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
