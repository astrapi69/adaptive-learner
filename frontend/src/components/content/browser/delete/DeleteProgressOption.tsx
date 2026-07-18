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
}

export default function DeleteProgressOption({
    plan,
    checked,
    disabled = false,
    onChange,
    testId,
}: DeleteProgressOptionProps) {
    const {t} = useI18n();
    const label = plan
        ? t(
              "content.set_status.delete_progress_option",
              "Also delete my learning progress and review cards ({lessons} lessons, {cards} cards)",
          )
              .replace("{lessons}", String(plan.lessonCount))
              .replace("{cards}", String(plan.cardCount))
        : t(
              "content.set_status.delete_progress_option_nocounts",
              "Also delete my learning progress and review cards",
          );
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
