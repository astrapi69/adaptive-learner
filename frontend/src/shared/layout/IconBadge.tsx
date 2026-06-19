/**
 * IconBadge — a compact, accessible label pill with an optional leading
 * icon and a token-backed visual variant.
 *
 * Fully presentational and app-agnostic: the label text, the icon node,
 * and the accessible name are all caller-supplied, and it imports
 * nothing app-specific (no i18n, no icon library, no storage). The
 * three variants resolve through the shadcn/Tailwind theme bridge
 * tokens, so the badge is correct in all themes without any hardcoded
 * colour. Bring your own translated label and your own icon.
 *
 * Use it wherever a short status needs surfacing next to a row or
 * heading — an origin marker, a trust level, a "new" flag, a count.
 *
 * @example
 * // "Your lesson" marker on a folded user lesson
 * <IconBadge
 *   variant="primary"
 *   icon={<User size={12} aria-hidden="true" />}
 *   label={t("content.tree.own_lesson", "Your lesson")}
 *   testId={`lesson-${id}-origin`}
 * />
 *
 * @example
 * // A muted "edit" marker, with an explicit accessible name
 * <IconBadge
 *   variant="muted"
 *   icon={<Pencil size={12} aria-hidden="true" />}
 *   label={t("content.tree.own_edit", "Your edit")}
 *   ariaLabel="Your edit of a community lesson"
 * />
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type IconBadgeVariant = "primary" | "muted" | "outline";

export interface IconBadgeProps {
  /** Visible label text (caller-supplied / already translated). */
  label: string;
  /** Optional leading icon node; keep it `aria-hidden` yourself. */
  icon?: ReactNode;
  /** Token-backed visual tone. Defaults to `muted`. */
  variant?: IconBadgeVariant;
  /** Accessible name for the badge. Defaults to `label`. */
  ariaLabel?: string;
  /** Extra classes merged after the variant classes. */
  className?: string;
  /** `data-testid` for the badge element. */
  testId?: string;
}

const VARIANT_CLASSES: Record<IconBadgeVariant, string> = {
  primary: "border-transparent bg-primary text-primary-foreground",
  muted: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border text-foreground",
};

export default function IconBadge({
  label,
  icon,
  variant = "muted",
  ariaLabel,
  className,
  testId,
}: IconBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
