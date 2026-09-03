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
 *
 * Also hosts the game-mode sound switch + one-time offer (#2875), the
 * tension systems - hearts and the per-exercise countdown ring, both
 * default OFF with clamped number inputs (#2878) - and the mascot
 * variant picker (#2861).
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {SettingsSection} from "../../SettingsSection";
import MascotVariantControl from "./MascotVariantControl";
import {
    readPlayfulMode,
    setPlayfulMode,
} from "../../../../lib/learning/playful/playfulModePref";
import {
    markPlayfulSoundsPrompted,
    readPlayfulSounds,
    readPlayfulSoundsPrompted,
    setPlayfulSounds,
} from "../../../../lib/learning/playful/playfulSoundsPref";
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
} from "../../../../lib/learning/playful/playfulTensionPref";
import {
    MAX_COMBO_XP_CAP,
    MIN_COMBO_XP_CAP,
    clampComboXpCap,
    readComboXpCap,
    readPlayfulComboXp,
    setComboXpCap,
    setPlayfulComboXp,
} from "../../../../lib/learning/playful/playfulComboXpPref";
import {
    MAX_MEMORY_PAIRS,
    MAX_SNAKE_SECONDS,
    MIN_MEMORY_PAIRS,
    MIN_SNAKE_SECONDS,
    clampMemoryPairs,
    clampSnakeSeconds,
    readMemoryPairs,
    readPlayfulArcade,
    readSnakeSeconds,
    setMemoryPairs,
    setPlayfulArcade,
    setSnakeSeconds,
} from "../../../../lib/learning/playful/playfulArcadePref";
import {
    MAX_FLASH_ROUND_CARDS,
    MIN_FLASH_ROUND_CARDS,
    clampFlashRoundCards,
    readFlashRoundCards,
    readPlayfulSpecialRounds,
    setFlashRoundCards,
    setPlayfulSpecialRounds,
} from "../../../../lib/learning/playful/playfulSpecialRoundsPref";
import {
    MAX_TICKET_CAP,
    MIN_TICKET_CAP,
    clampTicketCap,
    readPlayfulTickets,
    readTicketCap,
    setPlayfulTickets,
    setTicketCap,
} from "../../../../lib/learning/playful/playfulTicketsPref";
import {
    readPlayfulBonus,
    setPlayfulBonus,
} from "../../../../lib/learning/playful/playfulBonusPref";

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

    // #2878 - the tension systems (hearts + countdown), both default OFF.
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

    // #2887 - the arcade (card + mini-games), DEFAULT ON.
    const [arcade, setArcade] = useState<boolean>(() => readPlayfulArcade());
    const [snakeSeconds, setSnakeSecondsState] = useState<number>(() =>
        readSnakeSeconds(),
    );
    const [memoryPairs, setMemoryPairsState] = useState<number>(() =>
        readMemoryPairs(),
    );

    const handleArcadeToggle = (next: boolean) => {
        setArcade(next);
        setPlayfulArcade(next);
    };
    const handleSnakeSeconds = (raw: string) => {
        const clamped = clampSnakeSeconds(Number(raw));
        setSnakeSecondsState(clamped);
        setSnakeSeconds(clamped);
    };
    const handleMemoryPairs = (raw: string) => {
        const clamped = clampMemoryPairs(Number(raw));
        setMemoryPairsState(clamped);
        setMemoryPairs(clamped);
    };

    // #2888 - special rounds (per-set flash rounds), DEFAULT ON.
    const [specialRounds, setSpecialRounds] = useState<boolean>(() =>
        readPlayfulSpecialRounds(),
    );
    const [flashCards, setFlashCards] = useState<number>(() =>
        readFlashRoundCards(),
    );

    const handleSpecialRoundsToggle = (next: boolean) => {
        setSpecialRounds(next);
        setPlayfulSpecialRounds(next);
    };
    const handleFlashCards = (raw: string) => {
        const clamped = clampFlashRoundCards(Number(raw));
        setFlashCards(clamped);
        setFlashRoundCards(clamped);
    };

    // #2889 - the ticket economy (arcade tickets by performance), DEFAULT ON.
    const [ticketsOn, setTicketsOn] = useState<boolean>(() =>
        readPlayfulTickets(),
    );
    const [ticketCap, setTicketCapState] = useState<number>(() =>
        readTicketCap(),
    );

    const handleTicketsToggle = (next: boolean) => {
        setTicketsOn(next);
        setPlayfulTickets(next);
    };
    const handleTicketCap = (raw: string) => {
        const clamped = clampTicketCap(Number(raw));
        setTicketCapState(clamped);
        setTicketCap(clamped);
    };

    // #2890 - bonus lessons (the bonus- filename convention), DEFAULT ON.
    const [bonusOn, setBonusOn] = useState<boolean>(() => readPlayfulBonus());
    const handleBonusToggle = (next: boolean) => {
        setBonusOn(next);
        setPlayfulBonus(next);
    };

    // #2893 - combo bonus XP (the one decided XP exception, DEFAULT ON).
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
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_hearts", "Hearts (lives)")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_hearts_description",
                            "A wrong answer costs one heart. At zero the lesson run ends with a friendly retry offer - nothing you solved is lost. Off in exam and timed lessons.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-hearts-toggle"
                    checked={hearts}
                    onChange={(e) => handleHeartsToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t("settings.playful_hearts_count", "Hearts per lesson")}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_HEARTS_COUNT}
                    max={MAX_HEARTS_COUNT}
                    value={heartsCount}
                    disabled={!hearts}
                    onChange={(e) => handleHeartsCount(e.target.value)}
                    data-testid="settings-playful-hearts-count"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_countdown", "Countdown ring")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_countdown_description",
                            "A small time ring per exercise. When it runs out, the streak breaks and a heart is lost - the exercise stays open, nothing is auto-submitted. Off in exam and timed lessons (the timed mode has its own timer).",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-countdown-toggle"
                    checked={countdown}
                    onChange={(e) => handleCountdownToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t(
                        "settings.playful_countdown_seconds",
                        "Seconds per exercise",
                    )}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_COUNTDOWN_SECONDS}
                    max={MAX_COUNTDOWN_SECONDS}
                    value={countdownSeconds}
                    disabled={!countdown}
                    onChange={(e) => handleCountdownSeconds(e.target.value)}
                    data-testid="settings-playful-countdown-seconds"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_combo_xp", "Streak bonus XP")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_combo_xp_description",
                            "From the third streak answer, every correct answer in a row earns +1 bonus XP, capped per lesson. Off keeps game-mode XP identical to normal mode.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-combo-xp-toggle"
                    checked={comboXp}
                    onChange={(e) => handleComboXpToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t(
                        "settings.playful_combo_xp_cap",
                        "Bonus XP cap per lesson",
                    )}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_COMBO_XP_CAP}
                    max={MAX_COMBO_XP_CAP}
                    value={comboCap}
                    disabled={!comboXp}
                    onChange={(e) => handleComboCap(e.target.value)}
                    data-testid="settings-playful-combo-xp-cap"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_arcade", "Arcade")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_arcade_description",
                            "Short mini-games as a game-mode reward: Learn Memory with your lesson cards, plus the classic Snake as an XP unlock. Off hides the arcade card and games entirely.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-arcade-toggle"
                    checked={arcade}
                    onChange={(e) => handleArcadeToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t(
                        "settings.playful_arcade_snake_seconds",
                        "Snake round length (seconds)",
                    )}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_SNAKE_SECONDS}
                    max={MAX_SNAKE_SECONDS}
                    value={snakeSeconds}
                    disabled={!arcade}
                    onChange={(e) => handleSnakeSeconds(e.target.value)}
                    data-testid="settings-playful-arcade-snake-seconds"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t(
                        "settings.playful_arcade_memory_pairs",
                        "Memory pairs",
                    )}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_MEMORY_PAIRS}
                    max={MAX_MEMORY_PAIRS}
                    value={memoryPairs}
                    disabled={!arcade}
                    onChange={(e) => handleMemoryPairs(e.target.value)}
                    data-testid="settings-playful-arcade-memory-pairs"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t(
                            "settings.playful_special_rounds",
                            "Special rounds",
                        )}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_special_rounds_description",
                            "Finishing a set (every lesson with at least one star) unlocks a flash round built from its trickiest cards, played with the countdown ring. Off hides the flash-round card entirely.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-special-rounds-toggle"
                    checked={specialRounds}
                    onChange={(e) =>
                        handleSpecialRoundsToggle(e.target.checked)
                    }
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t(
                        "settings.playful_flash_round_cards",
                        "Flash-round cards",
                    )}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_FLASH_ROUND_CARDS}
                    max={MAX_FLASH_ROUND_CARDS}
                    value={flashCards}
                    disabled={!specialRounds}
                    onChange={(e) => handleFlashCards(e.target.value)}
                    data-testid="settings-playful-flash-round-cards"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_tickets", "Game tickets")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_tickets_description",
                            "Earn arcade tickets through performance: a lesson with a perfect score, a run survived with all hearts, and streak milestones (3/7/14/30 days). One ticket plays one round of a locked arcade game. Off leaves the arcade to XP unlocks only.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-tickets-toggle"
                    checked={ticketsOn}
                    onChange={(e) => handleTicketsToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="text-sm">
                    {t("settings.playful_ticket_cap", "Maximum tickets")}
                </span>
                <input
                    type="number"
                    className="w-20"
                    min={MIN_TICKET_CAP}
                    max={MAX_TICKET_CAP}
                    value={ticketCap}
                    disabled={!ticketsOn}
                    onChange={(e) => handleTicketCap(e.target.value)}
                    data-testid="settings-playful-ticket-cap"
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.playful_bonus_lessons", "Bonus lessons")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.playful_bonus_lessons_description",
                            "Sets can carry bonus lessons (lesson files starting with \"bonus-\"). While the game mode is on they show as locked in the set's lesson list until every regular lesson has at least one star. Off (or game mode off) treats them like normal lessons.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-playful-bonus-toggle"
                    checked={bonusOn}
                    onChange={(e) => handleBonusToggle(e.target.checked)}
                />
            </label>
            <MascotVariantControl />
        </SettingsSection>
    );
}
