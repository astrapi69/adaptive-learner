/**
 * Pure status classification for an AI provider's API key, shared by the
 * Settings AI-tab provider overview.
 *
 * A provider is in exactly one of four states, derived from whether a key
 * is stored, where the key is sourced from, the active storage mode, and
 * whether the provider can be reached browser-direct:
 *
 *   - ``desktop_only`` — the provider cannot be called from the browser
 *     (CORS-blocked) so it is only usable with the desktop / server app.
 *     Takes precedence in Dexie (browser) mode regardless of key state.
 *   - ``external`` — a key is present but managed outside the app
 *     (``env`` var or ``secrets.yaml``); the UI cannot edit it.
 *   - ``active`` — an app-managed key is stored and usable.
 *   - ``empty`` — no key configured anywhere.
 *
 * App-independent: takes plain values, imports only shared types.
 */

import type { ApiKeySource } from "../types/domain";
import type { StorageMode } from "../storage/types";
import type { AIProvider } from "./constants";

/** One of the four mutually-exclusive provider key states. */
export type ProviderKeyStatus = "active" | "empty" | "desktop_only" | "external";

/**
 * Providers that cannot be called browser-direct (CORS) and are therefore
 * usable only in server / desktop mode. Currently empty — every shipped
 * provider (Anthropic via the dangerous-direct-browser-access header,
 * OpenAI, Gemini) is reachable from the browser. Kept as the single
 * data-driven source so a future CORS-locked provider only needs a list
 * entry, not a logic change.
 */
export const CORS_BLOCKED_PROVIDERS: ReadonlySet<AIProvider> = new Set<AIProvider>();

/** Whether ``provider`` is reachable only from the desktop / server app. */
export function isDesktopOnlyProvider(provider: AIProvider): boolean {
  return CORS_BLOCKED_PROVIDERS.has(provider);
}

export interface ProviderKeyStatusInput {
  /** Whether a key is configured for this provider (``has_*_key``). */
  hasKey: boolean;
  /** Where the key is sourced from (``key_source_*``). */
  source: ApiKeySource;
  /** The active storage mode. */
  mode: StorageMode;
  /** Whether the provider is CORS-blocked browser-direct. */
  corsBlocked: boolean;
}

/**
 * Classify a provider's key state. See the module doc for the four states
 * and their precedence.
 */
export function providerKeyStatus({
  hasKey,
  source,
  mode,
  corsBlocked,
}: ProviderKeyStatusInput): ProviderKeyStatus {
  // A browser-unreachable provider is desktop-only in browser (Dexie) mode
  // no matter what key state it is in — using it there is impossible.
  if (mode === "dexie" && corsBlocked) return "desktop_only";
  if (!hasKey) return "empty";
  if (source === "env" || source === "secrets_yaml") return "external";
  return "active";
}
