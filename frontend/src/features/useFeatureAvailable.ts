/**
 * useFeatureAvailable — thin wrapper over the feature-strategy ``useFeature``
 * that turns a gated feature into the three things a button needs (#911):
 *
 *   - ``available`` — whether the action may run (the feature is ``active``).
 *   - ``reason``    — the machine reason code when not available
 *                     (``api_key_required`` / ``desktop_only`` / …).
 *   - ``tooltip``   — the localized, user-facing reason, ready to drop onto a
 *                     disabled button's ``title``.
 *
 * The point is a one-liner at every call site so the feature-state policy
 * (#335 — never a silently-broken button) is applied consistently:
 *
 * @example
 * const anki = useFeatureAvailable(FEATURES.ANKI_EXTRACT);
 * <Button disabled={!anki.available} title={anki.tooltip} onClick={anki.available ? run : undefined}>
 *   Extract
 * </Button>
 */

import { useFeature } from "@astrapi69/feature-strategy-react";

import type { FeatureId } from "./featureConfig";
import { useI18n } from "../hooks/ui/useI18n";

export interface FeatureAvailability {
  /** True when the feature is active (the action may run). */
  available: boolean;
  /** Machine reason code when not available, else ``undefined``. */
  reason?: string;
  /** Localized reason for a disabled button's ``title``, else ``undefined``. */
  tooltip?: string;
}

/** Default English copy per known reason code, used as the i18n fallback. */
const REASON_FALLBACK: Record<string, string> = {
  api_key_required: "API key required. Configure a provider in Settings.",
  desktop_only: "Only available with the desktop app.",
  network_required: "Network connection required.",
};

export function useFeatureAvailable(featureId: FeatureId): FeatureAvailability {
  const feature = useFeature(featureId);
  const { t } = useI18n();
  if (feature.isActive) return { available: true };
  const reason = feature.reason;
  const tooltip = reason
    ? t(`feature.${reason}`, REASON_FALLBACK[reason] ?? undefined)
    : undefined;
  return { available: false, reason, tooltip };
}
