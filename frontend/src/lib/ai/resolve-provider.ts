/**
 * Resolve the active AI provider's config for browser-direct calls.
 *
 * Shared by the import-analysis "Generate exercises" button (AIX-02) and
 * the set-level batch (AIX-06) so the provider/model/key resolution lives
 * in one place. Mirrors the existing analyze flow: the active provider
 * comes from the user's settings and the key from the IndexedDB
 * ``userSettings`` row (the browser-direct key store).
 */

import { getStorage } from "../../storage";
import { getDb } from "../../storage/dexie/db";
import { resolveModel } from "../../storage/ai/ai-providers";
import type { AIProvider } from "../constants";

/** Provider config for a browser-direct completion. */
export interface ResolvedAiProvider {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/** Read the stored key for ``provider`` from the Dexie settings row. */
async function readApiKeyFor(
  userId: string,
  provider: AIProvider,
): Promise<string | null> {
  try {
    const row = await getDb().userSettings.where("user_id").equals(userId).first();
    if (!row) return null;
    if (provider === "anthropic") return row.api_key_anthropic ?? null;
    if (provider === "openai") return row.api_key_openai ?? null;
    if (provider === "gemini") return row.api_key_gemini ?? null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the active provider config for a user, or ``null`` when no key
 * is configured (the caller then shows the "API key required" surface).
 *
 * @param userId - The active user id.
 */
export async function resolveActiveAiProvider(
  userId: string,
): Promise<ResolvedAiProvider | null> {
  const settings = await getStorage().settings.get(userId);
  const provider = settings.active_provider as AIProvider;
  const apiKey = await readApiKeyFor(userId, provider);
  if (!apiKey) return null;
  const override =
    provider === "anthropic"
      ? settings.model_override_anthropic
      : provider === "openai"
        ? settings.model_override_openai
        : settings.model_override_gemini;
  return { provider, model: resolveModel(provider, override ?? null), apiKey };
}
