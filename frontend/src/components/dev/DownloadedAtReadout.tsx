/**
 * DownloadedAtReadout — a Dev-Mode-only readout of a downloaded set's
 * ``downloaded_at`` timestamp (#1259 / #1211 follow-up, extended in
 * #1298).
 *
 * The diagnostic line a maintainer uses on-device to confirm that
 * ``downloaded_at`` actually reaches the surface that lists a
 * downloaded set — the field that drives the "most recently
 * downloaded first" ordering. #1259 first added it to the Learning
 * Path Persönlich list (``learning-path/SetRow``); #1298 extracts the
 * gate + format into this shared component so the "Meine Inhalte"
 * downloaded-set views (grid {@link ContentSetRow} + list
 * {@link ContentSetListView}) render it identically and the surfaces
 * cannot drift.
 *
 * Gated by {@link useDevMode}: renders nothing for normal users, so it
 * is safe to mount permanently. The strand default (#1271) means it is
 * ON by default in the Latest (staging) strand and OFF in Haupt
 * (production).
 *
 * @example
 * <DownloadedAtReadout
 *   downloadedAt={entry.downloaded_at}
 *   testId={`content-set-${entry.id}-downloaded-at`}
 * />
 */

import { useDevMode } from "../../hooks/settings/useDevMode";
import { cn } from "../../lib/utils";

export interface DownloadedAtReadoutProps {
  /** ISO-8601 download timestamp, or null/undefined when unknown (an
   *  old set cached before the field existed — renders ``null``, never
   *  crashes). */
  downloadedAt?: string | null;
  /** ``data-testid`` for the readout span. */
  testId: string;
  /** Extra classes merged onto the base font/colour tokens (e.g.
   *  ``block`` + padding to align with a list row). */
  className?: string;
}

/** The Dev-Mode-gated ``downloaded_at: <iso>`` diagnostic line. */
export default function DownloadedAtReadout({
  downloadedAt,
  testId,
  className,
}: DownloadedAtReadoutProps) {
  const devMode = useDevMode();
  if (!devMode) return null;
  return (
    <span
      className={cn("font-mono text-xs text-fg-muted", className)}
      data-testid={testId}
    >
      {"downloaded_at: "}
      {downloadedAt ?? "null"}
    </span>
  );
}
