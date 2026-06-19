/**
 * Masked text input for secrets (API keys, access tokens) that must NOT
 * trigger the browser password manager / autofill.
 *
 * Why not ``type="password"``: a password input invites the browser's
 * credential-autofill dropdown (Chrome built-in, 1Password, LastPass,
 * Bitwarden, Dashlane). That is wrong for API keys and tokens — they are
 * not login passwords. This renders a plain ``type="text"`` input,
 * suppresses every known password-manager heuristic (``autocomplete`` plus
 * the per-manager opt-out data attributes), turns off autocorrect /
 * autocapitalize / spellcheck, and provides its own show/hide toggle.
 *
 * Masking uses the ``-webkit-text-security`` CSS property (Chromium +
 * WebKit) so the value still reads as dots while hidden; the reveal toggle
 * flips it to plain text and works in every browser.
 *
 * Props-driven and app-independent (no app-state imports) — reuse it
 * anywhere a secret is entered. All native ``<input>`` props are forwarded;
 * ``type`` is fixed to ``text`` and cannot be overridden.
 *
 * @example
 * <SecretInput
 *   value={token}
 *   onChange={(e) => setToken(e.target.value)}
 *   placeholder="ghp_…"
 *   data-testid="github-token"
 *   aria-label="GitHub token"
 * />
 */

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "../../hooks/useI18n";

/**
 * Attributes that opt the field out of every common password manager's
 * autofill detection. Applied after the caller's props so they always win.
 */
const AUTOFILL_OPT_OUT = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": "", // 1Password
  "data-lpignore": "true", // LastPass
  "data-bwignore": "true", // Bitwarden
  "data-form-type": "other", // Dashlane
} as const;

export interface SecretInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Extra classes for the positioned wrapper around input + toggle. */
  wrapperClassName?: string;
}

/** A ``type="text"`` secret field with autofill suppressed and a reveal toggle. */
export const SecretInput = React.forwardRef<HTMLInputElement, SecretInputProps>(
  ({ className, wrapperClassName, disabled, ...props }, ref) => {
    const { t } = useI18n();
    const [revealed, setRevealed] = React.useState(false);
    const toggleLabel = revealed
      ? t("ui.hide_secret", "Hide value")
      : t("ui.show_secret", "Show value");

    return (
      <span
        className={cn("relative flex w-full items-center", wrapperClassName)}
      >
        <Input
          ref={ref}
          type="text"
          disabled={disabled}
          className={cn(
            "pr-11",
            !revealed && "[-webkit-text-security:disc]",
            className,
          )}
          {...props}
          {...AUTOFILL_OPT_OUT}
        />
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          disabled={disabled}
          aria-label={toggleLabel}
          aria-pressed={revealed}
          title={toggleLabel}
          tabIndex={-1}
          className={cn(
            "absolute right-2 flex h-7 w-7 items-center justify-center rounded",
            "text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </span>
    );
  },
);
SecretInput.displayName = "SecretInput";
