/**
 * MatchingResolveControl (#824).
 *
 * Settings > Learning control for the Matching exercise's "Auflösen"
 * (solve) reveal animation. Feeds {@link readMatchingResolveEffect}:
 *   - Slide   → the right column reorders next to its partners
 *   - Color   → matching pairs share a background colour
 *   - Connect → animated lines link the correct pairs
 *   - Stack   → both columns collapse into stacked paired rows
 */

import {useEffect, useState} from "react";

import {useI18n} from "../hooks/ui/useI18n";
import {
    MATCHING_RESOLVE_EFFECT_OPTIONS,
    MATCHING_RESOLVE_PREF_CHANGE_EVENT,
    readMatchingResolveEffect,
    writeMatchingResolveEffect,
    type MatchingResolveEffect,
} from "../lib/learning/matchingResolvePref";

const LABELS: Record<MatchingResolveEffect, {key: string; fallback: string}> = {
    slide: {key: "settings.matching_resolve.slide", fallback: "Slide"},
    color: {key: "settings.matching_resolve.color", fallback: "Color"},
    connect: {key: "settings.matching_resolve.connect", fallback: "Connect"},
    stack: {key: "settings.matching_resolve.stack", fallback: "Stack"},
};

export default function MatchingResolveControl() {
    const {t} = useI18n();
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
        <section
            className="settings-section"
            data-testid="settings-section-matching-resolve"
        >
            <h2 className="settings-section-title">
                {t("settings.matching_resolve.title", "Solve animation")}
            </h2>
            <p className="form-hint">
                {t(
                    "settings.matching_resolve.hint",
                    "How the matching exercise reveals the correct pairs when you press 'Solve' after checking.",
                )}
            </p>
            <label className="form-row">
                <span className="form-label">
                    {t("settings.matching_resolve.label", "Effect")}
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
        </section>
    );
}
