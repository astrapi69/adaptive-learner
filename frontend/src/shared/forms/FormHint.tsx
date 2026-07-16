/**
 * FormHint — the small, muted helper line under a form control (the "what
 * does this setting do" hint). Renders a `<p>` by default, or a `<span>` for
 * inline use; the `warning` variant carries the existing `form-hint-warning`
 * modifier class.
 *
 * Fully presentational and app-agnostic: no i18n, no storage. Bring your own
 * (already-translated) text.
 *
 * NOTE (#1629, additive step — Half A): this wrapper deliberately emits the
 * legacy `form-hint` class (and `form-hint-warning` for the warning variant)
 * so it renders IDENTICALLY to the hand-written `<p className="form-hint">` /
 * `<span className="form-hint form-hint-warning">` it replaces — the legacy
 * rule in `styles/legacy/04-onboarding.css` still styles it (0-diff by
 * construction). Any extra utility (`className`) is merged AFTER, exactly as
 * a per-instance override was before. The follow-up (Half B) moves the
 * defaults into this component as token-backed Tailwind utilities and DELETES
 * the legacy `.form-hint` rule — a single contained, visually-reviewed change
 * here instead of one per consumer; it touches `styles/legacy`
 * (visual-critical) and must run on a machine that can refresh the
 * visual-regression baselines.
 *
 * @example
 * <FormHint>{t("settings.review_length.hint")}</FormHint>
 *
 * @example
 * // inline, warning tone
 * <FormHint as="span" variant="warning">{t("create.title_required")}</FormHint>
 */

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FormHintProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Element to render. Default `"p"`. */
  as?: "p" | "span";
  /** `"warning"` adds the `form-hint-warning` modifier class. Default `"default"`. */
  variant?: "default" | "warning";
}

export default function FormHint({
  children,
  as = "p",
  variant = "default",
  className,
  ...rest
}: FormHintProps) {
  const Tag = as;
  // Compute the modifier class OUTSIDE cn() so the ``=== "warning"`` literal
  // is not mis-read as a class name by the dead-classnames extractor (#1465).
  const variantClass = variant === "warning" ? "form-hint-warning" : undefined;
  return (
    <Tag className={cn("form-hint", variantClass, className)} {...rest}>
      {children}
    </Tag>
  );
}
