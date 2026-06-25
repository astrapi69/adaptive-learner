import {lazy, Suspense, useCallback, useEffect, useState} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";

// assistant-ui adoption Phase 0 (#1126): lazy so its ~47-package bundle only
// loads behind the opt-in ``?ui=assistant`` flag, never on the default path.
const AssistantUiThread = lazy(
    () => import("../../components/session/assistant-ui/AssistantUiThread"),
);

import {LEARNING_METHODS} from "../../lib/constants";

import MethodSwitchBanner from "../../components/session/MethodSwitchBanner";
import SessionHeader from "../../components/session/SessionHeader";
import RatingDialog, {type RatingValues} from "../../components/session/RatingDialog";
import SessionChat, {type ChatMessage} from "../../components/session/SessionChat";
import {Button} from "@/components/ui/button";
import {ApiError} from "../../api/client";
import {useI18n} from "../../hooks/ui/useI18n";
import {useOnlineStatus} from "../../hooks/system/useOnlineStatus";
import {readLearnerState} from "../../lib/learning/learnerState";
import {getStorage} from "../../storage";
import {resolveModel} from "../../storage/ai/ai-providers";
import type {AvailableModel} from "../../storage/types";
import {notify} from "../../utils/notify";
import type {LearningMethod} from "../../lib/constants";
import type {
    LearningProject,
    LearningSession,
    SessionMessageExchangeResult,
    StepEvaluationVerdict,
    SwitchRecommendation,
    UserSettings,
} from "../../types";
import {CYCLE_STEPS} from "../../lib/constants";

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
    const [searchParams] = useSearchParams();
    const online = useOnlineStatus();

    const [session, setSession] = useState<LearningSession | null>(null);
    const [project, setProject] = useState<LearningProject | null>(null);
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
    // v1.11.0 / Phase 24E — resolved model + its human-readable
    // info (looked up from the discovery cache, if available).
    const [activeModelInfo, setActiveModelInfo] = useState<{
        id: string;
        name: string;
        contextWindow: number | null;
    } | null>(null);
    // v0.5.0 — most-recent step-evaluation verdict from /message.
    // Drives the "Why this step?" tooltip on CycleProgress and the
    // "Moving to: …" toast on an applied transition.
    const [stepEvaluation, setStepEvaluation] =
        useState<StepEvaluationVerdict | null>(null);
    // #1141 — for an imported-chat session the header topic line shows the
    // imported conversation's topic (e.g. "Reflexive Verben"), not the
    // generic project topic.
    const [importedTopic, setImportedTopic] = useState<string | null>(null);

    // Fetch the project once we know the session's project_id —
    // drives the topic line in the header (Phase 51 bugfix). The
    // header degrades gracefully if the fetch fails; the rest of
    // the page does not depend on this state.
    useEffect(() => {
        if (!session?.project_id) {
            setProject(null);
            return;
        }
        let cancelled = false;
        getStorage()
            .projects.get(session.project_id)
            .then((row) => {
                if (!cancelled) setProject(row);
            })
            .catch(() => {
                /* silent — header just omits the topic line. */
            });
        return () => {
            cancelled = true;
        };
    }, [session?.project_id]);

    // #1141 — resolve the imported conversation's topic for the header when the
    // session is linked to one. Prefers the analysis topic, falls back to the
    // conversation title. Cleared for non-imported sessions.
    useEffect(() => {
        const convId = session?.imported_conversation_id;
        if (!convId) {
            setImportedTopic(null);
            return;
        }
        let cancelled = false;
        getStorage()
            .imports.get(convId)
            .then((detail) => {
                if (cancelled) return;
                setImportedTopic(detail.analysis_result?.topic || detail.title || null);
            })
            .catch(() => {
                /* silent — header falls back to the project topic. */
            });
        return () => {
            cancelled = true;
        };
    }, [session?.imported_conversation_id]);

    // Resolve the active model whenever userSettings changes. The
    // model id always renders; the human name + context window come
    // from the available-models cache when one exists. This is
    // best-effort: no network roundtrip blocks the header on first
    // paint.
    useEffect(() => {
        if (!userSettings) {
            setActiveModelInfo(null);
            return;
        }
        const provider = userSettings.active_provider;
        const override = userSettings[
            `model_override_${provider}` as keyof UserSettings
        ] as string | null | undefined;
        const modelId = resolveModel(provider, override ?? null);
        const fallback = {
            id: modelId,
            name: modelId,
            contextWindow: null as number | null,
        };
        // hasApiKey gates the cache lookup — without a key the
        // backend / browser never fetched the list.
        const hasKey = userSettings[
            `has_${provider}_key` as keyof UserSettings
        ] as boolean;
        if (!hasKey) {
            setActiveModelInfo(fallback);
            return;
        }
        let cancelled = false;
        getStorage()
            .settings.getAvailableModels(userSettings.user_id, provider)
            .then((models: AvailableModel[]) => {
                if (cancelled) return;
                const match = models.find((m) => m.id === modelId);
                setActiveModelInfo(
                    match
                        ? {
                              id: match.id,
                              name: match.name,
                              contextWindow: match.context_window,
                          }
                        : fallback,
                );
            })
            .catch(() => {
                if (!cancelled) setActiveModelInfo(fallback);
            });
        return () => {
            cancelled = true;
        };
    }, [userSettings]);

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

    // Bootstrap: two modes.
    //
    // 1. **Resume mode** (Phase 38 Bug 7): when ``?session=<id>``
    //    is present in the URL, fetch the existing session +
    //    its message history. No new session is created. This
    //    is the path ImportDetail's "Continue session" button
    //    takes — clicking it must land the user back in their
    //    prior chat, not in a fresh setup.
    //
    // 2. **Start mode**: no ``?session=`` -> create a new
    //    session via ``start()``. The optional ``?method=<key>``
    //    param hints the method (used by Dashboard's
    //    Spaced-Repetition cards).
    useEffect(() => {
        const projectId = readLearnerState().projectId;
        const resumeId = searchParams.get("session");

        // Resume mode bypasses the projectId / online guards
        // (the session already exists; the chat just needs to
        // re-render. Sending the NEXT message requires
        // network, but loading the history doesn't).
        if (resumeId) {
            let cancelled = false;
            setLoading(true);
            Promise.all([
                getStorage().session.get(resumeId),
                getStorage().session.getMessages(resumeId),
            ])
                .then(([existingSession, history]) => {
                    if (cancelled) return;
                    setSession(existingSession);
                    setMessages(
                        history.map((row) => ({
                            id: row.id,
                            role: row.role,
                            content: row.content,
                        })),
                    );
                    setLoading(false);
                    void fetchSwitchRecommendation(existingSession.id);
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
        // network error. The user can return to /dashboard to
        // browse past work (cached read endpoints survive offline).
        if (!online) {
            setStartError(
                t(
                    "session.offline_start_blocked",
                    "You're offline. New sessions need a network connection — past sessions stay readable from the Dashboard.",
                ),
            );
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        // v0.4.0: SpacedRecommendations cards link here with
        // ``?method=<key>`` so the user can start a session in
        // the method the card suggests. Unknown / missing values
        // fall through to the profile-driven default.
        const rawMethod = searchParams.get("method");
        const hintedMethod = LEARNING_METHODS.find((m) => m === rawMethod);
        getStorage().session
            .start({
                project_id: projectId,
                lang,
                ...(hintedMethod ? {method: hintedMethod} : {}),
            })
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
        // which would re-trigger this effect mid-flow. Recorded
        // as a lesson in CLAUDE.md ("React useEffect deps + i18n
        // test mocks: the t function isn't stable").
        // ``fetchSwitchRecommendation`` is a stable useCallback so
        // it's fine to omit it from deps too.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, navigate, online]);

    const handleSend = async (content: string) => {
        if (!session || sendingMessage) return;
        const optimisticUserId = `local-user-${messages.length + 1}`;
        const streamingId = `local-streaming-${messages.length + 2}`;
        // Optimistic append for the user message + an empty
        // assistant bubble that accumulates streamed chunks.
        // Pre-v1.6.0 this was a "Thinking…" placeholder; the
        // SSE channel now feeds tokens directly into the bubble
        // as they arrive.
        setMessages((prev) => [
            ...prev,
            {id: optimisticUserId, role: "user", content},
            {
                id: streamingId,
                role: "assistant",
                content: "",
                streaming: true,
            },
        ]);
        setSendingMessage(true);
        try {
            let exchange: SessionMessageExchangeResult | null = null as
                | SessionMessageExchangeResult
                | null;
            await getStorage().session.streamMessage(
                session.id,
                {role: "user", content},
                {
                    onStart: (userMsg) => {
                        // Replace the optimistic user id with the
                        // backend-issued one as soon as the server
                        // confirms persistence.
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === optimisticUserId
                                    ? {
                                          id: userMsg.id,
                                          role: "user" as const,
                                          content: userMsg.content,
                                      }
                                    : m,
                            ),
                        );
                    },
                    onChunk: (delta) => {
                        // Append the delta to the streaming bubble.
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === streamingId
                                    ? {
                                          ...m,
                                          content: m.content + delta,
                                      }
                                    : m,
                            ),
                        );
                    },
                    onDone: (final) => {
                        exchange = final;
                    },
                },
            );
            const result = exchange;
            if (!result) {
                throw new Error("Stream ended without a done event.");
            }
            // Replace the streaming bubble's local id with the
            // backend-issued assistant message id + clear the
            // streaming flag. When ai_error fired and no message
            // was persisted, drop the bubble entirely so the user
            // doesn't see an empty assistant turn.
            setMessages((prev) => {
                const next = prev.filter((m) => m.id !== streamingId);
                if (result.assistant_message) {
                    next.push({
                        id: result.assistant_message.id,
                        role: "assistant" as const,
                        content: result.assistant_message.content,
                    });
                }
                return next;
            });
            // v0.4.0: the backend bumps cycle_step on each
            // successful round-trip. Update local session state
            // so CycleProgress reflects the new step + the
            // 42-cell prompt matrix in 6A picks up the right
            // (method, step) cell on the next turn.
            setSession(result.session);
            // v0.5.0: surface the step-evaluation verdict.
            // ``step_evaluation`` is null when the route bypassed
            // the evaluator (no API key / no provider / config
            // disabled) — in those cases the tooltip just hides
            // and no toast fires.
            setStepEvaluation(result.step_evaluation);

            // v1.4.0 — auto-loop. When the topic-transition
            // evaluator successfully looped the session into a
            // new cycle, append a transition card to the chat.
            const transition = result.topic_transition;
            if (transition && transition.looped) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `cycle-transition-${transition.new_cycle_count}`,
                        role: "assistant" as const,
                        kind: "cycle_transition" as const,
                        cycleNumber: transition.new_cycle_count,
                        content: transition.summary,
                        nextTopic: transition.next_topic ?? "",
                    },
                ]);
                notify.success(
                    t(
                        "session.cycle_advanced",
                        "Cycle {n} started",
                    ).replace("{n}", String(transition.new_cycle_count)),
                );
            }
            if (
                result.step_evaluation &&
                result.step_evaluation.applied &&
                result.step_evaluation.from_step !==
                    result.session.cycle_step
            ) {
                // The AI accepted advance + the step actually
                // moved (rules out same-step "applied" where the
                // evaluator suggested the current step). Fire a
                // brief toast naming the new step.
                const newStepKey =
                    CYCLE_STEPS[
                        Math.min(
                            CYCLE_STEPS.length,
                            Math.max(1, result.session.cycle_step),
                        ) - 1
                    ];
                const stepLabel = t(
                    `cycle_steps.${newStepKey}.label`,
                    newStepKey,
                );
                notify.info(
                    t(
                        "session.step_advance_toast",
                        "Moving to: {step}",
                    ).replace("{step}", stepLabel),
                );
            }
            if (result.ai_error) {
                // Map known classifications (no AI key / no provider
                // configured) to a friendly, localized message that
                // tells the user how to fix it and that the lessons
                // still work without a key. Unclassified / provider
                // errors fall through to the raw detail.
                const code = result.ai_error_code;
                if (code === "no_api_key" || code === "no_provider") {
                    notify.error(
                        t(
                            "session.no_api_key",
                            "No AI key set. Add a key for your AI provider in Settings to chat with the tutor. Lessons and reviews work without a key.",
                        ),
                    );
                } else {
                    notify.error(result.ai_error);
                }
            }
        } catch (err) {
            // Roll back both optimistic appends + surface the
            // detail so the user knows the message was not saved.
            setMessages((prev) =>
                prev.filter(
                    (m) => m.id !== optimisticUserId && m.id !== streamingId,
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

    const handleRatingSubmit = async (rating: RatingValues) => {
        if (!session || submittingRating) return;
        setSubmittingRating(true);
        try {
            await getStorage().session.rate(session.id, {
                understanding: rating.understanding,
                stress: rating.stress,
                method_fit: rating.method_fit,
                notes: rating.notes.length > 0 ? rating.notes : null,
            });
            await getStorage().session.end(session.id);
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
                    <AssistantUiThread sessionId={session.id} />
                </Suspense>
            ) : (
                <SessionChat
                    messages={messages}
                    onSend={handleSend}
                    disabled={sendingMessage}
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
