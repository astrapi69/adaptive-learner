/**
 * ReviewSettingsControl — Settings → Learning toggle for the
 * auto-generated error explanations shown after a lesson (#599).
 * Persists via lib/review/reviewPref (localStorage, mode-agnostic).
 */

import {useState} from "react";

import {useI18n} from "../hooks/ui/useI18n";
import {
    readExplanationsEnabled,
    setExplanationsEnabled,
} from "../lib/review/reviewPref";
import {
    readReviewLimit,
    REVIEW_LIMIT_OPTIONS,
    writeReviewLimit,
} from "../lib/learning/reviewLimitPref";

export default function ReviewSettingsControl() {
    const {t} = useI18n();
    const [enabled, setEnabled] = useState(() => readExplanationsEnabled());
    const [limit, setLimit] = useState(() => readReviewLimit());

    const handle = (next: boolean) => {
        setEnabled(next);
        setExplanationsEnabled(next);
    };

    const handleLimit = (next: number) => {
        setLimit(next);
        writeReviewLimit(next);
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
            <label className="form-row">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.review_limit.label",
                            "Questions per review",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.review_limit.desc",
                            "How many elements one review session presents before it ends. More due items roll over to the next round.",
                        )}
                    </span>
                </span>
                <select
                    className="min-h-11 w-24 rounded-md border border-input bg-background px-2 text-foreground"
                    data-testid="settings-review-limit"
                    value={limit}
                    onChange={(e) => handleLimit(parseInt(e.target.value, 10))}
                >
                    {REVIEW_LIMIT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
        </section>
    );
}
