/**
 * CategorizationResolution (#2772).
 *
 * After the learner clicks "Solve" on a checked categorization exercise,
 * this presentational component reveals the AUTHORED assignment: every
 * bucket with exactly the items that belong in it. It replaces the
 * interactive bucket grid; nothing here is editable — the sibling of
 * {@link MatchingResolution} for the categorization type.
 *
 * Items the learner had already placed correctly carry a success tint
 * plus a check mark (``data-was-correct``); misplaced items render
 * neutrally in their correct bucket so the correction stands out.
 *
 * Accessibility: an ``aria-live`` region announces how many items the
 * learner had originally placed correctly.
 */

import {Check} from "lucide-react";

import {cn} from "@/lib/utils";
import {useI18n} from "../../../hooks/ui/useI18n";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import type {CategorizationPayload} from "../../../lib/exercises/payload/categorization";

export interface CategorizationResolutionProps {
    payload: CategorizationPayload;
    /** The learner's own item → bucket assignment, to mark the items
     *  that were already placed correctly. */
    assignments: ReadonlyMap<string, string>;
    correctCount: number;
    totalCount: number;
}

/**
 * Render the revealed authored assignment, one bucket per category.
 *
 * @param props - See {@link CategorizationResolutionProps}.
 */
export default function CategorizationResolution({
    payload,
    assignments,
    correctCount,
    totalCount,
}: CategorizationResolutionProps) {
    const {t} = useI18n();
    const announcement = t(
        "lesson.exercise.al_categorization.resolve_announce",
        "Solution shown. {correct} of {total} items were placed correctly.",
    )
        .replace("{correct}", String(correctCount))
        .replace("{total}", String(totalCount));

    return (
        <div data-testid="categorization-resolution">
            <span
                className="sr-only"
                role="status"
                aria-live="polite"
                data-testid="categorization-resolve-status"
            >
                {announcement}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {payload.categories.map((bucket) => (
                    <section
                        key={bucket.name}
                        className="min-w-40 flex-1 rounded-sm border border-[var(--border-strong)] p-2"
                        data-testid={`categorization-resolved-bucket-${bucket.name}`}
                    >
                        <p className="m-0 flex min-h-11 w-full items-center rounded-sm border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base font-medium">
                            {bucket.name}
                        </p>
                        <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                            {bucket.items.map((item) => {
                                const wasCorrect =
                                    assignments.get(item) === bucket.name;
                                return (
                                    <li
                                        key={item}
                                        data-testid={`categorization-resolved-item-${item}`}
                                        data-was-correct={
                                            wasCorrect || undefined
                                        }
                                        className={cn(
                                            "flex min-h-11 max-w-full flex-wrap items-center gap-1 rounded-sm border px-3 py-2 text-base",
                                            wasCorrect
                                                ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))]"
                                                : "border-[var(--border-strong)] bg-[var(--surface)]",
                                        )}
                                    >
                                        <span className="min-w-0 break-words">
                                            <InlineMarkdown>
                                                {item}
                                            </InlineMarkdown>
                                        </span>
                                        {wasCorrect && (
                                            <Check
                                                size={12}
                                                aria-hidden="true"
                                                className="shrink-0 text-[var(--success)]"
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}
