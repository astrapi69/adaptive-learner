/**
 * MatchingResolveControl (#824, #3186).
 *
 * Settings > Learning card for the Matching exercise's post-check views:
 *
 * 1. "Corrections as a separate view" (#3186, default on): three views
 *    after checking (My answers / Corrections / Solve) instead of the
 *    #977 two views with the corrections inline in "My answers". Feeds
 *    {@link readMatchingSeparateCorrections}.
 * 2. The "Auflösen" (solve) reveal animation (#824). Feeds
 *    {@link readMatchingResolveEffect}:
 *   - Slide   → the right column reorders next to its partners
 *   - Color   → matching pairs share a background colour
 *   - Connect → animated lines link the correct pairs
 *   - Stack   → both columns collapse into stacked paired rows
 *
 * Both are presentation-only (no effect on scoring or SRS) and apply
 * live to an open exercise.
 */

import {useEffect, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useMatchingSeparateCorrections} from "../../../../hooks/settings/useMatchingSeparateCorrections";
import FormHint from "../../../../shared/forms/FormHint";
import {SettingsSection} from "../../SettingsSection";
import {writeMatchingSeparateCorrections} from "../../../../lib/learning/matchingReviewViewsPref";
import {
    MATCHING_RESOLVE_EFFECT_OPTIONS,
    MATCHING_RESOLVE_PREF_CHANGE_EVENT,
    readMatchingResolveEffect,
    writeMatchingResolveEffect,
    type MatchingResolveEffect,
} from "../../../../lib/learning/matchingResolvePref";

const LABELS: Record<MatchingResolveEffect, {key: string; fallback: string}> = {
    slide: {key: "settings.matching_resolve.slide", fallback: "Slide"},
    color: {key: "settings.matching_resolve.color", fallback: "Color"},
    connect: {key: "settings.matching_resolve.connect", fallback: "Connect"},
    stack: {key: "settings.matching_resolve.stack", fallback: "Stack"},
};

export default function MatchingResolveControl() {
    const {t} = useI18n();
    const separateCorrections = useMatchingSeparateCorrections();
    const [effect, setEffect] = useState<MatchingResolveEffect>(() =>
        readMatchingResolveEffect(),
    );

    useEffect(() => {
        const refresh = () => setEffect(readMatchingResolveEffect());
        window.addEventListener("storage", refresh);
        window.addEventListener(MATCHING_RESOLVE_PREF_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener(
                MATCHING_RESOLVE_PREF_CHANGE_EVENT,
                refresh,
            );
        };
    }, []);

    const onChange = (value: string) => {
        const next = value as MatchingResolveEffect;
        setEffect(next);
        writeMatchingResolveEffect(next);
    };

    return (
        <SettingsSection
            title={t("settings.matching_resolve.title", "Matching exercise")}
            testid="settings-section-matching-resolve"
        >
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t(
                            "settings.matching_review_views.label",
                            "Corrections as a separate view",
                        )}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.matching_review_views.desc",
                            "After checking, 'My answers' shows only your own pairs with your mistakes; the correct partners are under 'Corrections'. Off: the correct partner appears directly under each mistake in 'My answers'.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-matching-separate-corrections"
                    checked={separateCorrections}
                    onChange={(e) =>
                        writeMatchingSeparateCorrections(e.target.checked)
                    }
                />
            </label>
            <label className="flex flex-col gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.matching_resolve.label", "Solve animation")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.matching_resolve.hint",
                            "How the matching exercise reveals the correct pairs when you press 'Solve' after checking.",
                        )}
                    </FormHint>
                </span>
                <select
                    data-testid="settings-matching-resolve-effect"
                    value={effect}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {MATCHING_RESOLVE_EFFECT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                            {t(LABELS[opt].key, LABELS[opt].fallback)}
                        </option>
                    ))}
                </select>
            </label>
        </SettingsSection>
    );
}
