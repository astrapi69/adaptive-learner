/**
 * PlayfulTensionBlock (#2878, split out of PlayfulModeControl by #2959).
 *
 * The "Tension" cluster of the game-mode details: hearts (lives per
 * lesson run + count) and the per-exercise countdown ring (+ seconds).
 * Both default OFF; the number inputs are editable only while their own
 * switch is on, and the whole block is disabled while the master game
 * mode switch is off (``disabled`` prop). Every write persists through
 * ``playfulTensionPref`` and dispatches its change event, so an open
 * lesson re-reads live.
 */

import {useState} from "react";

import {useI18n} from "@/hooks/ui/useI18n";
import {
    MAX_COUNTDOWN_SECONDS,
    MAX_HEARTS_COUNT,
    MIN_COUNTDOWN_SECONDS,
    MIN_HEARTS_COUNT,
    clampCountdownSeconds,
    clampHeartsCount,
    readPlayfulCountdown,
    readPlayfulCountdownSeconds,
    readPlayfulHearts,
    readPlayfulHeartsCount,
    setPlayfulCountdown,
    setPlayfulCountdownSeconds,
    setPlayfulHearts,
    setPlayfulHeartsCount,
} from "@/lib/learning/playful/playfulTensionPref";
import {SettingNumberRow, SettingSwitchRow} from "./SettingRows";
import type {PlayfulBlockProps} from "./types";

export default function PlayfulTensionBlock({disabled}: PlayfulBlockProps) {
    const {t} = useI18n();
    const [hearts, setHearts] = useState<boolean>(() => readPlayfulHearts());
    const [heartsCount, setHeartsCount] = useState<number>(() =>
        readPlayfulHeartsCount(),
    );
    const [countdown, setCountdown] = useState<boolean>(() =>
        readPlayfulCountdown(),
    );
    const [countdownSeconds, setCountdownSeconds] = useState<number>(() =>
        readPlayfulCountdownSeconds(),
    );

    const handleHeartsToggle = (next: boolean) => {
        setHearts(next);
        setPlayfulHearts(next);
    };
    const handleHeartsCount = (raw: string) => {
        const clamped = clampHeartsCount(Number(raw));
        setHeartsCount(clamped);
        setPlayfulHeartsCount(clamped);
    };
    const handleCountdownToggle = (next: boolean) => {
        setCountdown(next);
        setPlayfulCountdown(next);
    };
    const handleCountdownSeconds = (raw: string) => {
        const clamped = clampCountdownSeconds(Number(raw));
        setCountdownSeconds(clamped);
        setPlayfulCountdownSeconds(clamped);
    };

    return (
        <div
            className="flex flex-col gap-3"
            data-testid="settings-playful-block-tension"
        >
            <h3 className="m-0 text-base font-semibold">
                {t("settings.playful_cluster_tension", "Tension")}
            </h3>
            <SettingSwitchRow
                label={t("settings.playful_hearts", "Hearts (lives)")}
                hint={t(
                    "settings.playful_hearts_description",
                    "A wrong answer costs one heart. At zero the lesson run ends with a friendly retry offer - nothing you solved is lost. Off in exam and timed lessons.",
                )}
                checked={hearts}
                disabled={disabled}
                onChange={handleHeartsToggle}
                testid="settings-playful-hearts-toggle"
            />
            <SettingNumberRow
                label={t("settings.playful_hearts_count", "Hearts per lesson")}
                value={heartsCount}
                min={MIN_HEARTS_COUNT}
                max={MAX_HEARTS_COUNT}
                disabled={disabled || !hearts}
                onChange={handleHeartsCount}
                testid="settings-playful-hearts-count"
            />
            <SettingSwitchRow
                label={t("settings.playful_countdown", "Countdown ring")}
                hint={t(
                    "settings.playful_countdown_description",
                    "A small time ring per exercise. When it runs out, the streak breaks and a heart is lost - the exercise stays open, nothing is auto-submitted. Off in exam and timed lessons (the timed mode has its own timer).",
                )}
                checked={countdown}
                disabled={disabled}
                onChange={handleCountdownToggle}
                testid="settings-playful-countdown-toggle"
            />
            <SettingNumberRow
                label={t(
                    "settings.playful_countdown_seconds",
                    "Seconds per exercise",
                )}
                value={countdownSeconds}
                min={MIN_COUNTDOWN_SECONDS}
                max={MAX_COUNTDOWN_SECONDS}
                disabled={disabled || !countdown}
                onChange={handleCountdownSeconds}
                testid="settings-playful-countdown-seconds"
            />
        </div>
    );
}
