/**
 * Dexie / GitHub-Pages-mode AI content validation (EXP-033).
 *
 * Split out of ``content-loader-dexie.ts`` (cohesion / file-size gate,
 * #689): the browser-direct AI-validation concern — set-wide per-card
 * validation, the per-lesson share-flow validator, and the IndexedDB
 * cache for the validation report (AIV-04). The core content CRUD
 * (list / download / lessons / assets / user-sets) stays in the parent
 * module; this module depends on it only for the pure ``slugifySource``
 * key helper, so the dependency stays one-directional (no cycle).
 */

import type {
  AiValidateInput,
  AiValidateCardsInput,
  AiValidateCardsResult,
  AiValidationCacheRecord,
} from "../types";
import { getDb } from "../dexie/db";
import { aiComplete, aiCompleteWithMeta, resolveModel } from "../ai/ai-providers";
import type { AIProvider } from "../../lib/constants";
import {
  buildAiValidationMessages,
  parseAiValidationResult,
  type AiValidationResult,
} from "../../lib/content/validation/ai-content-validator";
import { runCardValidation } from "../../lib/ai/validation-runner";
import { slugifySource } from "./content-loader-dexie";

/** Dexie-mode AI validation: resolve the user's provider + key from
 *  IndexedDB settings, call the provider browser-direct, parse the
 *  structured review. Throws on missing key / unparseable response —
 *  the caller treats any throw as a non-fatal "AI unavailable". */
export async function aiValidateDexie(
  input: AiValidateInput,
): Promise<AiValidationResult> {
  const db = getDb();
  const settings = await db.userSettings
    .where("user_id")
    .equals(input.user_id)
    .first();
  if (!settings) throw new Error("No settings for user");
  const bag = settings as unknown as Record<string, unknown>;
  const provider = bag.active_provider as AIProvider | undefined;
  if (!provider) throw new Error("No active AI provider");
  const apiKey = bag[`api_key_${provider}`] as string | null;
  if (!apiKey) throw new Error(`No API key for ${provider}`);
  const override = bag[`model_override_${provider}`] as string | null;
  const model = resolveModel(provider, override);

  const messages = buildAiValidationMessages(
    {
      title: input.title,
      title_native: input.title_native,
      target_language: input.target_language,
      source_language: input.source_language,
      level: input.level,
    },
    input.lessons,
  );
  const raw = await aiComplete({
    provider,
    model,
    apiKey,
    messages,
    maxTokens: 1500,
  });
  const parsed = parseAiValidationResult(raw);
  if (!parsed) throw new Error("AI validation response was not valid JSON");
  return parsed;
}

/** Resolve the user's active provider + key + model from IndexedDB. Throws
 *  with a clear message on any missing piece (the caller gates the UI on a
 *  configured key, so a throw here is exceptional). */
async function resolveDexieAiConfig(
  userId: string,
): Promise<{ provider: AIProvider; model: string; apiKey: string }> {
  const db = getDb();
  const settings = await db.userSettings.where("user_id").equals(userId).first();
  if (!settings) throw new Error("No settings for user");
  const bag = settings as unknown as Record<string, unknown>;
  const provider = bag.active_provider as AIProvider | undefined;
  if (!provider) throw new Error("No active AI provider");
  const apiKey = bag[`api_key_${provider}`] as string | null;
  if (!apiKey) throw new Error(`No API key for ${provider}`);
  const override = bag[`model_override_${provider}`] as string | null;
  return { provider, model: resolveModel(provider, override), apiKey };
}

/** EXP-033 / AIV-02 — Dexie-mode set-wide per-card validation. Resolves the
 *  key from IndexedDB and runs the cards through the provider in batches of
 *  10, reporting per-batch progress. Browser-direct — no backend. */
export async function aiValidateCardsDexie(
  input: AiValidateCardsInput,
): Promise<AiValidateCardsResult> {
  const { provider, model, apiKey } = await resolveDexieAiConfig(input.user_id);
  const run = await runCardValidation({
    cards: input.cards,
    sourceLanguage: input.source_language,
    targetLanguage: input.target_language,
    level: input.level,
    onProgress: input.onProgress,
    signal: input.signal,
    complete: async (prompt, signal) => {
      const completion = await aiCompleteWithMeta({
        provider,
        model,
        apiKey,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 1500,
        signal,
      });
      return { text: completion.text, responseId: completion.responseId };
    },
  });
  return {
    results: run.results,
    response_ids: run.responseIds,
    provider,
    model,
    checked_cards: run.checkedCards,
    issue_count: run.issueCount,
  };
}

// ---------------------------------------------------------------------------
// EXP-033 / AIV-04 — cached AI content-check reports (IndexedDB)
// ---------------------------------------------------------------------------

function aiCacheId(source: string, setId: string): string {
  return `${slugifySource(source)}#${setId}`;
}

/** Read the cached report for a set, or null. */
export async function getAiValidationCacheDexie(
  source: string,
  setId: string,
): Promise<AiValidationCacheRecord | null> {
  const db = getDb();
  const row = await db.aiValidationResults.get(aiCacheId(source, setId));
  if (!row) return null;
  return {
    source: row.source,
    set_id: row.set_id,
    set_version: row.set_version,
    content_hash: row.content_hash,
    results: row.results,
    response_ids: row.response_ids,
    provider: row.provider,
    model: row.model,
    card_count: row.card_count,
    issue_count: row.issue_count,
    checked_at: row.checked_at,
    signature: row.signature ?? null,
  };
}

/** Persist (overwrite) the cached report for a set. */
export async function saveAiValidationCacheDexie(
  record: AiValidationCacheRecord,
): Promise<void> {
  const db = getDb();
  await db.aiValidationResults.put({
    id: aiCacheId(record.source, record.set_id),
    source: record.source,
    set_id: record.set_id,
    set_version: record.set_version,
    content_hash: record.content_hash,
    results: record.results,
    response_ids: record.response_ids,
    provider: record.provider,
    model: record.model,
    card_count: record.card_count,
    issue_count: record.issue_count,
    checked_at: record.checked_at,
    signature: record.signature ?? null,
  });
}
