import {useCallback, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import CycleProgress from "../components/CycleProgress";
import MethodBadge from "../components/MethodBadge";
import MethodSwitchBanner from "../components/MethodSwitchBanner";
import RatingDialog, {type RatingValues} from "../components/RatingDialog";
import SessionChat, {type ChatMessage} from "../components/SessionChat";
import {api, ApiError} from "../api/client";
import {useI18n} from "../hooks/useI18n";
import {readLearnerState} from "../lib/learnerState";
import {notify} from "../utils/notify";
import type {LearningMethod} from "../lib/constants";
import type {
    LearningSession,
    SwitchRecommendation,
    UserSettings,
} from "../types";

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
 *      v0.2.0 backend orchestrates AI server-side: the route
 *      saves the user message, fires ai_complete against the
 *      active provider's API key + default model, persists the
 *      assistant reply, and returns a composite with both
 *      messages. The page renders a "thinking…" placeholder
 *      while the round-trip is in flight, then swaps it for the
 *      assistant reply (or surfaces ai_error via toast if AI
 *      couldn't reply).
 *   4. End session: opens RatingDialog. Submit -> POST /rate,
 *      then POST /end. On success, navigate to /dashboard.
 */
export default function Session() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();

    const [session, setSession] = useState<LearningSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [startError, setStartError] = useState<string | null>(null);
    const [showRating, setShowRating] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [submittingRating, setSubmittingRating] = useState(false);
    const [switchRec, setSwitchRec] = useState<SwitchRecommendation | null>(null);
    const [switchDismissed, setSwitchDismissed] = useState<LearningMethod | null>(null);
    const [accepting, setAccepting] = useState(false);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

    const fetchSwitchRecommendation = useCallback(async (sessionId: string) => {
        try {
            const rec = await api.session.switchRecommendation(sessionId);
            setSwitchRec(rec);
        } catch {
            // Recommendations are advisory; silently swallow the
            // error rather than blocking the session UI.
            setSwitchRec({recommended: false});
        }
    }, []);

    // Bootstrap: start a fresh session on mount. The v0.1.0
    // contract is "one /session visit == one new session"; we
    // don't try to resume across reloads because there's no
    // GET /messages endpoint to restore the chat history.
    useEffect(() => {
        const projectId = readLearnerState().projectId;
        if (!projectId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        setLoading(true);
        api.session
            .start({project_id: projectId, lang})
            .then((result) => {
                if (cancelled) return;
                setSession(result.session);
                setMessages([
                    {
                        id: "system-prompt",
                        role: "system",
                        content: result.system_prompt,
                    },
                ]);
                setLoading(false);
                // v0.2.0: fetch the method-switch recommendation
                // once the session id is known. The recommendation
                // is computed from prior cross-session ratings;
                // for a brand-new project the result will be
                // ``recommended:false`` and the banner stays
                // hidden.
                void fetchSwitchRecommendation(result.session.id);
                // Resolve the user's active provider so the
                // session header can surface it. Fire-and-forget;
                // a failure here is non-blocking — the header
                // just hides the provider chip.
                const userId = readLearnerState().userId;
                if (userId) {
                    api.settings
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
        // which would re-trigger this effect mid-flow. Recorded
        // as a lesson in CLAUDE.md ("React useEffect deps + i18n
        // test mocks: the t function isn't stable").
        // ``fetchSwitchRecommendation`` is a stable useCallback so
        // it's fine to omit it from deps too.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, navigate]);

    const handleSend = async (content: string) => {
        if (!session || sendingMessage) return;
        const optimisticUserId = `local-user-${messages.length + 1}`;
        const thinkingId = `local-thinking-${messages.length + 2}`;
        // Optimistic append for the user message + a "thinking…"
        // assistant placeholder so the chat surface stays
        // responsive while the AI round-trip is in flight.
        setMessages((prev) => [
            ...prev,
            {id: optimisticUserId, role: "user", content},
            {
                id: thinkingId,
                role: "assistant",
                content: t("session.ai_thinking", "Thinking…"),
            },
        ]);
        setSendingMessage(true);
        try {
            const result = await api.session.message(session.id, {
                role: "user",
                content,
            });
            // Replace the optimistic user message with the
            // backend-issued id; drop the thinking placeholder;
            // if AI replied, append the assistant message; if
            // not, surface ai_error via toast.
            setMessages((prev) => {
                const next = prev
                    .map((m) =>
                        m.id === optimisticUserId
                            ? {
                                  id: result.user_message.id,
                                  role: "user" as const,
                                  content: result.user_message.content,
                              }
                            : m,
                    )
                    .filter((m) => m.id !== thinkingId);
                if (result.assistant_message) {
                    next.push({
                        id: result.assistant_message.id,
                        role: "assistant",
                        content: result.assistant_message.content,
                    });
                }
                return next;
            });
            if (result.ai_error) {
                notify.error(result.ai_error);
            }
        } catch (err) {
            // Roll back both optimistic appends + surface the
            // detail so the user knows the message was not saved.
            setMessages((prev) =>
                prev.filter(
                    (m) => m.id !== optimisticUserId && m.id !== thinkingId,
                ),
            );
            const detail =
                err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSendingMessage(false);
        }
    };

    const handleAcceptSwitch = async () => {
        if (!session || !switchRec?.recommended || !switchRec.to_method || accepting) {
            return;
        }
        setAccepting(true);
        try {
            const updated = await api.session.acceptSwitch(session.id, {
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

    const handleRatingSubmit = async (rating: RatingValues) => {
        if (!session || submittingRating) return;
        setSubmittingRating(true);
        try {
            await api.session.rate(session.id, {
                understanding: rating.understanding,
                stress: rating.stress,
                method_fit: rating.method_fit,
                notes: rating.notes.length > 0 ? rating.notes : null,
            });
            await api.session.end(session.id);
            notify.success(t("toast.session_ended", "Session ended."));
            setShowRating(false);
            navigate("/dashboard");
        } catch (err) {
            const detail =
                err instanceof ApiError ? err.detail : t("common.error");
            notify.error(detail);
        } finally {
            setSubmittingRating(false);
        }
    };

    if (loading) {
        return (
            <main data-testid="session-loading" className="session-page">
                <p className="muted">{t("common.loading", "Loading…")}</p>
            </main>
        );
    }

    if (startError) {
        return (
            <main data-testid="session-error" className="session-page">
                <p className="error-text">{startError}</p>
            </main>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <main data-testid="session" className="session-page">
            <header className="session-header">
                <div className="session-header-row">
                    <h1>{t("session.title", "Learning session")}</h1>
                    <div className="session-header-chips">
                        <MethodBadge method={session.method} />
                        {userSettings && (
                            <span
                                className="provider-chip"
                                data-testid="session-active-provider"
                                title={t(
                                    `settings.provider_${userSettings.active_provider}`,
                                    userSettings.active_provider,
                                )}
                            >
                                {t(
                                    `settings.provider_${userSettings.active_provider}`,
                                    userSettings.active_provider,
                                )}
                            </span>
                        )}
                    </div>
                </div>
                <CycleProgress currentStep={session.cycle_step} />
            </header>

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

            <SessionChat
                messages={messages}
                onSend={handleSend}
                disabled={sendingMessage}
            />

            <div className="form-actions">
                <button
                    type="button"
                    className="btn btn-danger"
                    data-testid="session-end"
                    onClick={() => setShowRating(true)}
                >
                    {t("session.end_session", "End session")}
                </button>
            </div>

            <RatingDialog
                open={showRating}
                onCancel={() => setShowRating(false)}
                onSubmit={handleRatingSubmit}
                submitting={submittingRating}
            />
        </main>
    );
}
