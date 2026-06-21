/**
 * LessonStickyFooter — Tailwind CSS proof-of-concept (Phase A / commit C4).
 *
 * The FIRST component in the codebase written entirely with Tailwind
 * utility classes instead of global.css rules. It proves the Phase A
 * setup end to end:
 *   - Tailwind utilities compile and ship (sticky / z-10 / p-4 / w-full /
 *     py-3 / bg-gradient-to-t / transition-colors / disabled:* ...).
 *   - Our 6-theme CSS variables flow THROUGH Tailwind: ``bg-accent`` ->
 *     ``var(--accent)``, ``text-accent-fg`` -> ``var(--accent-fg)``,
 *     ``from-bg-primary`` -> ``var(--bg-primary)``, ``rounded-app`` ->
 *     ``var(--radius-md)``. Switching ``[data-theme]`` recolors the
 *     button with zero component changes.
 *   - The shadcn/ui ``cn()`` helper resolves from the ``@/lib/utils``
 *     path alias.
 *
 * It also implements the sticky-footer / reserved-space pattern that the
 * lesson navigation will adopt in Phase B (a bottom-pinned primary action
 * that stays visible as lesson content scrolls, with a gradient fade so
 * content does not butt against the button). It is intentionally NOT yet
 * wired into the live Lesson page: Phase A is additive and must not change
 * how existing pages look. The lesson nav migrates "when touched" — see
 * docs/development/tailwind-migration.md.
 *
 * Disabled styling (opacity .55 + not-allowed cursor) deliberately mirrors
 * the existing global.css ``button:disabled`` rule so a migrated button
 * looks identical to the current ones.
 */

import {cn} from "@/lib/utils";

interface LessonStickyFooterProps {
    /** Label for the primary action button (e.g. "Next" / "Finish"). */
    label: string;
    /** Click handler for the primary action. */
    onClick: () => void;
    /** When true, the button is non-interactive and dimmed. */
    disabled?: boolean;
    /** Extra classes merged onto the sticky container. */
    className?: string;
    /** Root ``data-testid``; the button gets ``{testId}-action``. */
    testId?: string;
}

export default function LessonStickyFooter({
    label,
    onClick,
    disabled = false,
    className,
    testId = "lesson-sticky-footer",
}: LessonStickyFooterProps) {
    return (
        <div
            data-testid={testId}
            className={cn(
                "sticky bottom-0 z-10 bg-gradient-to-t from-bg-primary to-transparent p-4",
                className,
            )}
        >
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                data-testid={`${testId}-action`}
                className="w-full rounded-app bg-accent py-3 font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-[.55]"
            >
                {label}
            </button>
        </div>
    );
}
