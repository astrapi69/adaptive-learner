import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One selectable option. A bare string is shorthand for `{value: s}`. */
export interface ChoiceOption {
  /** Reported on selection; also the accessible name when no `label`. */
  value: string;
  /** Optional display text (defaults to `value`). */
  label?: string;
  /** Optional explicit test id for this option's button. */
  testId?: string;
}

/** Post-decision feedback state for a graded option group. */
export type ChoiceOptionState = "correct" | "wrong";

export interface ChoiceButtonGroupProps {
  options: ReadonlyArray<ChoiceOption | string>;
  /** The currently-selected value, or null. */
  value: string | null;
  onChange: (value: string) => void;
  /** Accessible label for the radiogroup. */
  ariaLabel: string;
  /** Real disabled (greyed, non-interactive) — e.g. a busy wizard step. */
  disabled?: boolean;
  /** Inert but NOT greyed — keeps selection/feedback colours vivid while
   *  blocking further input (e.g. a graded exercise after the answer is
   *  checked). */
  locked?: boolean;
  /** 1 = stacked (default); 2 = two columns from the `sm` breakpoint up. */
  columns?: 1 | 2;
  /** Label alignment. "start" (default) left-aligns — best for long answer
   *  text; "center" matches short pill-style options (e.g. wizard steps). */
  align?: "start" | "center";
  /** Per-option correct/wrong colouring for graded contexts. */
  stateFor?: (value: string) => ChoiceOptionState | undefined;
  /** Prefix for per-option test ids (`${prefix}-${index}`) when an option
   *  carries no explicit `testId`. */
  testIdPrefix?: string;
  /** Test id for the radiogroup container. */
  groupTestId?: string;
  className?: string;
}

function normalize(option: ChoiceOption | string): ChoiceOption {
  return typeof option === "string" ? { value: option } : option;
}

/**
 * A group of tappable answer buttons behaving as a single-select radiogroup —
 * the touch-friendly options pattern proven on iPhone in the onboarding wizard
 * (`OnboardingWizard`), extracted here for reuse (multiple-choice exercises,
 * wizard steps, …). Replaces native `<select>` dropdowns, which mis-hit on iOS.
 *
 * shadcn `Button` primitives, ≥44px touch targets, Tailwind + design tokens
 * only. Long option text **wraps** (never truncates). Keyboard: each option is
 * a native button (Tab to focus, Enter/Space to select).
 */
export default function ChoiceButtonGroup({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  locked = false,
  columns = 1,
  align = "start",
  stateFor,
  testIdPrefix,
  groupTestId,
  className,
}: ChoiceButtonGroupProps) {
  const inert = disabled || locked;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={groupTestId}
      className={cn(
        "grid grid-cols-1 gap-2",
        columns === 2 && "sm:grid-cols-2",
        className,
      )}
    >
      {options.map((raw, index) => {
        const opt = normalize(raw);
        const selected = value === opt.value;
        const state = stateFor?.(opt.value);
        return (
          <Button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={locked || undefined}
            tabIndex={locked ? -1 : undefined}
            variant={selected ? "default" : "outline"}
            disabled={disabled}
            onClick={inert ? undefined : () => onChange(opt.value)}
            data-testid={
              opt.testId ?? (testIdPrefix ? `${testIdPrefix}-${index}` : undefined)
            }
            data-selected={selected ? "true" : undefined}
            data-state={state}
            className={cn(
              // ≥44px target, grow for wrapped text (never truncate).
              "h-auto min-h-11 w-full min-w-0 whitespace-normal break-words py-2",
              align === "center"
                ? "justify-center text-center"
                : "justify-start text-left",
              locked && "pointer-events-none",
              state === "correct" &&
                "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--fg)]",
              state === "wrong" &&
                "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] text-[var(--fg)]",
            )}
          >
            {opt.label ?? opt.value}
          </Button>
        );
      })}
    </div>
  );
}
