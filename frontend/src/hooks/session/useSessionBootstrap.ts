/**
 * useSessionBootstrap (#1804 — extracted from Session.tsx).
 *
 * Owns the session's core data state and the two bootstrap modes:
 *
 * 1. **Resume mode** (Phase 38 Bug 7): when ``?session=<id>`` is
 *    present, fetch the existing session + its message history. No
 *    new session is created. This is the path ImportDetail's
 *    "Continue session" button takes.
 * 2. **Start mode**: no ``?session=`` -> create a new session via
 *    ``start()``. The optional ``?method=<key>`` param hints the
 *    method (used by Dashboard's Spaced-Repetition cards).
 *
 * The #1158 key gate short-circuits both modes (Dexie mode without a
 * key renders the no-key empty state instead), and the v0.6.0 offline
 * guard blocks start mode with an inline message.
 */

import {useState} from "react";
import {useEffect} from "react";
import type {NavigateFunction} from "react-router";

import {ApiError} from "../../api/client";
import {LEARNING_METHODS} from "../../lib/constants";
import {readLearnerState} from "../../lib/learning/learnerState";
import {getStorage} from "../../storage";
import type {LearningSession, UserSettings} from "../../types";

/** i18n translate signature (key + optional fallback). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Own the session / loading / error / user-settings state and run the
 * start-or-resume bootstrap effect. The chat surface (assistant-ui thread) owns
 * its own message list and hydrates prior turns itself (#1126), so this hook no
 * longer loads or returns a ``messages`` array.
 *
 * @example
 * const {session, setSession, loading, startError, userSettings} =
 *     useSessionBootstrap({gateAvailable: sessionGate.available, resumeId,
 *     methodParam, lang, online, navigate, t});
 */
export function useSessionBootstrap({
    gateAvailable,
    resumeId,
    methodParam,
    lang,
    online,
    navigate,
    t,
}: {
    gateAvailable: boolean;
    resumeId: string | null;
    methodParam: string | null;
    lang: string;
    online: boolean;
    navigate: NavigateFunction;
    t: Translate;
}) {
    const [session, setSession] = useState<LearningSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [startError, setStartError] = useState<string | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

    useEffect(() => {
        // #1158 — second line of defense. Without a usable AI key the tutor
        // chat can't run (every turn calls the provider), so skip the
        // create/resume round-trip entirely and let the render-level no-key
        // guard show the empty state. Fires only in Dexie mode without a
        // key; API mode resolves to ``available`` (the key may be
        // server-side) and proceeds as before.
        if (!gateAvailable) {
            setLoading(false);
            return;
        }

        const projectId = readLearnerState().projectId;

        // Resume mode bypasses the projectId / online guards
        // (the session already exists; the chat just needs to
        // re-render. Sending the NEXT message requires
        // network, but loading the history doesn't).
        if (resumeId) {
            let cancelled = false;
            setLoading(true);
            // The assistant-ui thread hydrates prior turns itself (#1126), so
            // resume only needs the session record here. Imported sessions open
            // clean; regular ones get their history seeded by the thread.
            getStorage()
                .session.get(resumeId)
                .then((existingSession) => {
                    if (cancelled) return;
                    setSession(existingSession);
                    setLoading(false);
                    const userId = readLearnerState().userId;
                    if (userId) {
                        getStorage().settings
                            .get(userId)
                            .then((s) => {
                                if (!cancelled) setUserSettings(s);
                            })
                            .catch(() => {
                                /* non-blocking */
                            });
                    }
                })
                .catch((err) => {
                    if (cancelled) return;
                    const detail =
                        err instanceof ApiError
                            ? err.detail
                            : t("common.error");
                    setStartError(detail);
                    setLoading(false);
                });
            return () => {
                cancelled = true;
            };
        }

        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        // v0.6.0 / 9D — offline guard. A new session needs the AI
        // provider, which needs network. Surface a clear inline
        // message instead of firing the POST and getting a generic
        // network error.
        if (!online) {
            setStartError(
                t(
                    "session.offline_start_blocked",
                    "You're offline. New sessions need a network connection - past sessions stay readable from the Dashboard.",
                ),
            );
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        // v0.4.0: SpacedRecommendations cards link here with
        // ``?method=<key>``. Unknown / missing values fall through to
        // the profile-driven default.
        const hintedMethod = LEARNING_METHODS.find((m) => m === methodParam);
        getStorage().session
            .start({
                project_id: projectId,
                lang,
                ...(hintedMethod ? {method: hintedMethod} : {}),
            })
            .then((result) => {
                if (cancelled) return;
                setSession(result.session);
                setLoading(false);
                // Resolve the user's active provider so the
                // session header can surface it. Fire-and-forget;
                // a failure here is non-blocking — the header
                // just hides the provider chip.
                const userId = readLearnerState().userId;
                if (userId) {
                    getStorage().settings
                        .get(userId)
                        .then((s) => {
                            if (!cancelled) setUserSettings(s);
                        })
                        .catch(() => {
                            /* non-blocking */
                        });
                }
            })
            .catch((err) => {
                if (cancelled) return;
                const detail =
                    err instanceof ApiError ? err.detail : t("common.error");
                setStartError(detail);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // ``t`` is intentionally omitted: useI18n's t reference
        // changes whenever the i18n provider's strings update,
        // which would re-trigger this effect mid-flow (lessons-learned:
        // "React useEffect deps + i18n test mocks"). ``resumeId`` /
        // ``methodParam`` mirror the original searchParams.get reads,
        // which were likewise not deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, navigate, online, gateAvailable]);

    return {
        session,
        setSession,
        loading,
        startError,
        userSettings,
    };
}
