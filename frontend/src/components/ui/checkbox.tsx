/**
 * shadcn-style Checkbox — a token-backed, accessible tri-state checkbox.
 *
 * Built as a ``role="checkbox"`` button (not a Radix primitive) so it
 * needs no extra dependency while keeping the shadcn API
 * (``checked`` / ``onCheckedChange`` / ``disabled``). Supports an
 * ``"indeterminate"`` state for "select all" master toggles. Colours
 * resolve through the theme bridge tokens, so it is correct in all
 * themes without any hardcoded colour.
 *
 * @example
 * <Checkbox checked={on} onCheckedChange={setOn} aria-label="Include X" />
 */

import * as React from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps {
  /** ``true`` / ``false`` / ``"indeterminate"`` (mixed). */
  checked?: boolean | "indeterminate";
  /** Called with the next boolean checked state on activation. */
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "data-testid"?: string;
}

export function Checkbox({
  checked = false,
  onCheckedChange,
  disabled,
  className,
  ...rest
}: CheckboxProps) {
  const isOn = checked === true;
  const isIndeterminate = checked === "indeterminate";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isIndeterminate ? "mixed" : isOn}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!isOn)}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow-sm",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        (isOn || isIndeterminate) && "bg-primary text-primary-foreground",
        className,
      )}
      {...rest}
    >
      {isIndeterminate ? (
        <Minus className="size-3" aria-hidden="true" />
      ) : isOn ? (
        <Check className="size-3" aria-hidden="true" />
      ) : null}
    </button>
  );
}
