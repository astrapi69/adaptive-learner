/**
 * useSessionMessaging (#1804 — extracted from Session.tsx).
 *
 * The SSE message exchange (v1.6.0 streaming): optimistic user
 * append + an empty assistant bubble that accumulates streamed
 * chunks, id reconciliation on ``onStart``/``onDone``, rollback on
 * failure, the v1.4.0 auto-loop cycle-transition card, the v0.5.0
 * step-evaluation toast, and the friendly ``ai_error`` mapping.
 *
 * ``messages``/``setMessages`` and ``session``/``setSession`` stay
 * owned by ``useSessionBootstrap`` and arrive by reference (the
 * ownership rule from the WordTiles/Cloze splits).
 */

import {useCallback, useState} from "react";
import type {Dispatch, SetStateAction} from "react";

import {ApiError} from "../../api/client";
import type {ChatMessage} from "../../components/session/SessionChat";
import {CYCLE_STEPS} from "../../lib/constants";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import type {
    LearningSession,
    SessionMessageExchangeResult,
    StepEvaluationVerdict,
} from "../../types";

/** i18n translate signature (key + optional fallback). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Own the in-flight-exchange state (``sendingMessage``,
 * ``stepEvaluation``) and the ``handleSend`` streaming handler.
 *
 * @example
 * const {sendingMessage, stepEvaluation, handleSend} =
 *     useSessionMessaging({session, setSession, messages, setMessages, t});
 * <SessionChat onSend={handleSend} disabled={sendingMessage} ... />
 */
export function useSessionMessaging({
    session,
    setSession,
    messages,
    setMessages,
    t,
}: {
    session: LearningSession | null;
    setSession: Dispatch<SetStateAction<LearningSession | null>>;
    messages: ChatMessage[];
    setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    t: Translate;
}) {
    const [sendingMessage, setSendingMessage] = useState(false);
    const [stepEvaluation, setStepEvaluation] =
        useState<StepEvaluationVerdict | null>(null);

    /**
     * Apply the domain (non-message-list) side of a completed exchange: advance
     * the cycle step, surface the step-evaluation verdict, and fire the
     * auto-loop / step-advance / ai_error toasts. Shared so the assistant-ui
     * thread (#1126 Phase 4a) drives the SAME learning mechanics as the legacy
     * SessionChat path — the assistant path has no ``messages`` array, so the
     * message-list parts (streaming reconcile + the cycle-transition card) stay
     * in ``handleSend``; everything else lives here.
     */
    const applyExchangeOutcome = useCallback(
        (result: SessionMessageExchangeResult) => {
            // v0.4.0: the backend bumps cycle_step on each successful
            // round-trip; keep local session state in sync so CycleProgress
            // reflects the new step.
            setSession(result.session);
            // v0.5.0: surface the step-evaluation verdict (null when the route
            // bypassed the evaluator — the tooltip just hides).
            setStepEvaluation(result.step_evaluation);

            const transition = result.topic_transition;
            if (transition && transition.looped) {
                notify.success(
                    t("session.cycle_advanced", "Cycle {n} started").replace(
                        "{n}",
                        String(transition.new_cycle_count),
                    ),
                );
            }
            if (
                result.step_evaluation &&
                result.step_evaluation.applied &&
                result.step_evaluation.from_step !== result.session.cycle_step
            ) {
                // The AI accepted advance + the step actually moved. Fire a
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
                    t("session.step_advance_toast", "Moving to: {step}").replace(
                        "{step}",
                        stepLabel,
                    ),
                );
            }
            if (result.ai_error) {
                // Map known classifications (no AI key / no provider) to a
                // friendly, localized message; others fall through to the raw
                // detail.
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
        },
        [setSession, t],
    );

    const handleSend = async (content: string) => {
        if (!session || sendingMessage) return;
        const optimisticUserId = `local-user-${messages.length + 1}`;
        const streamingId = `local-streaming-${messages.length + 2}`;
        // Optimistic append for the user message + an empty
        // assistant bubble that accumulates streamed chunks.
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
            // v1.4.0 — auto-loop. When the topic-transition evaluator
            // successfully looped the session into a new cycle, append a
            // transition card to the chat. This is message-list specific (the
            // assistant-ui thread has no ``messages`` array), so it stays here;
            // the cycle/step/toast handling is shared via applyExchangeOutcome.
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
            }
            applyExchangeOutcome(result);
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

    return {sendingMessage, stepEvaluation, handleSend, applyExchangeOutcome};
}
