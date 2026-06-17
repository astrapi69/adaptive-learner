/**
 * AiCheckedBadge — a small "AI-checked" status pill (EXP-033 / AIV-11).
 *
 * App-agnostic + props-driven: the status drives the colour/icon, every
 * label is supplied by the caller (no i18n import), token-backed Tailwind
 * only. Renders nothing for "none" so a never-checked set shows no badge.
 *
 * @example
 * <AiCheckedBadge
 *   status="verified"
 *   verifiedLabel="AI-checked"
 *   staleLabel="AI-check outdated"
 *   invalidLabel="AI-check invalid"
 *   testId="ai-badge-es-a1"
 * />
 */

import { AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";

export type AiCheckBadgeStatus = "verified" | "stale" | "invalid" | "none";

export interface AiCheckedBadgeProps {
  status: AiCheckBadgeStatus;
  /** Label + tooltip for a valid, current signature. */
  verifiedLabel: string;
  /** Label + tooltip when the content changed since the check. */
  staleLabel: string;
  /** Label + tooltip when the signature is malformed. */
  invalidLabel: string;
  testId?: string;
}

/** "AI-checked" status pill; nothing for an unchecked set. */
export default function AiCheckedBadge({
  status,
  verifiedLabel,
  staleLabel,
  invalidLabel,
  testId,
}: AiCheckedBadgeProps) {
  if (status === "none") return null;

  const config =
    status === "verified"
      ? { label: verifiedLabel, className: "text-success", Icon: Sparkles }
      : status === "stale"
        ? { label: staleLabel, className: "text-warning", Icon: AlertTriangle }
        : { label: invalidLabel, className: "text-error", Icon: ShieldAlert };

  const { label, className, Icon } = config;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}
      title={label}
      data-testid={testId}
      data-status={status}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
