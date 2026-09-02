/**
 * usePlayfulMode (#2844).
 *
 * Returns whether playful mode (Spielmodus) is on, re-reading live
 * when the preference changes in this tab (via the
 * ``PLAYFUL_MODE_CHANGE_EVENT``) or in another tab (native
 * ``storage`` event) — same shape as ``useFeedbackIntensity`` so the
 * Settings toggle takes effect without a reload.
 */

import {useEffect, useState} from "react";

import {
    PLAYFUL_MODE_CHANGE_EVENT,
    readPlayfulMode,
} from "../../lib/learning/playful/playfulModePref";

export function usePlayfulMode(): boolean {
    const [playful, setPlayful] = useState<boolean>(() => readPlayfulMode());

    useEffect(() => {
        const refresh = () => setPlayful(readPlayfulMode());

        window.addEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);

        // Pick up any change that happened between the initial
        // useState and the effect mount.
        refresh();

        return () => {
            window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    return playful;
}
