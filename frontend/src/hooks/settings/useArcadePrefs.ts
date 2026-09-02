/**
 * useArcadePrefs (#2887).
 *
 * Live view of the game-mode arcade settings: the combined gate
 * (game mode on AND arcade switch not disabled), the snake round
 * length and the memory pair count - re-read when the preference
 * changes in this tab (``PLAYFUL_ARCADE_CHANGE_EVENT`` /
 * ``PLAYFUL_MODE_CHANGE_EVENT``) or in another tab (native
 * ``storage`` event), same shape as ``usePlayfulMode``.
 */

import {useEffect, useState} from "react";

import {
    PLAYFUL_ARCADE_CHANGE_EVENT,
    playfulArcadeActive,
    readMemoryPairs,
    readSnakeSeconds,
} from "../../lib/learning/playful/playfulArcadePref";
import {PLAYFUL_MODE_CHANGE_EVENT} from "../../lib/learning/playful/playfulModePref";

export interface ArcadePrefs {
    /** Game mode on AND arcade switch not disabled. */
    active: boolean;
    snakeSeconds: number;
    memoryPairs: number;
}

function readPrefs(): ArcadePrefs {
    return {
        active: playfulArcadeActive(),
        snakeSeconds: readSnakeSeconds(),
        memoryPairs: readMemoryPairs(),
    };
}

export function useArcadePrefs(): ArcadePrefs {
    const [prefs, setPrefs] = useState<ArcadePrefs>(() => readPrefs());

    useEffect(() => {
        const refresh = () => setPrefs(readPrefs());

        window.addEventListener(PLAYFUL_ARCADE_CHANGE_EVENT, refresh);
        window.addEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);
        refresh();

        return () => {
            window.removeEventListener(PLAYFUL_ARCADE_CHANGE_EVENT, refresh);
            window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    return prefs;
}
