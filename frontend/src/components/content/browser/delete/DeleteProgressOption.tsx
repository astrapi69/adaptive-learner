/**
 * DeleteProgressOption - the opt-in "also delete my learning progress"
 * checkbox shared by the set delete-confirm modals (#1819; mirrors the
 * repo-removal dialog from #1445 Part B).
 *
 * Shows the real counts when a {@link DeletionPlan} is available and a
 * number-free label while counting / on failure (Numeric-Claims
 * discipline: never invent a count). Default off - deleting a set never
 * silently deletes learner data.
 *
 * @example
 * <DeleteProgressOption plan={plan} checked={x} onChange={setX} testId="delete-set-progress" />
 */

import { useI18n } from "../../../../hooks/ui/useI18n";
import type { DeletionPlan } from "../../../../lib/content/browse/orphan-cleanup";

export interface DeleteProgressOptionProps {
    plan: DeletionPlan | null;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
    testId: string;
    /** Override the with-counts label i18n key (default: set-delete copy).
     *  #2064 — the single-lesson delete passes lesson-oriented copy. */
    labelKey?: string;
    labelFallback?: string;
    /** Override the number-free label i18n key (default: set-delete copy). */
    noCountsKey?: string;
    noCountsFallback?: string;
}

export default function DeleteProgressOption({
    plan,
    checked,
    disabled = false,
    onChange,
    testId,
    labelKey = "content.set_status.delete_progress_option",
    labelFallback = "Also delete my learning progress and review cards ({lessons} lessons, {cards} cards)",
    noCountsKey = "content.set_status.delete_progress_option_nocounts",
    noCountsFallback = "Also delete my learning progress and review cards",
}: DeleteProgressOptionProps) {
    const {t} = useI18n();
    const label = plan
        ? t(labelKey, labelFallback)
              .replace("{lessons}", String(plan.lessonCount))
              .replace("{cards}", String(plan.cardCount))
        : t(noCountsKey, noCountsFallback);
    return (
        <label className="flex items-start gap-2 text-sm text-fg-secondary">
            <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                data-testid={testId}
            />
            <span>{label}</span>
        </label>
    );
}
