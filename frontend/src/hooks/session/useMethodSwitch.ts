/**
 * useMethodSwitch (#1804 — extracted from Session.tsx).
 *
 * The v0.2.0 method-switch recommendation flow: fetch the advisory
 * recommendation once the session id is known, accept it (persists
 * the switch + updates the session), or dismiss it (remembered per
 * target method so the banner doesn't reappear this session).
 */

import {useCallback, useEffect, useState} from "react";
import type {Dispatch, SetStateAction} from "react";

import {ApiError} from "../../api/client";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import type {LearningMethod} from "../../lib/constants";
import type {LearningSession, SwitchRecommendation} from "../../types";

/** i18n translate signature (key + optional fallback). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Own the switch-recommendation state + accept/dismiss handlers.
 * Fetches the recommendation as soon as ``session.id`` resolves
 * (once per session — accepting a switch keeps the same id).
 *
 * @example
 * const {switchRec, switchDismissed, handleAcceptSwitch,
 *     handleDismissSwitch} = useMethodSwitch({session, setSession, t});
 */
export function useMethodSwitch({
    session,
    setSession,
    t,
}: {
    session: LearningSession | null;
    setSession: Dispatch<SetStateAction<LearningSession | null>>;
    t: Translate;
}) {
    const [switchRec, setSwitchRec] = useState<SwitchRecommendation | null>(null);
    const [switchDismissed, setSwitchDismissed] = useState<LearningMethod | null>(null);
    const [accepting, setAccepting] = useState(false);

    const fetchSwitchRecommendation = useCallback(async (sessionId: string) => {
        try {
            const rec = await getStorage().session.switchRecommendation(sessionId);
            setSwitchRec(rec);
        } catch {
            // Recommendations are advisory; silently swallow the
            // error rather than blocking the session UI.
            setSwitchRec({recommended: false});
        }
    }, []);

    // Fetch once the session id is known (start or resume resolved).
    // The recommendation is computed from prior cross-session
    // ratings; for a brand-new project the result is
    // ``recommended:false`` and the banner stays hidden.
    const sessionId = session?.id ?? null;
    useEffect(() => {
        if (!sessionId) return;
        void fetchSwitchRecommendation(sessionId);
    }, [sessionId, fetchSwitchRecommendation]);

    const handleAcceptSwitch = async () => {
        if (!session || !switchRec?.recommended || !switchRec.to_method || accepting) {
            return;
        }
        setAccepting(true);
        try {
            const updated = await getStorage().session.acceptSwitch(session.id, {
                to_method: switchRec.to_method,
                reason: switchRec.reason ?? "User accepted method-switch suggestion.",
            });
            setSession(updated);
            setSwitchRec({recommended: false});
            notify.success(t("toast.method_switched", "Method switched."));
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setAccepting(false);
        }
    };

    const handleDismissSwitch = () => {
        // Remember which suggestion was dismissed so the banner
        // doesn't reappear during this session for the same target
        // method. The next session (or a different to_method)
        // surfaces a fresh banner.
        if (switchRec?.recommended && switchRec.to_method) {
            setSwitchDismissed(switchRec.to_method);
        }
        setSwitchRec({recommended: false});
    };

    return {
        switchRec,
        switchDismissed,
        accepting,
        handleAcceptSwitch,
        handleDismissSwitch,
    };
}
