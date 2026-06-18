/**
 * SearchField — a reusable, props-driven search input with a search icon.
 *
 * App-agnostic: it is a controlled text input (the caller owns the value and
 * does any debouncing). Token-backed Tailwind only, 44px tall touch target,
 * an accessible label, and an optional clear button. No i18n import — the
 * placeholder + aria label come in through props.
 *
 * @example
 * <SearchField
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Spanisch, KI, Psychologie…"
 *   ariaLabel="Search content"
 * />
 */

import { Search, X } from "lucide-react";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name for the input; defaults to the placeholder. */
  ariaLabel?: string;
  /** Label for the clear button (a11y); when omitted no clear button shows. */
  clearLabel?: string;
  autoFocus?: boolean;
  className?: string;
  testId?: string;
}

export default function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearLabel,
  autoFocus,
  className,
  testId = "search-field",
}: SearchFieldProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        data-testid={testId}
        className="h-11 w-full rounded-md border border-border bg-background pl-3 pr-10 text-fg-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {clearLabel && value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          title={clearLabel}
          data-testid={`${testId}-clear`}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-fg-primary"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <Search
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
