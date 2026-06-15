/**
 * ReviewSettingsControl — Settings → Learning toggle for the
 * auto-generated error explanations shown after a lesson (#599).
 * Persists via lib/review/reviewPref (localStorage, mode-agnostic).
 */

import {useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {
    readExplanationsEnabled,
    setExplanationsEnabled,
} from "../lib/review/reviewPref";

export default function ReviewSettingsControl() {
    const {t} = useI18n();
    const [enabled, setEnabled] = useState(() => readExplanationsEnabled());

    const handle = (next: boolean) => {
        setEnabled(next);
        setExplanationsEnabled(next);
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-review"
        >
            <h2 className="settings-section-title">
                {t("settings.section_review", "Review")}
            </h2>
            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.explanations_enabled",
                            "Show error explanations",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.explanations_enabled_desc",
                            "After a lesson, show a short rule tip for each mistake.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-explanations-toggle"
                    checked={enabled}
                    onChange={(e) => handle(e.target.checked)}
                />
            </label>
        </section>
    );
}
