import {useI18n} from "../hooks/useI18n";
import {CYCLE_STEPS, cycleStepForIndex} from "../lib/constants";

interface CycleProgressProps {
    /**
     * 1-based current step (1..7). Out-of-range values are
     * clamped so a backend regression never crashes the UI.
     */
    currentStep: number;
}

/**
 * Renders the 7-step cycle as a horizontal indicator. The
 * current step is highlighted with the accent colour; earlier
 * steps are filled, later steps stay outlined.
 */
export default function CycleProgress({currentStep}: CycleProgressProps) {
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
    return (
        <div className="cycle-progress" data-testid="cycle-progress">
            <p className="cycle-caption" data-testid="cycle-caption">
                {caption} —{" "}
                <strong>{t(`cycle_steps.${currentKey}.label`, currentKey)}</strong>
            </p>
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
                    return (
                        <li
                            key={key}
                            data-testid={`cycle-step-${key}`}
                            data-state={state}
                            className={`cycle-step is-${state}`}
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
        </div>
    );
}
