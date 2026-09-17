/**
 * PlayfulXpBlock (split out of PlayfulModeControl by #2959).
 *
 * The "XP and mascot" cluster of the game-mode details: the streak
 * (combo) bonus XP switch + per-lesson cap (#2893, the one decided XP
 * exception, DEFAULT ON) and the Lernfunke mascot variant picker
 * (#2861). The cap is editable only while the switch is on; the whole
 * block - mascot buttons included - is disabled while the master game
 * mode switch is off (``disabled`` prop).
 */

import {useState} from "react";

import {useI18n} from "@/hooks/ui/useI18n";
import {
    MAX_COMBO_XP_CAP,
    MIN_COMBO_XP_CAP,
    clampComboXpCap,
    readComboXpCap,
    readPlayfulComboXp,
    setComboXpCap,
    setPlayfulComboXp,
} from "@/lib/learning/playful/playfulComboXpPref";
import MascotVariantControl from "../MascotVariantControl";
import {SettingNumberRow, SettingSwitchRow} from "./SettingRows";
import type {PlayfulBlockProps} from "./types";

export default function PlayfulXpBlock({disabled}: PlayfulBlockProps) {
    const {t} = useI18n();
    const [comboXp, setComboXp] = useState<boolean>(() => readPlayfulComboXp());
    const [comboCap, setComboCap] = useState<number>(() => readComboXpCap());

    const handleComboXpToggle = (next: boolean) => {
        setComboXp(next);
        setPlayfulComboXp(next);
    };
    const handleComboCap = (raw: string) => {
        const clamped = clampComboXpCap(Number(raw));
        setComboCap(clamped);
        setComboXpCap(clamped);
    };

    return (
        <div
            className="flex flex-col gap-3"
            data-testid="settings-playful-block-xp"
        >
            <h3 className="m-0 text-base font-semibold">
                {t("settings.playful_cluster_xp", "XP and mascot")}
            </h3>
            <SettingSwitchRow
                label={t("settings.playful_combo_xp", "Streak bonus XP")}
                hint={t(
                    "settings.playful_combo_xp_description",
                    "From the third streak answer, every correct answer in a row earns +1 bonus XP, capped per lesson. Off keeps game-mode XP identical to normal mode.",
                )}
                checked={comboXp}
                disabled={disabled}
                onChange={handleComboXpToggle}
                data-testid="settings-playful-combo-xp-toggle"
            />
            <SettingNumberRow
                label={t("settings.playful_combo_xp_cap", "Bonus XP cap per lesson")}
                value={comboCap}
                min={MIN_COMBO_XP_CAP}
                max={MAX_COMBO_XP_CAP}
                disabled={disabled || !comboXp}
                onChange={handleComboCap}
                data-testid="settings-playful-combo-xp-cap"
            />
            <MascotVariantControl disabled={disabled} />
        </div>
    );
}
