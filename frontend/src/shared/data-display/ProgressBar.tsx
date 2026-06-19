/**
 * ProgressBar — an accessible determinate progress bar. Renders a
 * `role="progressbar"` track (with `aria-valuenow` / `-valuemin` /
 * `-valuemax`), a fill scaled to `valueNow` percent, and an optional
 * overlaid label (passed as children).
 *
 * App-agnostic and props-driven: `valueNow` is the already-computed
 * percentage (0–100) used for both the ARIA value and the fill width,
 * and every visual class is caller-supplied so the bar inherits each
 * app's theme. Reusable for lesson progress, upload progress, XP bars,
 * any determinate-progress indicator.
 *
 * @example
 * <ProgressBar
 *   valueNow={30}
 *   ariaLabel="Lesson progress"
 *   className="lesson-progress-bar"
 *   fillClassName="lesson-progress-fill"
 *   labelClassName="lesson-progress-label"
 *   testId="lesson-progress-bar"
 * >
 *   Step 3 of 10
 * </ProgressBar>
 */

import type { ReactNode } from "react";

export interface ProgressBarProps {
  /** Completion percentage, 0–100. Drives aria-valuenow + fill width. */
  valueNow: number;
  /** Accessible name for the progress bar. */
  ariaLabel: string;
  /** Optional overlaid label content. */
  children?: ReactNode;
  /** Class for the track `<div role="progressbar">`. */
  className?: string;
  /** Class for the inner fill `<div>`. */
  fillClassName?: string;
  /** Class for the label `<span>`. */
  labelClassName?: string;
  /** `data-testid` for the track. */
  testId?: string;
}

/** Accessible determinate progress bar with an optional label. */
export default function ProgressBar({
  valueNow,
  ariaLabel,
  children,
  className,
  fillClassName,
  labelClassName,
  testId,
}: ProgressBarProps) {
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={valueNow}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div className={fillClassName} style={{ width: `${valueNow}%` }} />
      <span className={labelClassName}>{children}</span>
    </div>
  );
}
