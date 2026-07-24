import {lazy, Suspense} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";

// assistant-ui adoption (#1126): the session chat surface. Lazy so its
// ~47-package bundle is a separate chunk off the default route load.
const AssistantUiThread = lazy(
    () => import("../../components/session/assistant-ui/AssistantUiThread"),
);

import MethodSwitchBanner from "../../components/session/MethodSwitchBanner";
import SessionHeader from "../../components/session/SessionHeader";
import RatingDialog from "../../components/session/RatingDialog";
import ApiKeyRequiredNotice from "../../components/settings/ai/ApiKeyRequiredNotice";
import {Button} from "@/components/ui/button";
import {FEATURES} from "../../features/featureConfig";
import {useFeatureAvailable} from "../../features/useFeatureAvailable";
import {useI18n} from "../../hooks/ui/useI18n";
import {useOnlineStatus} from "../../hooks/system/useOnlineStatus";
import {
    useMethodSwitch,
    useSessionBootstrap,
    useSessionHeaderData,
    useSessionMessaging,
    useSessionRating,
} from "../../hooks/session";

/**
 * Session page (project-reference §8 row ``/session``).
 *
 * Flow:
 *
 *   1. Mount: read project_id from localStorage. Missing -> redirect
 *      to /onboarding.
 *   2. Bootstrap: start a new session (or resume ``?session=<id>``).
 *   3. Chat loop: the ``AssistantUiThread`` (assistant-ui, #1126) owns the
 *      conversation via an adapter over ``getStorage().session.*`` (both
 *      storage modes + the #1122 context rebuild); each completed turn calls
 *      ``applyExchangeOutcome`` so the shell advances the cycle step, surfaces
 *      the step-evaluation verdict, and fires the auto-loop / step toasts.
 *   4. End session: opens RatingDialog. Submit -> rate, then end. On success,
 *      navigate to /dashboard.
 *
 * Split (#1804): the page is the composition shell. Its state lives in hooks
 * under ``hooks/session/`` — ``useSessionBootstrap`` (start/resume + core
 * data), ``useSessionHeaderData`` (project topic / imported topic / model
 * info), ``useSessionMessaging`` (step-eval verdict + ``applyExchangeOutcome``),
 * ``useMethodSwitch`` (recommendation + accept/dismiss), and
 * ``useSessionRating`` (rate-then-end).
 */
export default function Session() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const online = useOnlineStatus();
    // #1158 — the tutor chat needs a usable AI key. When the session-start
    // feature is gated off (Dexie mode without a key), the page must not
    // create/resume a session that can only error-toast; it shows a clean
    // no-key empty state instead (second line of defense behind the disabled
    // entry buttons). API mode stays permissive — the key may be resolved
    // server-side — so this only fires in Dexie mode without a key.
    const sessionGate = useFeatureAvailable(FEATURES.SESSION_START);

    const {
        session,
        setSession,
        loading,
        startError,
        userSettings,
    } = useSessionBootstrap({
        gateAvailable: sessionGate.available,
        resumeId: searchParams.get("session"),
        methodParam: searchParams.get("method"),
        lang,
        online,
        navigate,
        t,
    });

    const {project, importedTopic, activeModelInfo} = useSessionHeaderData({
        session,
        userSettings,
    });

    const {stepEvaluation, applyExchangeOutcome} = useSessionMessaging({
        setSession,
        t,
    });

    const {
        switchRec,
        switchDismissed,
        handleAcceptSwitch,
        handleDismissSwitch,
    } = useMethodSwitch({session, setSession, t});

    const {showRating, setShowRating, submittingRating, handleRatingSubmit} =
        useSessionRating({session, navigate, t});

    // #1158 — no usable AI key: show a clean, actionable empty state with a
    // direct link to the AI settings tab instead of a dead chat that only
    // error-toasts. Reuses the shared ApiKeyRequiredNotice (link target
    // ``/settings?tab=ai``). Lessons + reviews stay usable without a key;
    // only the tutor-chat entry is gated. Fires only when the session
    // feature is disabled (Dexie mode without a key).
    if (!sessionGate.available) {
        return (
            <main id="main" data-testid="session-no-key" className="session-page">
                <p className="muted" role="status">
                    {t(
                        "session.no_api_key",
                        "No AI key set. Add a key for your AI provider in Settings to chat with the tutor. Lessons and reviews work without a key.",
                    )}
                </p>
                <ApiKeyRequiredNotice />
            </main>
        );
    }

    if (loading) {
        return (
            <main id="main" data-testid="session-loading" className="session-page">
                <p className="muted" role="status">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (startError) {
        return (
            <main id="main" data-testid="session-error" className="session-page">
                <p className="error-text" role="alert">{startError}</p>
            </main>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <main id="main" data-testid="session" className="session-page">
            <SessionHeader
                session={session}
                project={project}
                userSettings={userSettings}
                activeModelInfo={activeModelInfo}
                stepEvaluation={stepEvaluation}
                topicOverride={importedTopic}
                t={t}
            />

            {switchRec?.recommended &&
                switchRec.to_method &&
                switchRec.to_method !== switchDismissed && (
                    <MethodSwitchBanner
                        suggested={switchRec.to_method}
                        reason={switchRec.reason ?? undefined}
                        onAccept={handleAcceptSwitch}
                        onDismiss={handleDismissSwitch}
                    />
                )}

            {/* #1126 — the session chat surface is the assistant-ui thread
                (adapter over getStorage().session.*; both storage modes + the
                #1122 context rebuild). Lazy-loaded as its own chunk. */}
            <Suspense
                fallback={
                    <div
                        className="muted"
                        role="status"
                        data-testid="session-chat-loading"
                    >
                        {t("common.loading", "Loading…")}
                    </div>
                }
            >
                <AssistantUiThread
                    sessionId={session.id}
                    introTopic={importedTopic}
                    autoOpen={!!session.imported_conversation_id}
                    onExchange={applyExchangeOutcome}
                />
            </Suspense>

            <div className="form-actions">
                <Button
                    variant="destructive"
                    type="button"
                    data-testid="session-end"
                    onClick={() => setShowRating(true)}
                >
                    {t("session.end_session", "End session")}
                </Button>
            </div>

            <RatingDialog
                open={showRating}
                onCancel={() => setShowRating(false)}
                onSubmit={handleRatingSubmit}
                submitting={submittingRating}
                cycleCount={session?.cycle_count}
                cycleTopics={session?.cycle_topics}
            />
        </main>
    );
}
