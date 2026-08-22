/**
 * Modal building blocks (EXP-044 Option C, #1485).
 *
 * The hand-rolled inline-modal pattern (`.modal-overlay` > `.modal-card` >
 * `.modal-title`) was duplicated across ~15 dialog components with its
 * styling in legacy CSS. These shared parts replace both: the JSX shell and
 * the legacy rules (deleted with the extraction — unlike `settings-section`
 * the modal classnames have no external-package consumers).
 *
 * Deliberately NOT a Radix/shadcn `Dialog`: these dialogs render inline
 * (no portal), drive their own focus management via `useDialogFocus`, and
 * their Vitest suites assert on that DOM directly — the Radix portal +
 * happy-dom combination is a documented flake source (lessons/frontend.md).
 * Swapping the mechanism would be a behavior change, not an extraction.
 *
 * NOT the end state — a tracked intermediate. The designated frame for
 * dialogs is {@link ../feedback/ModalShell} (scrollable body + X + Escape +
 * backdrop close, #937/#2266); consumers of these parts still lack those
 * height-independent exits and stay counted as `raw` in the #2266
 * shrink-only ratchet (`shared/feedback/modal-exit-coverage.test.ts`,
 * whose detector matches `<ModalOverlay` for exactly that reason). NEW
 * dialogs use ModalShell / ConfirmDialog / Radix — not these parts.
 *
 * All parts merge `className` via `cn()` (tailwind-merge), forward their
 * ref, and pass every other DOM attribute through — consumers keep their
 * `role`/`aria-*`/`data-testid`/`onClick` wiring unchanged.
 *
 * Responsive note: the old mobile override lived in a
 * `@media (max-width: 768px)` block; `max-md:` compiles to
 * `width < 768px` — a 1px boundary nuance with no practical effect.
 *
 * @example
 * ```tsx
 * <ModalOverlay data-testid="my-dialog">
 *   <ModalCard ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="my-title">
 *     <ModalTitle id="my-title">Confirm</ModalTitle>
 *     ...
 *   </ModalCard>
 * </ModalOverlay>
 * ```
 */
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/** Fullscreen dimmed backdrop that centers its child card. */
export const ModalOverlay = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(function ModalOverlay({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--bg-overlay)] p-[var(--space-4)]",
        className,
      )}
      {...rest}
    />
  );
});

/** The modal surface: elevated card, capped width, scrolls on phones. */
export const ModalCard = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(function ModalCard({ className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex w-full max-w-[32rem] flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-bg-surface p-[var(--space-5)] shadow-[var(--shadow-elevated)] max-md:max-h-[92vh] max-md:overflow-y-auto",
        className,
      )}
      {...rest}
    />
  );
});

export interface ModalTitleProps extends ComponentPropsWithoutRef<"h2"> {
  /** Heading level — keep each dialog's existing outline level. */
  as?: "h2" | "h3";
}

/** The modal heading; `as` preserves the consumer's heading level. */
export const ModalTitle = forwardRef<HTMLHeadingElement, ModalTitleProps>(
  function ModalTitle({ as: Tag = "h2", className, ...rest }, ref) {
    return (
      <Tag
        ref={ref}
        className={cn("m-0 text-[1.25rem] font-semibold", className)}
        {...rest}
      />
    );
  },
);
