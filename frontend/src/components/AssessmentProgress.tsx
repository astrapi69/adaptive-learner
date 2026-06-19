import {useI18n} from "../hooks/ui/useI18n";

interface AssessmentProgressProps {
    /** 1-based current question index. */
    current: number;
    /** Total question count. */
    total: number;
}

/**
 * Progress bar + caption for the Assessment page. The caption
 * pulls from the ``assessment.question_progress`` i18n key,
 * substituting ``{current}`` and ``{total}`` placeholders so the
 * single string handles every language's word order.
 */
export default function AssessmentProgress({current, total}: AssessmentProgressProps) {
    const {t} = useI18n();
    const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
    const template = t(
        "assessment.question_progress",
        "Question {current} of {total}",
    );
    const caption = template
        .replace("{current}", String(current))
        .replace("{total}", String(total));
    return (
        <div className="assessment-progress" data-testid="assessment-progress">
            <p className="assessment-progress-caption">{caption}</p>
            <div
                className="assessment-progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={current}
            >
                <div
                    className="assessment-progress-fill"
                    style={{width: `${pct}%`}}
                />
            </div>
        </div>
    );
}
