/**
 * Assessment wizard footer (extracted from Assessment for the
 * complexity burn-down #400): the leading Continue-later / Previous
 * button and the trailing Next / Evaluate button. Pure presentation;
 * the resumable-exit + navigation handlers come via props.
 */

import {Button} from "@/components/ui/button";

type Translate = (key: string, fallback?: string) => string;

interface AssessmentNavProps {
    /** First question — show "Continue later" (a resumable exit)
     *  instead of "Previous". */
    isFirst: boolean;
    /** Last question — the trailing button submits instead of advancing. */
    isLast: boolean;
    /** The current question has at least one answer (gates "Next"). */
    currentAnswered: boolean;
    /** Every question is answered (gates "Evaluate"). */
    allAnswered: boolean;
    submitting: boolean;
    onExit: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSubmit: () => void;
    t: Translate;
}

/** The two-button assessment navigation footer. */
export default function AssessmentNav({
    isFirst,
    isLast,
    currentAnswered,
    allAnswered,
    submitting,
    onExit,
    onPrev,
    onNext,
    onSubmit,
    t,
}: AssessmentNavProps) {
    return (
        <div className="form-actions">
            {isFirst ? (
                // First question: no previous step to go back to. Offer a
                // non-dead-end exit instead of a disabled button — the
                // assessment is resumable, so leaving keeps the saved
                // progress (#171).
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="assessment-exit"
                    onClick={onExit}
                    disabled={submitting}
                >
                    {t("assessment.continue_later", "Continue later")}
                </Button>
            ) : (
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="assessment-prev"
                    onClick={onPrev}
                    disabled={submitting}
                >
                    {t("assessment.prev_question", "Previous question")}
                </Button>
            )}

            {!isLast ? (
                <Button
                    type="button"
                    variant="default"
                    data-testid="assessment-next"
                    onClick={onNext}
                    disabled={!currentAnswered || submitting}
                >
                    {t("assessment.next_question", "Next question")}
                </Button>
            ) : (
                <Button
                    type="button"
                    variant="default"
                    data-testid="assessment-submit"
                    onClick={onSubmit}
                    disabled={!allAnswered || submitting}
                >
                    {submitting
                        ? t("assessment.evaluating", "Evaluating…")
                        : t("assessment.submit", "Evaluate")}
                </Button>
            )}
        </div>
    );
}
