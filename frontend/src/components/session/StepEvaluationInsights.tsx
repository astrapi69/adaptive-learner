import {useI18n} from "../../hooks/ui/useI18n";
import {CYCLE_STEPS} from "../../lib/constants";
import type {StepEvaluationSummary} from "../../types";

interface Props {
    summary: StepEvaluationSummary | null;
}

/**
 * v0.5.0 / 8D — surfaces the step-evaluation aggregates produced
 * by the tracking plugin's ``aggregate_step_evaluations``:
 *
 * - Average confidence: how certain the AI has been on average.
 * - Stay-on-step count: how many times the AI said "not ready yet".
 * - Time-per-step: which step the learner spent the longest on
 *   (the "where do I get stuck?" signal).
 *
 * Empty state (zero evaluations) hides the card body and renders
 * a one-liner so first-visit users aren't confronted with a wall
 * of zeros. The Phase 8E spec calls these "insights" rather than
 * raw metrics — the component reads small + actionable.
 */
export default function StepEvaluationInsights({summary}: Props) {
    const {t} = useI18n();

    if (!summary || summary.total_evaluations === 0) {
        return (
            <div className="tile" data-testid="step-eval-insights-empty">
                <p className="muted">
                    {t(
                        "progress.step_eval_empty",
                        "No AI step-evaluation data yet — start a session to see insights here.",
                    )}
                </p>
            </div>
        );
    }

    // Step with the most aggregate time-on-step is the "stickiest"
    // — the place where this learner spends the most messages.
    // The wire-format dict has STRING keys (JSON behaviour);
    // convert to a sorted (step, seconds) list.
    const timeEntries = Object.entries(summary.time_seconds_per_step)
        .map(([k, v]) => ({step: Number(k), seconds: v}))
        .filter((e) => Number.isFinite(e.step) && e.step >= 1 && e.step <= 7)
        .sort((a, b) => b.seconds - a.seconds);
    const stickiest = timeEntries[0];

    const confidencePct = Math.round(summary.average_confidence * 100);

    return (
        <div className="step-eval-insights" data-testid="step-eval-insights">
            <div className="step-eval-metrics">
                <div className="step-eval-metric" data-testid="step-eval-confidence">
                    <span className="step-eval-metric-value">
                        {confidencePct}%
                    </span>
                    <span className="step-eval-metric-label">
                        {t(
                            "progress.step_eval_avg_confidence",
                            "Avg AI confidence",
                        )}
                    </span>
                </div>
                <div className="step-eval-metric" data-testid="step-eval-repeats">
                    <span className="step-eval-metric-value">
                        {summary.repeat_count}
                    </span>
                    <span className="step-eval-metric-label">
                        {t(
                            "progress.step_eval_repeats",
                            "Times AI said 'not ready yet'",
                        )}
                    </span>
                </div>
                <div className="step-eval-metric" data-testid="step-eval-advances">
                    <span className="step-eval-metric-value">
                        {summary.advance_count}
                    </span>
                    <span className="step-eval-metric-label">
                        {t("progress.step_eval_advances", "Step advances")}
                    </span>
                </div>
                {summary.backward_count > 0 && (
                    <div
                        className="step-eval-metric"
                        data-testid="step-eval-backward"
                    >
                        <span className="step-eval-metric-value">
                            {summary.backward_count}
                        </span>
                        <span className="step-eval-metric-label">
                            {t(
                                "progress.step_eval_backward",
                                "Backward transitions",
                            )}
                        </span>
                    </div>
                )}
            </div>

            {stickiest && stickiest.seconds > 0 && (
                <p
                    className="step-eval-stickiest"
                    data-testid="step-eval-stickiest"
                >
                    {t("progress.step_eval_stickiest_label", "Most time on:")}{" "}
                    <strong>
                        {t(
                            `cycle_steps.${CYCLE_STEPS[stickiest.step - 1]}.label`,
                            CYCLE_STEPS[stickiest.step - 1],
                        )}
                    </strong>{" "}
                    <span className="muted">
                        ({formatSeconds(stickiest.seconds)})
                    </span>
                </p>
            )}
        </div>
    );
}

function formatSeconds(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}
