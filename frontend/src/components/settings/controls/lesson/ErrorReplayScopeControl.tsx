/**
 * ErrorReplayScopeControl (#1874).
 *
 * Settings > Learning control for what "Fehler wiederholen" (Retry Errors)
 * replays:
 *   - errors_only (default) → only the elements the learner got wrong. For
 *     matching exercises this trims the pairs to the wrong ones (with a
 *     small distractor fill so the puzzle stays playable).
 *   - whole_set → the whole failed exercises again, for learners who want
 *     to consolidate the full context.
 *
 * localStorage-backed so the lesson summary (``useErrorReplayScope``) reads
 * the same flag live, in both storage modes.
 */

import {useEffect, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {
    ERROR_REPLAY_SCOPE_CHANGE_EVENT,
    readErrorReplayErrorsOnly,
    setErrorReplayErrorsOnly,
} from "../../../../lib/lesson/errorReplayScopePref";

const ERRORS_ONLY = "errors_only";
const WHOLE_SET = "whole_set";

export default function ErrorReplayScopeControl() {
    const {t} = useI18n();
    const [errorsOnly, setErrorsOnly] = useState<boolean>(() =>
        readErrorReplayErrorsOnly(),
    );

    useEffect(() => {
        const refresh = () => setErrorsOnly(readErrorReplayErrorsOnly());
        window.addEventListener("storage", refresh);
        window.addEventListener(ERROR_REPLAY_SCOPE_CHANGE_EVENT, refresh);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener(ERROR_REPLAY_SCOPE_CHANGE_EVENT, refresh);
        };
    }, []);

    const onChange = (value: string) => {
        const next = value === ERRORS_ONLY;
        setErrorsOnly(next);
        setErrorReplayErrorsOnly(next);
    };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-error-replay-scope"
        >
            <h2 className="settings-section-title">
                {t("settings.error_replay_scope.title", "Retry errors")}
            </h2>
            <FormHint>
                {t(
                    "settings.error_replay_scope.hint",
                    'When you retry errors after a lesson, replay only the parts you got wrong, or the whole exercises again. For matching exercises, "only errors" shows just the wrong pairs (plus a few correct ones so there is something to match).',
                )}
            </FormHint>
            <label className="form-row">
                <span className="form-label">
                    {t("settings.error_replay_scope.label", "Retry scope")}
                </span>
                <select
                    data-testid="settings-error-replay-scope"
                    value={errorsOnly ? ERRORS_ONLY : WHOLE_SET}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value={ERRORS_ONLY}>
                        {t(
                            "settings.error_replay_scope.errors_only",
                            "Only show errors (default)",
                        )}
                    </option>
                    <option value={WHOLE_SET}>
                        {t(
                            "settings.error_replay_scope.whole_set",
                            "Replay the whole set",
                        )}
                    </option>
                </select>
            </label>
        </section>
    );
}
