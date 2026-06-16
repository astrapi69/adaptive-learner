/**
 * SrsStatusBadge — a small status pill (e.g. New / Learning / Due /
 * Mastered) coloured by a semantic tone.
 *
 * App-agnostic and props-driven: the caller passes a display label and
 * a ``tone`` (the mapping from a domain status to a tone lives in the
 * app), plus optional title text. No i18n/storage imports; tones use
 * token-backed Tailwind so they recolor across themes. Reusable for any
 * compact status chip.
 *
 * @example
 * <SrsStatusBadge label="Due" tone="warning" title="3 elements due" />
 */

export type SrsBadgeTone = "neutral" | "info" | "warning" | "success";

export interface SrsStatusBadgeProps {
    label: string;
    tone: SrsBadgeTone;
    /** Optional ``title``/tooltip + accessible description. */
    title?: string;
    testId?: string;
}

const TONE_CLASS: Record<SrsBadgeTone, string> = {
    neutral: "border-border-subtle bg-bg-secondary text-fg-muted",
    info: "border-info/30 bg-info/15 text-info",
    warning: "border-warning/30 bg-warning/15 text-warning",
    success: "border-success/30 bg-success/15 text-success",
};

/** Compact, tone-coloured status pill (presentational, token-backed). */
export default function SrsStatusBadge({
    label,
    tone,
    title,
    testId,
}: SrsStatusBadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
            title={title}
            data-testid={testId}
            data-tone={tone}
        >
            {label}
        </span>
    );
}
