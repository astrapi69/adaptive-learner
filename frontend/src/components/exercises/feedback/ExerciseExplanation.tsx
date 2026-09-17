/**
 * ExerciseExplanation (#2991) - the authored post-answer "why".
 *
 * Renders ``exercise.explanation`` (learn-content-engine schema 1.13:
 * Markdown, max 2000 chars) AFTER the learner has answered. Timing is what
 * separates it from the other author texts: ``examples`` show before the
 * answer, ``hint`` is on demand, this one only ever appears once the answer
 * is graded, so it may name the solution freely.
 *
 * Visibility follows the outcome: expanded after a wrong or partially wrong
 * answer (the learner wants to understand), collapsed behind a "Why?" toggle
 * after a fully correct one (the learner wants to move on) and on a
 * revisited step. Two gates keep it quiet: the review preference
 * "Show explanations" (shared with the generic post-lesson rule tips, #599)
 * and the lesson mode's ``immediateFeedback`` flag (exam mode hides every
 * per-question feedback).
 *
 * Mounted ONCE by the ``ExerciseDispatcher`` shell below every renderer, so
 * core types, ``ext:`` extensions and every surface (lesson, review,
 * adaptive, error replay) get it without per-renderer wiring. No XP cost:
 * this is feedback, not scaffolding.
 *
 * @example
 * <ExerciseExplanation explanation={exercise.explanation} outcome="incorrect" />
 */

import {ChevronDown, ChevronUp, Lightbulb} from "lucide-react";
import {useEffect, useState, useSyncExternalStore} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {
    readExplanationsEnabled,
    REVIEW_PREF_CHANGE_EVENT,
} from "../../../lib/review/reviewPref";

/** How the exercise was resolved, which decides the initial fold state. */
export type ExplanationOutcome = "correct" | "incorrect" | "reviewed";

export interface ExerciseExplanationProps {
    /** The authored Markdown explanation; nothing renders when empty. */
    explanation: string | null | undefined;
    /** The graded outcome; ``null`` while the exercise is unanswered
     *  (nothing renders). */
    outcome: ExplanationOutcome | null;
    /** ``data-testid`` of the section; defaults to ``exercise-explanation``. */
    testId?: string;
}

function subscribeToReviewPref(onChange: () => void): () => void {
    window.addEventListener(REVIEW_PREF_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(REVIEW_PREF_CHANGE_EVENT, onChange);
}

/** Live view of the "Show explanations" preference (same tab, no reload). */
function useExplanationsEnabled(): boolean {
    return useSyncExternalStore(
        subscribeToReviewPref,
        readExplanationsEnabled,
        readExplanationsEnabled,
    );
}

/**
 * Render the post-answer explanation panel, or nothing when there is no
 * explanation, no graded outcome, or a gate hides it.
 *
 * @param props - See {@link ExerciseExplanationProps}.
 */
export default function ExerciseExplanation({
    explanation,
    outcome,
    testId = "exercise-explanation",
}: ExerciseExplanationProps) {
    const {t} = useI18n();
    const {immediateFeedback} = useLessonMode();
    const enabled = useExplanationsEnabled();
    const [open, setOpen] = useState(outcome === "incorrect");
    useEffect(() => {
        setOpen(outcome === "incorrect");
    }, [outcome]);

    const body = explanation?.trim() ?? "";
    if (body === "" || outcome === null) return null;
    if (!enabled || !immediateFeedback) return null;

    const toggleLabel = open
        ? t("lesson.explanation.hide", "Hide explanation")
        : t("lesson.explanation.show", "Why?");
    const bodyId = `${testId}-body`;

    return (
        <section
            className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            data-testid={testId}
            data-state={open ? "open" : "collapsed"}
            data-outcome={outcome}
            aria-label={t("lesson.explanation.title", "Explanation")}
        >
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto min-h-11 w-full justify-start gap-2 px-3 py-2 text-[var(--fg-secondary)]"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-controls={bodyId}
                data-testid={`${testId}-toggle`}
            >
                <Lightbulb size={16} aria-hidden="true" />
                <span className="font-medium">{toggleLabel}</span>
                {open ? (
                    <ChevronUp size={14} aria-hidden="true" className="ml-auto" />
                ) : (
                    <ChevronDown size={14} aria-hidden="true" className="ml-auto" />
                )}
            </Button>
            {open && (
                <div
                    id={bodyId}
                    className="border-t border-[var(--border-subtle)] px-3 py-3 text-[0.95rem] leading-relaxed [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul:last-child]:mb-0"
                    data-testid={bodyId}
                >
                    <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
                </div>
            )}
        </section>
    );
}
