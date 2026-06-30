/**
 * MissionSettingsControl (EXP-010 / Phase 56I).
 *
 * Settings > Learning control for daily missions: on/off, count
 * (1-3), difficulty mix, and a (two-step, no browser dialog)
 * reset that regenerates today's missions. Backed by the
 * localStorage ``missionPref`` store the dashboard widget reads.
 */

import {useState} from "react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../../hooks/ui/useI18n";
import {readLearnerState} from "../../../../lib/learning/learnerState";
import {
    readMissionPrefs,
    setMissionCount,
    setMissionDifficultyMix,
    setMissionsEnabled,
} from "../../../../lib/missions/missionPref";
import {localTodayIso} from "../../../../lib/missions/schedule";
import type {DifficultyMix} from "../../../../lib/missions/types";
import {getStorage} from "../../../../storage";
import {notify} from "../../../../utils/notify";

const MIXES: DifficultyMix[] = ["balanced", "easy", "challenging"];

export default function MissionSettingsControl() {
    const {t, lang} = useI18n();
    const initial = readMissionPrefs();
    const [enabled, setEnabled] = useState(initial.enabled);
    const [count, setCount] = useState(initial.count);
    const [mix, setMix] = useState<DifficultyMix>(initial.difficultyMix);
    const [confirmReset, setConfirmReset] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleReset = async () => {
        if (!confirmReset) {
            setConfirmReset(true);
            return;
        }
        setConfirmReset(false);
        const userId = readLearnerState().userId;
        if (!userId) return;
        setResetting(true);
        try {
            await getStorage().missions.regenerate(userId, {
                count,
                difficultyMix: mix,
                todayIso: localTodayIso(lang),
            });
            notify.success(
                t("settings.missions_reset_done", "Today's missions reshuffled."),
            );
        } catch {
            notify.error(
                t("settings.missions_reset_failed", "Could not reset missions."),
            );
        } finally {
            setResetting(false);
        }
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-missions"
        >
            <h2 className="settings-section-title">
                {t("settings.missions_title", "Daily Missions")}
            </h2>

            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("settings.missions_enabled", "Daily missions")}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.missions_enabled_hint",
                            "Show a few achievable goals on the Dashboard each day. Optional - the app works the same without them.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-missions-toggle"
                    checked={enabled}
                    onChange={(e) => {
                        setEnabled(e.target.checked);
                        setMissionsEnabled(e.target.checked);
                    }}
                />
            </label>

            {enabled && (
                <>
                    <label className="form-row" data-testid="settings-missions-count-row">
                        <span className="form-label">
                            {t("settings.missions_count", "Missions per day")}
                        </span>
                        <select
                            data-testid="settings-missions-count"
                            value={count}
                            onChange={(e) => {
                                const next = Number(e.target.value);
                                setCount(next);
                                setMissionCount(next);
                            }}
                        >
                            {[1, 2, 3].map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="form-row" data-testid="settings-missions-mix-row">
                        <span className="form-label">
                            {t("settings.missions_difficulty", "Difficulty mix")}
                        </span>
                        <select
                            data-testid="settings-missions-mix"
                            value={mix}
                            onChange={(e) => {
                                const next = e.target.value as DifficultyMix;
                                setMix(next);
                                setMissionDifficultyMix(next);
                            }}
                        >
                            {MIXES.map((m) => (
                                <option key={m} value={m}>
                                    {t(
                                        `settings.missions_difficulty_${m}`,
                                        m,
                                    )}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="form-row">
                        <Button
                            type="button"
                            variant="destructive"
                            data-testid="settings-missions-reset"
                            disabled={resetting}
                            onClick={() => void handleReset()}
                        >
                            {confirmReset
                                ? t(
                                      "settings.missions_reset_confirm",
                                      "Confirm reset",
                                  )
                                : t("settings.missions_reset", "Reset today's missions")}
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}
