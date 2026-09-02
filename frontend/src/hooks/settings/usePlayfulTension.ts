/**
 * usePlayfulTension (#2878).
 *
 * Returns the live game-mode tension preferences (hearts on/off +
 * count, countdown on/off + seconds), re-reading when they change in
 * this tab (``PLAYFUL_TENSION_CHANGE_EVENT``) or another tab
 * (``storage``) - same shape as {@link ./usePlayfulMode} so the
 * Settings switches take effect without a reload.
 */

import {useCallback, useEffect, useState} from "react";

import {
    PLAYFUL_TENSION_CHANGE_EVENT,
    readPlayfulCountdown,
    readPlayfulCountdownSeconds,
    readPlayfulHearts,
    readPlayfulHeartsCount,
} from "../../lib/learning/playfulTensionPref";

export interface PlayfulTension {
    heartsOn: boolean;
    heartsCount: number;
    countdownOn: boolean;
    countdownSeconds: number;
}

function readAll(): PlayfulTension {
    return {
        heartsOn: readPlayfulHearts(),
        heartsCount: readPlayfulHeartsCount(),
        countdownOn: readPlayfulCountdown(),
        countdownSeconds: readPlayfulCountdownSeconds(),
    };
}

export function usePlayfulTension(): PlayfulTension {
    const [tension, setTension] = useState<PlayfulTension>(() => readAll());

    const refresh = useCallback(() => setTension(readAll()), []);

    useEffect(() => {
        window.addEventListener(PLAYFUL_TENSION_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);
        refresh();
        return () => {
            window.removeEventListener(PLAYFUL_TENSION_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, [refresh]);

    return tension;
}
