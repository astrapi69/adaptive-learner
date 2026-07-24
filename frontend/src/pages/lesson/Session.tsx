import {lazy, Suspense} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";

// assistant-ui adoption Phase 0 (#1126): lazy so its ~47-package bundle only
// loads behind the opt-in ``?ui=assistant`` flag, never on the default path.
const AssistantUiThread = lazy(
    () => import("../../components/session/assistant-ui/AssistantUiThread"),
);

import MethodSwitchBanner from "../../components/session/MethodSwitchBanner";
import SessionHeader from "../../components/session/SessionHeader";
import RatingDialog from "../../components/session/RatingDialog";
import SessionChat from "../../components/session/SessionChat";
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
 * Flow (v0.2.0):
 *
 *   1. Mount: read project_id from localStorage. Missing -> redirect
 *      to /onboarding.
 *   2. POST /api/plugins/session/start with {project_id, lang}.
 *      Seed the chat with the returned ``system_prompt`` as the
 *      first "system" message so the user sees what method /
 *      step the AI was primed with.
 *   3. Chat loop: user types in SessionChat -> POST /message.
 *      The backend orchestrates AI server-side; the SSE channel
 *      feeds tokens into the assistant bubble as they arrive.
 *   4. End session: opens RatingDialog. Submit -> POST /rate,
 *      then POST /end. On success, navigate to /dashboard.
 *
 * Split (#1804): the page is the composition shell. Its former 15
 * state atoms live in five hooks under ``hooks/session/`` —
 * ``useSessionBootstrap`` (start/resume + core data),
 * ``useSessionHeaderData`` (project topic / imported topic / model
 * info), ``useSessionMessaging`` (the SSE exchange),
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
        messages,
        setMessages,
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

    const {sendingMessage, stepEvaluation, handleSend, applyExchangeOutcome} =
        useSessionMessaging({
        session,
        setSession,
        messages,
        setMessages,
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

            {searchParams.get("ui") === "assistant" && session?.id ? (
                // Phase 0 spike (#1126): opt-in assistant-ui thread for the
                // same session. Default path (no flag) renders the unchanged
                // SessionChat below, so production is untouched.
                <Suspense fallback={<div data-testid="aui-loading" />}>
                    <AssistantUiThread
                        sessionId={session.id}
                        introTopic={importedTopic}
                        autoOpen={!!session.imported_conversation_id}
                        onExchange={applyExchangeOutcome}
                    />
                </Suspense>
            ) : (
                <SessionChat
                    messages={messages}
                    onSend={handleSend}
                    disabled={sendingMessage}
                    introTopic={importedTopic}
                />
            )}

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
