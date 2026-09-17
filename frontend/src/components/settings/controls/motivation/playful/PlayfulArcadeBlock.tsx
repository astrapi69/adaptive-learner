/**
 * PlayfulArcadeBlock (split out of PlayfulModeControl by #2959).
 *
 * The "Arcade and rewards" cluster of the game-mode details, all
 * DEFAULT ON: the arcade switch with its per-game numbers (snake round
 * length, memory pairs, simon target - #2887 / #2907), special rounds +
 * flash-round cards (#2888), game tickets + cap (#2889) and the bonus
 * lesson gate (#2890). Each number input is editable only while its own
 * switch is on; the whole block is disabled while the master game mode
 * switch is off (``disabled`` prop). Every write persists through the
 * matching pref module and dispatches its change event.
 */

import {useState} from "react";

import {useI18n} from "@/hooks/ui/useI18n";
import {
    MAX_MEMORY_PAIRS,
    MAX_SIMON_TARGET,
    MAX_SNAKE_SECONDS,
    MIN_MEMORY_PAIRS,
    MIN_SIMON_TARGET,
    MIN_SNAKE_SECONDS,
    clampMemoryPairs,
    clampSimonTarget,
    clampSnakeSeconds,
    readMemoryPairs,
    readPlayfulArcade,
    readSimonTarget,
    readSnakeSeconds,
    setMemoryPairs,
    setPlayfulArcade,
    setSimonTarget,
    setSnakeSeconds,
} from "@/lib/learning/playful/playfulArcadePref";
import {
    readPlayfulBonus,
    setPlayfulBonus,
} from "@/lib/learning/playful/playfulBonusPref";
import {
    MAX_FLASH_ROUND_CARDS,
    MIN_FLASH_ROUND_CARDS,
    clampFlashRoundCards,
    readFlashRoundCards,
    readPlayfulSpecialRounds,
    setFlashRoundCards,
    setPlayfulSpecialRounds,
} from "@/lib/learning/playful/playfulSpecialRoundsPref";
import {
    MAX_TICKET_CAP,
    MIN_TICKET_CAP,
    clampTicketCap,
    readPlayfulTickets,
    readTicketCap,
    setPlayfulTickets,
    setTicketCap,
} from "@/lib/learning/playful/playfulTicketsPref";
import {SettingNumberRow, SettingSwitchRow} from "./SettingRows";
import type {PlayfulBlockProps} from "./types";

