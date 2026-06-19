/**
 * ModeIndicator (EXP-010 / Phase 56L).
 *
 * Purely visual: shows the app is in Solo mode (active) and that a
 * Multiplayer mode is planned (coming soon, disabled). Sets user
 * expectations about the roadmap without any feature flag,
 * infrastructure, or click behaviour behind it.
 */

import {CheckCircle2, Lock} from "lucide-react";

import {useI18n} from "../hooks/ui/useI18n";

export default function ModeIndicator() {
    const {t} = useI18n();
    return (
        <section
            className="settings-section"
            data-testid="settings-section-mode"
        >
            <h2 className="settings-section-title">
                {t("settings.mode_title", "Mode")}
            </h2>
            <div className="mode-cards">
                <div
                    className="mode-card is-active"
                    data-testid="mode-card-solo"
                    aria-current="true"
                >
                    <span className="mode-card-icon">
                        <CheckCircle2 size={20} aria-hidden="true" />
                    </span>
                    <div className="mode-card-text">
                        <span className="mode-card-title">
                            {t("settings.mode_solo", "Solo Mode")}
                        </span>
                        <span className="mode-card-desc">
                            {t(
                                "settings.mode_solo_desc",
                                "Learn for yourself. All features available.",
                            )}
                        </span>
                    </div>
                </div>

                <div
                    className="mode-card is-disabled"
                    data-testid="mode-card-multiplayer"
                    aria-disabled="true"
                >
                    <span className="mode-card-icon">
                        <Lock size={20} aria-hidden="true" />
                    </span>
                    <div className="mode-card-text">
                        <span className="mode-card-title">
                            {t("settings.mode_multiplayer", "Multiplayer Mode")}
                            <span
                                className="mode-card-badge"
                                data-testid="mode-coming-soon"
                            >
                                {t("settings.mode_coming_soon", "Coming Soon")}
                            </span>
                        </span>
                        <span className="mode-card-desc">
                            {t(
                                "settings.mode_multiplayer_desc",
                                "Leaderboards, tournaments, friends. Coming in a future version.",
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
