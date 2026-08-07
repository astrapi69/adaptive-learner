/**
 * UpdateGuardPlanPanel — shows WHAT a held update would carry over, and what
 * it refuses to guess (#2308).
 *
 * The mapping behind this panel is an inference: the element key is the answer
 * text, so a corrected answer looks exactly like a different element until the
 * two versions are compared by position. That inference is right for the large
 * majority of real edits and wrong for reorders, so the panel never presents
 * it as a fact - it lists the pairs, names the count it cannot assign, and
 * leaves the decision to the learner.
 *
 * Props-driven and app-state-free: the plan comes in, the toggle goes out.
 *
 * @example
 * ```tsx
 * <UpdateGuardPlanPanel plan={plan} carryOver={on} onCarryOverChange={setOn} />
 * ```
 */

import type {RemapPlan} from "../../lib/content/update/remap-plan";
import {useI18n} from "../../hooks/ui/useI18n";

/** How many pairs to show before collapsing into a count. Enough to judge the
 *  KIND of change (a transliteration sweep looks different from a rewrite)
 *  without turning the dialog into a scroll area on a phone. */
const PREVIEW_LIMIT = 3;

export interface UpdateGuardPlanPanelProps {
    plan: RemapPlan;
    carryOver: boolean;
    onCarryOverChange: (next: boolean) => void;
}

export default function UpdateGuardPlanPanel({
    plan,
    carryOver,
    onCarryOverChange,
}: UpdateGuardPlanPanelProps) {
    const {t} = useI18n();
    const certain = plan.certain;
    const uncertain = plan.uncertain;
    if (certain.length === 0 && uncertain.length === 0) return null;

    const preview = certain.slice(0, PREVIEW_LIMIT);
    const hidden = certain.length - preview.length;

    return (
        <div className="mt-3 flex flex-col gap-2 text-sm" data-testid="update-guard-plan">
            {certain.length > 0 ? (
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
                            <span className="text-fg-muted">({certain.length})</span>
                        </span>
                    </label>
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
                                {t("content.update_guard.preview_more", "and {count} more").replace(
                                    "{count}",
                                    String(hidden),
                                )}
                            </li>
                        ) : null}
                    </ul>
                </>
            ) : null}

            {uncertain.length > 0 ? (
                <p className="text-fg-muted" data-testid="update-guard-unmappable">
                    {t(
                        "content.update_guard.unmappable",
                        "{count} cannot be assigned with confidence and will be reset. Their order or number changed, so nothing is guessed.",
                    ).replace("{count}", String(uncertain.length))}
                </p>
            ) : null}
        </div>
    );
}
