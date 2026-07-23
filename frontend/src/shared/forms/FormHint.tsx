/**
 * FormHint — the small, muted helper line under a form control (the "what
 * does this setting do" hint). Renders a `<p>` by default, or a `<span>` for
 * inline use.
 *
 * Fully presentational and app-agnostic: no i18n, no storage. Bring your own
 * (already-translated) text.
 *
 * NOTE (#1629, Half B): the defaults now live HERE as token-backed Tailwind
 * utilities (`text-fg-muted text-[0.85rem]`) — the byte-for-byte equivalent of
 * the deleted legacy `.form-hint` rule (`color: var(--fg-muted); font-size:
 * 0.85rem`). Any extra utility (`className`) is merged AFTER via `cn()`, so a
 * per-instance override (e.g. a `text-warning` color) wins exactly as it did
 * when it beat the legacy rule from the utilities layer.
 *
 * The `warning` variant is currently VISUALLY IDENTICAL to the default: the
 * old `form-hint-warning` modifier never had a CSS rule in the project's
 * history (it was a dead class — warning hints have always rendered muted).
 * The prop is kept as the semantic seam so warning hints can be given a real
 * `--warning` tone in a later, deliberately visually-reviewed pass without
 * re-touching every call site.
 *
 * @example
 * <FormHint>{t("settings.review_length.hint")}</FormHint>
 *
 * @example
 * // inline, warning tone (semantic marker; renders muted today)
 * <FormHint as="span" variant="warning">{t("create.title_required")}</FormHint>
 */

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FormHintProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Element to render. Default `"p"`. */
  as?: "p" | "span";
  /**
   * Semantic tone. `"warning"` currently renders identically to `"default"`
   * (see the component note); kept as the seam for a future warning-color
   * pass. Default `"default"`.
   */
  variant?: "default" | "warning";
}

export default function FormHint({
  children,
  as = "p",
  variant: _variant = "default",
  className,
  ...rest
}: FormHintProps) {
  const Tag = as;
  return (
    <Tag className={cn("text-fg-muted text-[0.85rem]", className)} {...rest}>
      {children}
    </Tag>
  );
}
