/**
 * useSessionMessaging (#1804; slimmed at the #1126 cutover).
 *
 * Owns the step-evaluation verdict and applies the domain outcome of a completed
 * turn: advance the cycle step, surface the step-evaluation verdict, and fire the
 * auto-loop / step-advance / ai_error toasts.
 *
 * Since the assistant-ui cutover (#1126) the chat surface owns its own message
 * list (via the assistant-ui runtime), so this hook no longer manages a
 * ``messages`` array or a streaming ``handleSend`` — the assistant-ui adapter
 * streams the reply and calls ``applyExchangeOutcome`` with the exchange result.
 * ``session``/``setSession`` stay owned by ``useSessionBootstrap`` and arrive by
 * reference.
 */

import {useCallback, useState} from "react";
import type {Dispatch, SetStateAction} from "react";

import {CYCLE_STEPS} from "../../lib/constants";
import {notify} from "../../utils/notify";
import type {
    LearningSession,
    SessionMessageExchangeResult,
    StepEvaluationVerdict,
} from "../../types";

/** i18n translate signature (key + optional fallback). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Own the ``stepEvaluation`` verdict and expose ``applyExchangeOutcome`` — the
 * domain handling the chat surface calls once per completed turn.
 *
 * @example
 * const {stepEvaluation, applyExchangeOutcome} =
 *     useSessionMessaging({setSession, t});
 * <AssistantUiThread onExchange={applyExchangeOutcome} ... />
 */
export function useSessionMessaging({
    setSession,
    t,
}: {
    setSession: Dispatch<SetStateAction<LearningSession | null>>;
    t: Translate;
}) {
    const [stepEvaluation, setStepEvaluation] =
        useState<StepEvaluationVerdict | null>(null);

    /**
     * Apply the domain side of a completed exchange: advance the cycle step,
     * surface the step-evaluation verdict, and fire the auto-loop /
     * step-advance / ai_error toasts.
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

    return {stepEvaluation, applyExchangeOutcome};
}
