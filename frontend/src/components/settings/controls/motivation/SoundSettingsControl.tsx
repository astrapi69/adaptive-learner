/**
 * SoundSettingsControl (EXP-008 / Phase 55F).
 *
 * Settings > Interface control for the synthesized feedback
 * sounds. Sound is OFF by default; turning it on reveals a master
 * volume slider and a test button (plays the "star earned"
 * chime). Sounds are always supplementary to the visual feedback.
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {playSound} from "../../../../lib/audio/sound-effects";
import {
    readSoundEnabled,
    readSoundVolume,
    setSoundEnabled,
    setSoundVolume,
} from "../../../../lib/feedback/feedbackPref";

export default function SoundSettingsControl() {
    const {t} = useI18n();
    const [enabled, setEnabled] = useState<boolean>(() => readSoundEnabled());
    const [volume, setVolume] = useState<number>(() => readSoundVolume());

    const handleToggle = (next: boolean) => {
        setEnabled(next);
        setSoundEnabled(next);
    };

    const handleVolume = (next: number) => {
        setVolume(next);
        setSoundVolume(next);
    };

    return (
        <div data-testid="settings-sounds">
            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("settings.sounds", "Sounds")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.sounds_description",
                            "Play short synthesized chimes on correct answers, stars, and milestones. Off by default; sounds never carry information that isn't also shown.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-sounds-toggle"
                    checked={enabled}
                    onChange={(e) => handleToggle(e.target.checked)}
                />
            </label>

            {enabled && (
                <div
                    className="form-row form-row-stack"
                    data-testid="settings-sounds-volume-row"
                >
                    <label
                        className="form-label"
                        htmlFor="settings-sounds-volume"
                    >
                        {t("settings.sounds_volume", "Volume")}
                    </label>
                    <div className="sounds-volume-row">
                        <input
                            id="settings-sounds-volume"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={volume}
                            data-testid="settings-sounds-volume"
                            onChange={(e) =>
                                handleVolume(Number(e.target.value))
                            }
                        />
                        <span
                            className="sounds-volume-value"
                            data-testid="settings-sounds-volume-value"
                        >
                            {volume}%
                        </span>
                        <button
                            type="button"
                            className="btn"
                            data-testid="settings-sounds-test"
                            onClick={() => playSound("star_earned")}
                        >
                            {t("settings.sounds_test", "Test")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
