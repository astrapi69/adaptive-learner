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
import MascotVariantControl from "./MascotVariantControl";
import {
    readPlayfulMode,
    setPlayfulMode,
} from "../../../../lib/learning/playfulModePref";
import {
    markPlayfulSoundsPrompted,
    readPlayfulSounds,
    readPlayfulSoundsPrompted,
    setPlayfulSounds,
} from "../../../../lib/learning/playfulSoundsPref";

export default function PlayfulModeControl() {
    const {t} = useI18n();
    const [playful, setPlayful] = useState<boolean>(() => readPlayfulMode());
    // #2875 — the game-mode sound switch + the one-time offer state.
    const [sounds, setSounds] = useState<boolean>(() => readPlayfulSounds());
    const [prompted, setPrompted] = useState<boolean>(() =>
        readPlayfulSoundsPrompted(),
    );

    const handleToggle = (next: boolean) => {
        setPlayful(next);
        setPlayfulMode(next);
    };

    const handleSoundsToggle = (next: boolean) => {
        setSounds(next);
        setPlayfulSounds(next);
        setPrompted(true);
    };

    const handleOfferLater = () => {
        markPlayfulSoundsPrompted();
        setPrompted(true);
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
            {playful && !prompted && (
                <div
                    role="status"
                    data-testid="settings-playful-sounds-offer"
                    className="flex flex-wrap items-center gap-2 rounded-sm border border-[var(--accent)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                >
                    <span className="flex-1 font-medium">
                        {t("settings.playful_sounds_offer", "Play with sound?")}
                    </span>
                    <button
                        type="button"
                        onClick={() => handleSoundsToggle(true)}
                        data-testid="settings-playful-sounds-offer-yes"
                        className="rounded-sm border border-[var(--accent)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
                    >
                        {t("settings.playful_sounds_offer_yes", "Yes, sounds on")}
                    </button>
                    <button
                        type="button"
                        onClick={handleOfferLater}
                        data-testid="settings-playful-sounds-offer-later"
                        className="rounded-sm border border-[var(--border-strong)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
                    >
                        {t("settings.playful_sounds_offer_later", "Later")}
                    </button>
                </div>
            )}
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_sounds", "Game mode sounds")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_sounds_description",
                            "Short sounds in game mode: a tone on every correct answer (rising pitch per streak), a checkpoint jingle, and a completion fanfare. Independent of the global sounds switch; volume follows the slider.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-sounds-toggle"
                    checked={sounds}
                    onChange={(e) => handleSoundsToggle(e.target.checked)}
                />
            </label>
            <MascotVariantControl />
        </SettingsSection>
    );
}
