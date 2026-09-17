/**
 * SoundSettingsControl (EXP-008 / Phase 55F).
 *
 * Settings > Learning control for the synthesized feedback
 * sounds. Sound is OFF by default. The master volume slider and the
 * test button (plays the "star earned" chime) are ALWAYS visible
 * (#2957): ``soundOutputEnabled`` ORs this global toggle with the
 * game-mode sounds toggle, so a learner with only game-mode sounds
 * on still needs the volume control. A hint under the slider says
 * so. Sounds are always supplementary to the visual feedback.
 */

import {useState} from "react";

import {Button} from "@/components/ui/button";

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
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
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
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-sounds-toggle"
                    checked={enabled}
                    onChange={(e) => handleToggle(e.target.checked)}
                />
            </label>

            <div
                className="flex flex-col items-stretch gap-1"
                data-testid="settings-sounds-volume-row"
            >
                <label
                    className="text-[0.95rem] font-medium"
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
                        onChange={(e) => handleVolume(Number(e.target.value))}
                    />
                    <span
                        className="sounds-volume-value"
                        data-testid="settings-sounds-volume-value"
                    >
                        {volume}%
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        data-testid="settings-sounds-test"
                        onClick={() => playSound("star_earned")}
                    >
                        {t("settings.sounds_test", "Test")}
                    </Button>
                </div>
                <FormHint
                    as="span"
                    data-testid="settings-sounds-volume-shared-hint"
                >
                    {t(
                        "settings.sounds_volume_shared_hint",
                        "Also applies to the game-mode sounds.",
                    )}
                </FormHint>
            </div>
        </div>
    );
}
