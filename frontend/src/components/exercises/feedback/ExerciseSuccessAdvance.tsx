/**
 * ExerciseSuccessAdvance (#1218).
 *
 * On a fully-correct answer the post-check "My answer" / "Solution"
 * toggle is redundant — both views show the same all-green answer and
 * there is nothing to reveal. This component is rendered in its place:
 * the two buttons "merge" (with a subtle, reduced-motion-aware entrance
 * effect) into a success badge plus a single "Continue" action that
 * drives the lesson's existing forward navigation (``onAdvance`` ===
 * the two-phase footer's ``goNext`` — no parallel path).
 *
 * Opt-in: a renderer only mounts this when the controlled parent passes
 * ``onAdvance``. The Review / Adaptive runners pass none, so they keep
 * the plain toggle.
 *
 * Accessibility: focus moves to the "Continue" button on mount so a
 * keyboard learner can advance immediately with Enter. Because the
 * button owns Enter, the global lesson Enter-shortcut steps aside (no
 * double advance). The entrance animation is gated behind ``motion-safe``
 * so ``prefers-reduced-motion`` renders the final state at once.
 *
 * Tailwind + design tokens only (shadcn ``Button``); theme-correct
 * across all themes.
 *
 * @example
 * {submitted && isCorrect && onAdvance ? (
 *   <ExerciseSuccessAdvance
 *     onAdvance={onAdvance}
 *     label={advanceLabel}
 *     testIdPrefix="word-tiles"
 *   />
 * ) : (
 *   <ExerciseAnswerToggle … />
 * )}
 */

import {useEffect, useRef} from "react";
import {Check, ChevronRight} from "lucide-react";

import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {useI18n} from "../../../hooks/ui/useI18n";

export interface ExerciseSuccessAdvanceProps {
    /** Advance to the next step (the lesson's ``goNext``). */
    onAdvance: () => void;
    /** Localised label for the Continue button. The lesson passes
     *  "Next" / "Finish lesson"; defaults to "Continue". */
    label?: string;
    /** Prefix for the ``data-testid`` hooks, e.g. ``"word-tiles"`` ->
     *  ``word-tiles-success-advance`` / ``word-tiles-advance``. */
    testIdPrefix?: string;
    /** Move focus to the Continue button on mount (default true). Kept
     *  overridable so a host that manages focus itself can opt out. */
    autoFocus?: boolean;
}

/**
 * Render the success badge + "Continue" merge control.
 *
 * @param props - See {@link ExerciseSuccessAdvanceProps}.
 */
export default function ExerciseSuccessAdvance({
    onAdvance,
    label,
    testIdPrefix = "exercise",
    autoFocus = true,
}: ExerciseSuccessAdvanceProps) {
    const {t} = useI18n();
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!autoFocus) return;
        // preventScroll: the lesson already scrolls the step into view;
        // we only want keyboard reach, not a competing scroll jump.
        buttonRef.current?.focus({preventScroll: true});
    }, [autoFocus]);

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2",
                "border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_12%,var(--surface))]",
                "motion-safe:animate-[exercise-success-merge_260ms_ease-out_both]",
            )}
            role="group"
            data-testid={`${testIdPrefix}-success-advance`}
        >
            <span
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--exercise-correct)]"
                data-testid={`${testIdPrefix}-success-badge`}
            >
                <Check size={16} aria-hidden="true" />
                {t("lesson.exercise.success.badge", "Correct!")}
            </span>
            <Button
                ref={buttonRef}
                type="button"
                size="sm"
                className="ml-auto"
                onClick={onAdvance}
                data-testid={`${testIdPrefix}-advance`}
            >
                {label ?? t("lesson.button.next", "Continue")}
                <ChevronRight size={16} aria-hidden="true" />
            </Button>
        </div>
    );
}
