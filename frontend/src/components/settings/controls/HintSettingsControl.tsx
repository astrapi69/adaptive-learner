/**
 * HintSettingsControl — Settings → Learning control for the exercise
 * hint system (#590): a master enable toggle and the per-hint XP cost.
 *
 * Persists via the localStorage helpers in ``lib/hints/hintPref`` (same
 * pattern as the feedback/sound controls). Per the feature-state policy
 * the XP-cost input stays visible but disabled when hints are off,
 * rather than vanishing.
 */

import {useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
    MAX_HINT_XP_COST,
    clampHintXpCost,
    readHintXpCost,
    readHintsEnabled,
    setHintXpCost,
    setHintsEnabled,
} from "../../../lib/hints/hintPref";

export default function HintSettingsControl() {
    const {t} = useI18n();
    const [enabled, setEnabled] = useState(() => readHintsEnabled());
    const [cost, setCost] = useState(() => readHintXpCost());

    const handleEnabled = (next: boolean) => {
        setEnabled(next);
        setHintsEnabled(next);
    };
    const handleCost = (raw: string) => {
        const next = clampHintXpCost(Number(raw));
        setCost(next);
        setHintXpCost(next);
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-hints"
        >
            <h2 className="settings-section-title">
                {t("settings.section_hints", "Hints")}
            </h2>
            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.hints_enabled",
                            "Show hints during exercises",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.hints_enabled_desc",
                            "Offer a staged hint button on each exercise.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-hints-toggle"
                    checked={enabled}
                    onChange={(e) => handleEnabled(e.target.checked)}
                />
            </label>
            <label className="form-row">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("settings.hint_xp_cost", "XP cost per hint")}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.hint_xp_cost_desc",
                            "Shown on the hint button. Set to 0 for free hints.",
                        )}
                    </span>
                </span>
                <input
                    type="number"
                    min={0}
                    max={MAX_HINT_XP_COST}
                    value={cost}
                    disabled={!enabled}
                    onChange={(e) => handleCost(e.target.value)}
                    data-testid="settings-hint-xp-cost"
                />
            </label>
        </section>
    );
}
