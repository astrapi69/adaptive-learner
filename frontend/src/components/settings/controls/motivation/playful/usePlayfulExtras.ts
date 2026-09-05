/**
 * usePlayfulExtras (#2959).
 *
 * The status line of the Game Mode summary card: how many of the seven
 * game-mode detail switches (hearts, countdown, streak bonus XP, arcade,
 * special rounds, tickets, bonus lessons) are on. ``countPlayfulExtras``
 * is the pure read; the hook re-reads on every detail pref change event
 * (each pref module dispatches its own) and on the cross-tab ``storage``
 * event - same shape as ``hooks/settings/usePlayfulMode``, so the count
 * follows the switches inside the fold without a reload. Lives next to
 * the blocks it summarises (feature-local, one consumer), not in
 * ``hooks/settings`` (the #809 god-folder guard caps that folder).
 */

import {useEffect, useState} from "react";

import {
    PLAYFUL_ARCADE_CHANGE_EVENT,
    readPlayfulArcade,
} from "@/lib/learning/playful/playfulArcadePref";
import {
    PLAYFUL_BONUS_CHANGE_EVENT,
    readPlayfulBonus,
} from "@/lib/learning/playful/playfulBonusPref";
import {
    PLAYFUL_COMBO_XP_CHANGE_EVENT,
    readPlayfulComboXp,
} from "@/lib/learning/playful/playfulComboXpPref";
import {
    PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT,
    readPlayfulSpecialRounds,
} from "@/lib/learning/playful/playfulSpecialRoundsPref";
import {
    PLAYFUL_TENSION_CHANGE_EVENT,
    readPlayfulCountdown,
    readPlayfulHearts,
} from "@/lib/learning/playful/playfulTensionPref";
import {
    PLAYFUL_TICKETS_CHANGE_EVENT,
    readPlayfulTickets,
} from "@/lib/learning/playful/playfulTicketsPref";

export interface PlayfulExtras {
    /** Detail switches currently on. */
    on: number;
    /** Detail switches in total. */
    total: number;
}

const DETAIL_CHANGE_EVENTS = [
    PLAYFUL_TENSION_CHANGE_EVENT,
    PLAYFUL_COMBO_XP_CHANGE_EVENT,
    PLAYFUL_ARCADE_CHANGE_EVENT,
    PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT,
    PLAYFUL_TICKETS_CHANGE_EVENT,
    PLAYFUL_BONUS_CHANGE_EVENT,
    "storage",
] as const;

/** Count the enabled game-mode detail switches (pure read, no React). */
export function countPlayfulExtras(): PlayfulExtras {
    const flags = [
        readPlayfulHearts(),
        readPlayfulCountdown(),
        readPlayfulComboXp(),
        readPlayfulArcade(),
        readPlayfulSpecialRounds(),
        readPlayfulTickets(),
        readPlayfulBonus(),
    ];
    return {on: flags.filter(Boolean).length, total: flags.length};
}

/** Live ``{on, total}`` of the game-mode detail switches. */
export function usePlayfulExtras(): PlayfulExtras {
    const [extras, setExtras] = useState<PlayfulExtras>(() =>
        countPlayfulExtras(),
    );

    useEffect(() => {
        const refresh = () => setExtras(countPlayfulExtras());
        DETAIL_CHANGE_EVENTS.forEach((name) =>
            window.addEventListener(name, refresh),
        );
        refresh();
        return () => {
            DETAIL_CHANGE_EVENTS.forEach((name) =>
                window.removeEventListener(name, refresh),
            );
        };
    }, []);

    return extras;
}
