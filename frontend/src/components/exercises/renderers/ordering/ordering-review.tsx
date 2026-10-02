/**
 * Post-check view for ``ext:al-ordering`` (#3260). The editing surface
 * (``TileSequenceEditor``) unmounts once the answer is checked, which used
 * to leave the learner with a bare "Not quite" and an empty card. This view
 * shows the order as submitted, one verdict per position, and on a wrong
 * answer the canonical order below it. Sibling of ``parsons-review.tsx``
 * (#3218), which closed the same gap for code lines.
 *
 * Pure presentation: a position counts as right exactly when the grader
 * (``isOrderingCorrect``) would accept that slot, i.e. the item placed
 * there is the item authored there, so a mark never contradicts the
 * overall result.
 *
 * @example
 * <OrderingReview items={items} placed={[1, 0, 2]} isCorrect={false} t={t} />
 */

import {Check, X} from "lucide-react";

import {cn} from "@/lib/utils";

type Translate = (key: string, fallback?: string) => string;

const I18N_PREFIX = "lesson.exercise.al_ordering";

export interface OrderingReviewProps {
    /** The payload's items in canonical order. */
    items: readonly string[];
    /** Indices into ``items`` in the learner's submitted order. */
    placed: readonly number[];
    isCorrect: boolean;
    t: Translate;
}

export function OrderingReview({items, placed, isCorrect, t}: OrderingReviewProps) {
    return (
        <div className="flex flex-col gap-3" data-testid="ordering-review">
            <div className="flex flex-col gap-1">
                <p className="m-0 text-[0.8125rem] font-medium text-[var(--fg-muted)]">
                    {t(`${I18N_PREFIX}.review_heading`, "Your answer")}
                </p>
                <ol className="m-0 flex list-none flex-col gap-1 rounded-sm border border-[var(--border-accent)] bg-[var(--bg-elevated)] p-2">
                    {placed.map((itemIndex, slot) => {
                        const ok = itemIndex === slot;
                        return (
                            <li
                                key={slot}
                                className={cn(
                                    "flex items-start gap-2 rounded-sm px-1 py-0.5",
                                    !ok &&
                                        "bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,transparent)]",
                                )}
                                data-testid={`ordering-review-item-${slot}`}
                                data-correct={ok}
                            >
                                {ok ? (
                                    <Check
                                        size={14}
                                        aria-hidden="true"
                                        className="mt-1 shrink-0 text-[var(--exercise-correct)]"
                                    />
                                ) : (
                                    <X
                                        size={14}
                                        aria-hidden="true"
                                        className="mt-1 shrink-0 text-[var(--exercise-wrong)]"
                                    />
                                )}
                                <span className="tabular-nums text-[var(--fg-muted)]">
                                    {slot + 1}.
                                </span>
                                <span className="min-w-0 break-words">{items[itemIndex]}</span>
                            </li>
                        );
                    })}
                </ol>
            </div>
            {!isCorrect && (
                <div className="flex flex-col gap-1">
                    <p className="m-0 text-[0.8125rem] font-medium text-[var(--exercise-correct)]">
                        {t(`${I18N_PREFIX}.solution_heading`, "Solution")}
                    </p>
                    <ol
                        className="m-0 flex list-none flex-col gap-1 rounded-sm border border-[var(--exercise-correct)] bg-[var(--bg-elevated)] p-2"
                        data-testid="ordering-solution"
                    >
                        {items.map((item, slot) => (
                            <li key={slot} className="flex items-start gap-2 px-1 py-0.5">
                                <span className="tabular-nums text-[var(--fg-muted)]">
                                    {slot + 1}.
                                </span>
                                <span className="min-w-0 break-words">{item}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}
