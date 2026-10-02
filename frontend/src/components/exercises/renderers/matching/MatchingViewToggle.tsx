/**
 * MatchingViewToggle (#977, #3186) - the post-check view toggle of the
 * matching exercise, split out of matching-parts.tsx for the file-size
 * gate. Also reused by the categorization exercise (#2772).
 */

import {Check, ListChecks, Sparkles} from "lucide-react";

import {Button} from "@/components/ui/button";

/** The post-check views (#977, #3186): the learner's own graded pairs,
 *  the same pairs with the correct partner under each mistake, and the
 *  revealed solution. */
export type MatchingPostCheckView = "user-answers" | "corrections" | "solution";

/** #977 — after checking, the learner toggles between their own graded
 *  answers and the revealed solution. The active view is a ``default``
 *  (filled) button carrying a Check; the inactive view is an ``outline``
 *  button. ``aria-pressed`` conveys the active state to assistive tech.
 *  Shown only after submit (the caller gates it). ``testidPrefix``
 *  (#2772) lets sibling exercise types (categorization) reuse the toggle
 *  under their own testid namespace; matching keeps its defaults.
 *  #3186: matching also passes ``onShowCorrections`` for a middle
 *  "Corrections" view; categorization keeps the two-view toggle. */
export function MatchingViewToggle({
    view,
    onShowUserAnswers,
    onShowCorrections,
    onShowSolution,
    myAnswersLabel,
    correctionsLabel,
    solveLabel,
    testidPrefix = "matching",
}: {
    view: MatchingPostCheckView;
    onShowUserAnswers: () => void;
    /** #3186 - renders the middle "Corrections" button when given
     *  together with ``correctionsLabel``; absent = the two-view toggle. */
    onShowCorrections?: () => void;
    onShowSolution: () => void;
    myAnswersLabel: string;
    correctionsLabel?: string;
    solveLabel: string;
    testidPrefix?: string;
}) {
    const userActive = view === "user-answers";
    const correctionsActive = view === "corrections";
    const solutionActive = view === "solution";
    return (
        <div
            className="flex flex-wrap gap-2"
            role="group"
            data-testid={`${testidPrefix}-view-toggle`}
        >
            <Button
                type="button"
                variant={userActive ? "default" : "outline"}
                size="sm"
                aria-pressed={userActive}
                onClick={onShowUserAnswers}
                data-testid={`${testidPrefix}-my-answers`}
            >
                {userActive && <Check size={14} aria-hidden="true" />}
                {myAnswersLabel}
            </Button>
            {onShowCorrections && correctionsLabel && (
                <Button
                    type="button"
                    variant={correctionsActive ? "default" : "outline"}
                    size="sm"
                    aria-pressed={correctionsActive}
                    onClick={onShowCorrections}
                    data-testid={`${testidPrefix}-corrections`}
                >
                    {correctionsActive ? (
                        <Check size={14} aria-hidden="true" />
                    ) : (
                        <ListChecks size={14} aria-hidden="true" />
                    )}
                    {correctionsLabel}
                </Button>
            )}
            <Button
                type="button"
                variant={solutionActive ? "default" : "outline"}
                size="sm"
                aria-pressed={solutionActive}
                onClick={onShowSolution}
                data-testid={`${testidPrefix}-resolve`}
            >
                {solutionActive ? (
                    <Check size={14} aria-hidden="true" />
                ) : (
                    <Sparkles size={14} aria-hidden="true" />
                )}
                {solveLabel}
            </Button>
        </div>
    );
}
