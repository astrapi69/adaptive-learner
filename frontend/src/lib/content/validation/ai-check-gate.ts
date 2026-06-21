/**
 * Gating helper for the set-wide "Check with AI" trigger (EXP-033 / AIV-02).
 *
 * Extracted from ContentPage so the page stays under both the complexity
 * gate (one fewer nested ternary) and the 1000-line file-size gate (#689).
 */

type Translate = (key: string, fallback?: string) => string;

/**
 * Why the "Check with AI" trigger is disabled, or ``undefined`` when it is
 * available. The check is gated to Dexie mode (browser-direct provider
 * call; no server route) plus a configured API key.
 *
 * @param t - i18n translator (key + English fallback).
 * @param isDexie - whether the app runs in browser-storage (Dexie) mode.
 * @param hasKey - whether a provider API key is configured.
 * @returns A localized reason string, or ``undefined`` when enabled.
 */
export function resolveAiCheckDisabledReason(
  t: Translate,
  isDexie: boolean,
  hasKey: boolean,
): string | undefined {
  if (!isDexie) {
    return t("content.ai_check.unavailable_mode", "Available in browser-storage mode only.");
  }
  if (!hasKey) {
    return t("feature.api_key_required", "API key required. Configure a provider in Settings.");
  }
  return undefined;
}