export default function PlayfulArcadeBlock({disabled}: PlayfulBlockProps) {
    const {t} = useI18n();
    const [arcade, setArcade] = useState<boolean>(() => readPlayfulArcade());
    const [snakeSeconds, setSnakeSecondsState] = useState<number>(() =>
        readSnakeSeconds(),
    );
    const [memoryPairs, setMemoryPairsState] = useState<number>(() =>
        readMemoryPairs(),
    );
    const [simonTarget, setSimonTargetState] = useState<number>(() =>
        readSimonTarget(),
    );
    const [specialRounds, setSpecialRounds] = useState<boolean>(() =>
        readPlayfulSpecialRounds(),
    );
    const [flashCards, setFlashCards] = useState<number>(() =>
        readFlashRoundCards(),
    );
    const [ticketsOn, setTicketsOn] = useState<boolean>(() =>
        readPlayfulTickets(),
    );
    const [ticketCap, setTicketCapState] = useState<number>(() =>
        readTicketCap(),
    );
    const [bonusOn, setBonusOn] = useState<boolean>(() => readPlayfulBonus());

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
    const handleSimonTarget = (raw: string) => {
        const clamped = clampSimonTarget(Number(raw));
        setSimonTargetState(clamped);
        setSimonTarget(clamped);
    };
    const handleSpecialRoundsToggle = (next: boolean) => {
        setSpecialRounds(next);
        setPlayfulSpecialRounds(next);
    };
    const handleFlashCards = (raw: string) => {
        const clamped = clampFlashRoundCards(Number(raw));
        setFlashCards(clamped);
        setFlashRoundCards(clamped);
    };
    const handleTicketsToggle = (next: boolean) => {
        setTicketsOn(next);
        setPlayfulTickets(next);
    };
    const handleTicketCap = (raw: string) => {
        const clamped = clampTicketCap(Number(raw));
        setTicketCapState(clamped);
        setTicketCap(clamped);
    };
    const handleBonusToggle = (next: boolean) => {
        setBonusOn(next);
        setPlayfulBonus(next);
    };

    return (
        <div
            className="flex flex-col gap-3"
            data-testid="settings-playful-block-arcade"
        >
            <h3 className="m-0 text-base font-semibold">
                {t("settings.playful_cluster_arcade", "Arcade and rewards")}
            </h3>
            <SettingSwitchRow
                label={t("settings.playful_arcade", "Arcade")}
                hint={t(
                    "settings.playful_arcade_description",
                    "Short mini-games as a game-mode reward: Learn Memory with your lesson cards, plus the classic Snake as an XP unlock. Off hides the arcade card and games entirely.",
                )}
                checked={arcade}
                disabled={disabled}
                onChange={handleArcadeToggle}
                data-testid="settings-playful-arcade-toggle"
            />
            <SettingNumberRow
                label={t(
                    "settings.playful_arcade_snake_seconds",
                    "Snake round length (seconds)",
                )}
                value={snakeSeconds}
                min={MIN_SNAKE_SECONDS}
                max={MAX_SNAKE_SECONDS}
                disabled={disabled || !arcade}
                onChange={handleSnakeSeconds}
                data-testid="settings-playful-arcade-snake-seconds"
            />
            <SettingNumberRow
                label={t("settings.playful_arcade_memory_pairs", "Memory pairs")}
                value={memoryPairs}
                min={MIN_MEMORY_PAIRS}
                max={MAX_MEMORY_PAIRS}
                disabled={disabled || !arcade}
                onChange={handleMemoryPairs}
                data-testid="settings-playful-arcade-memory-pairs"
            />
            <SettingNumberRow
                label={t(
                    "settings.playful_arcade_simon_target",
                    "Simon target length",
                )}
                value={simonTarget}
                min={MIN_SIMON_TARGET}
                max={MAX_SIMON_TARGET}
                disabled={disabled || !arcade}
                onChange={handleSimonTarget}
                data-testid="settings-playful-arcade-simon-target"
            />
            <SettingSwitchRow
                label={t("settings.playful_special_rounds", "Special rounds")}
                hint={t(
                    "settings.playful_special_rounds_description",
                    "Finishing a set (every lesson with at least one star) unlocks a flash round built from its trickiest cards, played with the countdown ring. Off hides the flash-round card entirely.",
                )}
                checked={specialRounds}
                disabled={disabled}
                onChange={handleSpecialRoundsToggle}
                data-testid="settings-playful-special-rounds-toggle"
            />
            <SettingNumberRow
                label={t("settings.playful_flash_round_cards", "Flash-round cards")}
                value={flashCards}
                min={MIN_FLASH_ROUND_CARDS}
                max={MAX_FLASH_ROUND_CARDS}
                disabled={disabled || !specialRounds}
                onChange={handleFlashCards}
                data-testid="settings-playful-flash-round-cards"
            />
            <SettingSwitchRow
                label={t("settings.playful_tickets", "Game tickets")}
                hint={t(
                    "settings.playful_tickets_description",
                    "Earn arcade tickets through performance: a lesson with a perfect score, a run survived with all hearts, and streak milestones (3/7/14/30 days). One ticket plays one round of a locked arcade game. Off leaves the arcade to XP unlocks only.",
                )}
                checked={ticketsOn}
                disabled={disabled}
                onChange={handleTicketsToggle}
                data-testid="settings-playful-tickets-toggle"
            />
            <SettingNumberRow
                label={t("settings.playful_ticket_cap", "Maximum tickets")}
                value={ticketCap}
                min={MIN_TICKET_CAP}
                max={MAX_TICKET_CAP}
                disabled={disabled || !ticketsOn}
                onChange={handleTicketCap}
                data-testid="settings-playful-ticket-cap"
            />
            <SettingSwitchRow
                label={t("settings.playful_bonus_lessons", "Bonus lessons")}
                hint={t(
                    "settings.playful_bonus_lessons_description",
                    "Sets can carry bonus lessons (lesson files starting with \"bonus-\"). While the game mode is on they show as locked in the set's lesson list until every regular lesson has at least one star. Off (or game mode off) treats them like normal lessons.",
                )}
                checked={bonusOn}
                disabled={disabled}
                onChange={handleBonusToggle}
                data-testid="settings-playful-bonus-toggle"
            />
        </div>
    );
}
