/**
 * PlayfulModeControl (#2844).
 *
 * Settings > Learning control for the playful mode (Spielmodus):
 * one on/off switch, persisted in localStorage via
 * ``playfulModePref``. When ON, lessons celebrate like a game — the
 * effective feedback intensity is raised to "enthusiastic" and
 * exercise renderers can opt into playful presentation. Changing it
 * dispatches the pref-change event so the lesson player and every
 * celebration component re-read live (no reload).
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {SettingsSection} from "../../SettingsSection";
import {
    readPlayfulMode,
    setPlayfulMode,
} from "../../../../lib/learning/playfulModePref";

export default function PlayfulModeControl() {
    const {t} = useI18n();
    const [playful, setPlayful] = useState<boolean>(() => readPlayfulMode());

    const handleToggle = (next: boolean) => {
        setPlayful(next);
        setPlayfulMode(next);
    };

    return (
        <SettingsSection
            title={t("settings.playful_mode_title", "Game Mode")}
            testid="settings-section-playful"
        >
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_mode", "Playful lessons")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_mode_description",
                            "Turn lessons into a game: praise on every correct answer, confetti, and milestone celebrations. Works with every lesson mode; scoring and progress stay the same. Reduced-motion in your system still keeps feedback subtle.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-mode-toggle"
                    checked={playful}
                    onChange={(e) => handleToggle(e.target.checked)}
                />
            </label>
        </SettingsSection>
    );
}
