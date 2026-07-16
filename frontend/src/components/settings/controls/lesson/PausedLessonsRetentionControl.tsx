/**
 * PausedLessonsRetentionControl (Phase 63F / EXP-020).
 *
 * Settings > Learning control that lets the learner choose how
 * long paused lessons are kept before being auto-abandoned.
 * Stored client-side in localStorage (same pattern as
 * DirectionStrategyControl / MissionSettingsControl).
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {
    RETENTION_OPTIONS,
    readRetentionDays,
    writeRetentionDays,
} from "../../../../lib/learning/pausedRetentionPref";

export default function PausedLessonsRetentionControl() {
    const {t} = useI18n();
    const [days, setDays] = useState<number>(() => readRetentionDays());

    const onChange = (value: string) => {
        const next = parseInt(value, 10);
        setDays(next);
        writeRetentionDays(next);
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-paused-retention"
        >
            <h2 className="settings-section-title">
                {t(
                    "settings.paused_retention.title",
                    "Paused lesson retention",
                )}
            </h2>
            <FormHint>
                {t(
                    "settings.paused_retention.hint",
                    "Paused lessons older than this are automatically abandoned. Up to 10 paused lessons are kept regardless of age.",
                )}
            </FormHint>
            <label className="form-row">
                <span className="form-label">
                    {t(
                        "settings.paused_retention.label",
                        "Keep paused lessons for",
                    )}
                </span>
                <select
                    data-testid="settings-paused-retention-select"
                    value={String(days)}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {RETENTION_OPTIONS.map((opt) => (
                        <option key={opt.days} value={String(opt.days)}>
                            {t(opt.labelKey, opt.fallback)}
                        </option>
                    ))}
                </select>
            </label>
        </section>
    );
}
