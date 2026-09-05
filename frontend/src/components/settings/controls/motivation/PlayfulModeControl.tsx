/**
 * PlayfulModeControl (#2844) - the Game Mode summary card.
 *
 * Settings > Learning card for the playful mode (Spielmodus). The
 * master switch persists in localStorage via ``playfulModePref``; every
 * change dispatches the pref-change event, so the lesson player and the
 * celebration components re-read live (no reload). When ON, lessons
 * celebrate like a game - the effective feedback intensity is raised to
 * "enthusiastic" and exercise renderers opt into playful presentation.
 *
 * The card also hosts the game-mode sound switch + its one-time offer
 * (#2875) and, since #2959, a status line counting the enabled extras
 * plus a remembered "Game mode details" fold (``SettingsDisclosure``,
 * collapsed by default, open state per viewer under
 * ``adaptive-learner.settings.playful_details_open``). The fold holds
 * the three detail blocks from ``./playful``: tension (hearts +
 * countdown ring, #2878), arcade and rewards (arcade + per-game numbers
 * #2887 / #2907, special rounds #2888, tickets #2889, bonus lessons
 * #2890) and XP + mascot (streak bonus XP #2893, mascot variant #2861).
 *
 * While the master switch is OFF every detail control is disabled and a
 * notice says why (#335: visible-but-disabled, never hidden). All the
 * ``playful*Active()`` gates AND ``readPlayfulMode()``, so those
 * controls have no effect until the master is on; the fold stays mounted
 * so the #1459 Learning-tab order pin and every testid keep resolving.
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {usePlayfulExtras} from "../../../../hooks/settings/usePlayfulExtras";
import {usePlayfulMode} from "../../../../hooks/settings/usePlayfulMode";
import FormHint from "../../../../shared/forms/FormHint";
import {SettingsDisclosure} from "../../SettingsDisclosure";
import {SettingsSection} from "../../SettingsSection";
import {
    PlayfulArcadeBlock,
    PlayfulTensionBlock,
    PlayfulXpBlock,
    SettingSwitchRow,
} from "./playful";
import {setPlayfulMode} from "../../../../lib/learning/playful/playfulModePref";
import {
    markPlayfulSoundsPrompted,
    readPlayfulSounds,
    readPlayfulSoundsPrompted,
    setPlayfulSounds,
} from "../../../../lib/learning/playful/playfulSoundsPref";

/** localStorage key of the remembered "Game mode details" open state. */
export const PLAYFUL_DETAILS_OPEN_KEY =
    "adaptive-learner.settings.playful_details_open";

export default function PlayfulModeControl() {
    const {t} = useI18n();
    const playful = usePlayfulMode();
    const extras = usePlayfulExtras();
    const [sounds, setSounds] = useState<boolean>(() => readPlayfulSounds());
    const [prompted, setPrompted] = useState<boolean>(() =>
        readPlayfulSoundsPrompted(),
    );

    const handleSoundsToggle = (next: boolean) => {
        setSounds(next);
        setPlayfulSounds(next);
        setPrompted(true);
    };

    const handleOfferLater = () => {
        markPlayfulSoundsPrompted();
        setPrompted(true);
    };

    const summaryText = t("settings.playful_summary", "{on} of {total} extras on")
        .replace("{on}", String(extras.on))
        .replace("{total}", String(extras.total));

    return (
        <SettingsSection
            title={t("settings.playful_mode_title", "Game Mode")}
            testid="settings-section-playful"
        >
            <SettingSwitchRow
                label={t("settings.playful_mode", "Playful lessons")}
                hint={t(
                    "settings.playful_mode_description",
                    "Turn lessons into a game: praise on every correct answer, confetti, and milestone celebrations. Works with every lesson mode; scoring and progress stay the same. Reduced-motion in your system still keeps feedback subtle.",
                )}
                checked={playful}
                onChange={setPlayfulMode}
                data-testid="settings-playful-mode-toggle"
            />
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
            <SettingSwitchRow
                label={t("settings.playful_sounds", "Game mode sounds")}
                hint={t(
                    "settings.playful_sounds_description",
                    "Short sounds in game mode: a tone on every correct answer (rising pitch per streak), a checkpoint jingle, and a completion fanfare. Independent of the global sounds switch; volume follows the slider.",
                )}
                checked={sounds}
                onChange={handleSoundsToggle}
                data-testid="settings-playful-sounds-toggle"
            />
            <FormHint data-testid="settings-playful-summary">{summaryText}</FormHint>
            <SettingsDisclosure
                title={t("settings.playful_details", "Game mode details")}
                hint={t(
                    "settings.playful_details_hint",
                    "Hearts, countdown, arcade, special rounds, tickets, bonus lessons, streak XP and mascot.",
                )}
                storageKey={PLAYFUL_DETAILS_OPEN_KEY}
                testid="settings-playful-details"
            >
                {!playful && (
                    <FormHint data-testid="settings-playful-details-off-notice">
                        {t(
                            "settings.playful_details_off_notice",
                            "Turn on \"Playful lessons\" to change these options.",
                        )}
                    </FormHint>
                )}
                <PlayfulTensionBlock disabled={!playful} />
                <PlayfulArcadeBlock disabled={!playful} />
                <PlayfulXpBlock disabled={!playful} />
            </SettingsDisclosure>
        </SettingsSection>
    );
}
