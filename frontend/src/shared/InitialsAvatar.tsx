/**
 * InitialsAvatar — a circular avatar showing a person's initials, the
 * generated fallback when no profile picture is set (#508).
 *
 * Fully presentational and app-agnostic: it derives 1–2 uppercase
 * initials from the supplied ``name`` (or shows ``?`` when empty), sizes
 * itself from the ``size`` prop, and colours itself from token-backed
 * Tailwind classes you can override via ``className`` — no hardcoded
 * colour, no app imports. Reuse it anywhere an identity needs a compact
 * stand-in: a nav bar, a settings panel, a comment row, a leaderboard.
 *
 * @example
 * // Small header avatar (default primary colour)
 * <InitialsAvatar name="Asterios Raptis" size={28} testId="nav-avatar" />
 *
 * @example
 * // Large settings avatar with a custom token-backed colour
 * <InitialsAvatar
 *   name="Jane Doe"
 *   size={96}
 *   className="bg-secondary text-secondary-foreground"
 * />
 */

import { cn } from "@/lib/utils";

export interface InitialsAvatarProps {
  /** Display name; the first letters of its first two words are shown. */
  name: string;
  /** Diameter in pixels. Defaults to 32. */
  size?: number;
  /** Token-backed colour classes; defaults to the primary pair. */
  className?: string;
  /** Accessible name. Defaults to ``name`` (or a generic label). */
  ariaLabel?: string;
  testId?: string;
}

/** First letters of up to the first two words, uppercased. */
export function initialsOf(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.slice(0, 2).map((w) => w[0]);
  return letters.join("").toUpperCase();
}

export default function InitialsAvatar({
  name,
  size = 32,
  className,
  ariaLabel,
  testId,
}: InitialsAvatarProps) {
  const initials = initialsOf(name);
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? name ?? "avatar"}
      data-testid={testId}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none",
        "bg-primary text-primary-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}
