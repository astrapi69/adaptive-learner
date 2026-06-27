/**
 * ExerciseFooter — the shared Check / Retry button row for the five
 * lesson exercise renderers.
 *
 * Every renderer rendered the same two buttons: a default "Check answer"
 * button while unanswered (disabled until the answer is checkable), and an
 * outline "Try again" button once checked. In the Lesson two-phase flow
 * (``controlled``) both are hidden — the parent drives submit via the
 * shared "Prüfen" button. Only the testid prefix, the labels, and the
 * checkable predicate differed, so they are props here.
 *
 * Placement contract: a renderer renders its own post-check feedback
 * (result line, token diff, celebration) and then drops this footer at the
 * END of the same row, so the rendered order — feedback, then Retry — is
 * unchanged from the hand-rolled version.
 */

import {RotateCcw} from "lucide-react";

import {Button} from "@/components/ui/button";

export interface ExerciseFooterProps {
    /** Testid namespace: the buttons become ``${testidPrefix}-submit`` /
     *  ``${testidPrefix}-retry`` (matching the per-renderer ids). */
    testidPrefix: string;
    /** Lesson two-phase flow: hide both buttons (the parent drives). */
    controlled: boolean;
    /** True once the answer has been checked. */
    submitted: boolean;
    /** Whether the answer is checkable (enables the Check button). */
    canCheck: boolean;
    /** Check the current answer (the renderer's ``submit``). */
    onCheck: () => void;
    /** Clear + re-answer (the renderer's ``reset``). */
    onRetry: () => void;
    /** Localised "Check answer" label. */
    checkLabel: string;
    /** Localised "Try again" label. */
    retryLabel: string;
}

/**
 * Render the Check (pre-check) or Retry (post-check) button, or nothing in
 * controlled mode.
 *
 * @param props - See {@link ExerciseFooterProps}.
 */
export default function ExerciseFooter({
    testidPrefix,
    controlled,
    submitted,
    canCheck,
    onCheck,
    onRetry,
    checkLabel,
    retryLabel,
}: ExerciseFooterProps) {
    if (controlled) return null;

    if (!submitted) {
        return (
            <Button
                type="button"
                disabled={!canCheck}
                onClick={onCheck}
                data-testid={`${testidPrefix}-submit`}
            >
                {checkLabel}
            </Button>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onRetry}
            data-testid={`${testidPrefix}-retry`}
        >
            <RotateCcw size={14} aria-hidden="true" />
            {retryLabel}
        </Button>
    );
}
