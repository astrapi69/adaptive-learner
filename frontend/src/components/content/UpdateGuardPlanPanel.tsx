/**
 * UpdateGuardPlanPanel — shows WHAT a held update would carry over, and what
 * it refuses to guess (#2308; AUTH-05 folded in the exercise-level half).
 *
 * The mapping behind this panel is an inference: the element key is the answer
 * text, so a corrected answer looks exactly like a different element until the
 * two versions are compared by position. That inference is right for the large
 * majority of real edits and wrong for reorders, so the panel never presents
 * it as a fact - it lists the pairs, names the count it cannot assign, and
 * leaves the decision to the learner.
 *
 * AUTH-05 adds a second, silent dimension: an exercise's own slug can be
 * renumbered the same way an answer text changes. It counts toward the same
 * totals (the learner cares "how much comes back", not which layer moved),
 * but its pairs are technical slugs (e.g. ``ex-match-3 -> ex-match-4``), not
 * legible answer text - the readable preview list stays scoped to the
 * element-key pairs, which is the change a learner actually recognizes.
 *
 * Props-driven and app-state-free: the plan comes in, the toggle goes out.
 *
 * @example
 * ```tsx
 * <UpdateGuardPlanPanel plan={plan} carryOver={on} onCarryOverChange={setOn} />
 * ```
 */

import type {SetUpdatePlan} from "../../lib/content/update/plan-set-update";
import {useI18n} from "../../hooks/ui/useI18n";

/** How many pairs to show before collapsing into a count. Enough to judge the
 *  KIND of change (a transliteration sweep looks different from a rewrite)
 *  without turning the dialog into a scroll area on a phone. */
const PREVIEW_LIMIT = 3;

export interface UpdateGuardPlanPanelProps {
    plan: SetUpdatePlan;
    carryOver: boolean;
    onCarryOverChange: (next: boolean) => void;
}

export default function UpdateGuardPlanPanel({
    plan,
    carryOver,
    onCarryOverChange,
}: UpdateGuardPlanPanelProps) {
    const {t} = useI18n();
    const elementCertain = plan.element.certain;
    const totalCertain = plan.exercise.certain.length + elementCertain.length;
    const totalUncertain = plan.exercise.uncertain.length + plan.element.uncertain.length;
    if (totalCertain === 0 && totalUncertain === 0) return null;

    const preview = elementCertain.slice(0, PREVIEW_LIMIT);
    const hidden = elementCertain.length - preview.length;

    return (
        <div className="mt-3 flex flex-col gap-2 text-sm" data-testid="update-guard-plan">
            {totalCertain > 0 ? (
                <>
                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            checked={carryOver}
                            onChange={(event) => onCarryOverChange(event.target.checked)}
                            data-testid="update-guard-carry-over"
                        />
                        <span>
                            {t(
                                "content.update_guard.carry_over_label",
                                "Carry over what still matches",
                            )}{" "}
                            <span className="text-fg-muted">({totalCertain})</span>
                        </span>
                    </label>
                    {elementCertain.length > 0 ? (
                        <ul
                            className="ml-6 flex flex-col gap-1 text-fg-muted"
                            data-testid="update-guard-plan-preview"
                        >
                            {preview.map((remap) => (
                                <li key={`${remap.exercise_id}-${remap.old}`}>
                                    <span className="line-through">{remap.old}</span>
                                    {" → "}
                                    <span>{remap.new}</span>
                                </li>
                            ))}
                            {hidden > 0 ? (
                                <li>
                                    {t(
                                        "content.update_guard.preview_more",
                                        "and {count} more",
                                    ).replace("{count}", String(hidden))}
                                </li>
                            ) : null}
                        </ul>
                    ) : null}
                </>
            ) : null}

            {totalUncertain > 0 ? (
                <p className="text-fg-muted" data-testid="update-guard-unmappable">
                    {t(
                        "content.update_guard.unmappable",
                        "{count} cannot be assigned with confidence and will be reset. Their order or number changed, so nothing is guessed.",
                    ).replace("{count}", String(totalUncertain))}
                </p>
            ) : null}
        </div>
    );
}
