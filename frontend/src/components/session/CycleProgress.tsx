import {useCallback, useEffect, useRef, useState} from "react";

import HelpLink from "../help/HelpLink";
import {useI18n} from "../../hooks/ui/useI18n";
import {useSwipe} from "../../hooks/ui/useSwipe";
import {CYCLE_STEPS, cycleStepForIndex} from "../../lib/constants";
import {readGesturePref} from "../../lib/settings/gesturePref";

interface CycleProgressProps {
    /**
     * 1-based current step (1..7). Out-of-range values are
     * clamped so a backend regression never crashes the UI.
     */
    currentStep: number;
    /**
     * v0.5.0 — the latest step-evaluation ``reason`` from the
     * Phase 8 dual-prompt. When non-null, surfaces under the
     * caption as a "Why this step?" tooltip / hint. ``null``
     * when evaluator wasn't reached (no API key, disabled, etc.)
     * OR when the route fell back to the deterministic +1
     * (fallback_used reasons are placeholders, not useful UI text).
     */
    evaluationReason?: string | null;
}

// How long the just-advanced pulse stays armed after a step
// transition. Must match the CSS @keyframes ``cycle-pulse`` total
// runtime; longer values just keep the class applied past the
// animation end (harmless, just no-op).
const TRANSITION_PULSE_MS = 900;

/**
 * Renders the 7-step cycle as a horizontal indicator. The
 * current step is highlighted with the accent colour; earlier
 * steps are filled, later steps stay outlined.
 *
 * v0.5.0: when ``currentStep`` changes (i.e. a Phase 8 transition
 * was applied), the new current step pulses briefly to draw the
 * eye to it. Backward transitions and skip-ahead transitions
 * BOTH animate — the eye-catch isn't about direction, it's about
 * "the cycle moved." Internal ref tracks the previous step value;
 * a one-shot setTimeout clears the pulse class.
 */
export default function CycleProgress({
    currentStep,
    evaluationReason = null,
}: CycleProgressProps) {
    const {t} = useI18n();
    const clamped = Math.min(CYCLE_STEPS.length, Math.max(1, currentStep));
    const currentKey = cycleStepForIndex(clamped);
    const template = t(
        "session.step_progress",
        "Step {current} of {total}",
    );
    const caption = template
        .replace("{current}", String(clamped))
        .replace("{total}", String(CYCLE_STEPS.length));

    // Track the previous step so we can flag the *new* current
    // step as just-advanced. The pulse fires once per transition
    // and self-clears via setTimeout.
    const prevStepRef = useRef<number>(clamped);
    const [justAdvanced, setJustAdvanced] = useState<boolean>(false);
    useEffect(() => {
        if (prevStepRef.current === clamped) return;
        prevStepRef.current = clamped;
        setJustAdvanced(true);
        const handle = window.setTimeout(
            () => setJustAdvanced(false),
            TRANSITION_PULSE_MS,
        );
        return () => window.clearTimeout(handle);
    }, [clamped]);

    // v1.10.0 / Phase 23C — swipe-to-peek at adjacent steps.
    // INFORMATIONAL only: the user cannot skip AI-driven steps,
    // so the swipe surfaces a brief overlay showing the
    // previous / next step description, then auto-dismisses.
    const [peekIndex, setPeekIndex] = useState<number | null>(null);
    const peekTimerRef = useRef<number | null>(null);

    const showPeek = useCallback(
        (target: number) => {
            if (target < 1 || target > CYCLE_STEPS.length) return;
            setPeekIndex(target);
            if (peekTimerRef.current !== null) {
                window.clearTimeout(peekTimerRef.current);
            }
            peekTimerRef.current = window.setTimeout(() => {
                setPeekIndex(null);
                peekTimerRef.current = null;
            }, 2000);
        },
        [],
    );

    const dismissPeek = useCallback(() => {
        if (peekTimerRef.current !== null) {
            window.clearTimeout(peekTimerRef.current);
            peekTimerRef.current = null;
        }
        setPeekIndex(null);
    }, []);

    useEffect(() => {
        return () => {
            if (peekTimerRef.current !== null) {
                window.clearTimeout(peekTimerRef.current);
            }
        };
    }, []);

    const {ref: swipeRef} = useSwipe<HTMLDivElement>({
        enabled: readGesturePref(),
        onSwipeLeft: () => showPeek(clamped + 1),
        onSwipeRight: () => showPeek(clamped - 1),
    });

    const peekKey =
        peekIndex !== null && peekIndex >= 1 && peekIndex <= CYCLE_STEPS.length
            ? cycleStepForIndex(peekIndex)
            : null;
    const peekLabel = peekKey ? t(`cycle_steps.${peekKey}.label`, peekKey) : "";
    const peekDescription = peekKey
        ? t(`cycle_steps.${peekKey}.description`, "")
        : "";

    return (
        <div
            ref={swipeRef}
            className="cycle-progress"
            data-testid="cycle-progress"
        >
            <p className="cycle-caption" data-testid="cycle-caption">
                {caption} -{" "}
                <strong>{t(`cycle_steps.${currentKey}.label`, currentKey)}</strong>
                <HelpLink glossaryKey={`step_${currentKey}`} />
            </p>
            {evaluationReason && (
                <p
                    className="cycle-evaluation-reason"
                    data-testid="cycle-evaluation-reason"
                    title={t(
                        "session.step_reason_tooltip",
                        "Why this step?",
                    )}
                >
                    <span aria-hidden="true">💡 </span>
                    {evaluationReason}
                </p>
            )}
            <ol
                className="cycle-steps"
                aria-label={t("session.step_progress").replace(
                    /\{current\} of \{total\}|\{current\} von \{total\}/,
                    "",
                )}
            >
                {CYCLE_STEPS.map((key, index) => {
                    const step = index + 1;
                    let state = "pending";
                    if (step < clamped) state = "complete";
                    else if (step === clamped) state = "current";
                    const isJustAdvanced =
                        justAdvanced && state === "current";
                    return (
                        <li
                            key={key}
                            data-testid={`cycle-step-${key}`}
                            data-state={state}
                            data-just-advanced={
                                isJustAdvanced ? "true" : undefined
                            }
                            className={`cycle-step is-${state}${
                                isJustAdvanced ? " is-just-advanced" : ""
                            }`}
                            aria-current={state === "current" ? "step" : undefined}
                        >
                            <span className="cycle-step-index">{step}</span>
                            <span className="cycle-step-label">
                                {t(`cycle_steps.${key}.label`, key)}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {peekIndex !== null && peekKey && (
                <button
                    type="button"
                    className="cycle-peek-overlay"
                    data-testid="cycle-peek-overlay"
                    data-peek-step={peekIndex}
                    aria-live="polite"
                    onClick={dismissPeek}
                >
                    <span className="cycle-peek-step">
                        {t("session.peek_step_prefix", "Step")} {peekIndex}:{" "}
                        <strong>{peekLabel}</strong>
                    </span>
                    {peekDescription && (
                        <span className="cycle-peek-description">
                            {peekDescription}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
