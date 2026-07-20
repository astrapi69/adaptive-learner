/**
 * useErrorReplayScope (#1874).
 *
 * Live-reads whether "Fehler wiederholen" replays only the wrong elements
 * (default) or the whole failed exercises. Re-reads when the preference
 * changes in this tab (``ERROR_REPLAY_SCOPE_CHANGE_EVENT``) or in another
 * tab (native ``storage`` event), so the Settings toggle takes effect
 * without a reload. The lesson summary reads this when building the replay
 * payload.
 */

import {useEffect, useState} from "react";

import {
    ERROR_REPLAY_SCOPE_CHANGE_EVENT,
    readErrorReplayErrorsOnly,
} from "../../../lib/lesson/errorReplayScopePref";

/** Whether error-replay is scoped to only the wrong elements. */
export function useErrorReplayScope(): boolean {
    const [errorsOnly, setErrorsOnly] = useState<boolean>(() =>
        readErrorReplayErrorsOnly(),
    );

    useEffect(() => {
        const refresh = () => setErrorsOnly(readErrorReplayErrorsOnly());
        window.addEventListener(ERROR_REPLAY_SCOPE_CHANGE_EVENT, refresh);
        window.addEventListener("storage", refresh);
        // Pick up any change between the initial useState and mount.
        refresh();
        return () => {
            window.removeEventListener(ERROR_REPLAY_SCOPE_CHANGE_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    return errorsOnly;
}
