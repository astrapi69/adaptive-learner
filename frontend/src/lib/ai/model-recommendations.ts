/**
 * model-recommendations — the curated "recommended models" list per provider
 * and the pure partition that drives the {@link ModelPicker} grouping (#917).
 *
 * The picker fetches the provider's live ``/models`` list, but that list comes
 * back in the provider's own order — sensible for Gemini, arbitrary for Claude
 * and OpenAI (dozens of legacy / embedding / image ids). Taking "the first 3"
 * therefore surfaced random models. Instead, a small static list of recommended
 * model FAMILIES (matched as id prefixes, newest-dated variant wins) pulls the
 * same 2-3 good models to the top for EVERY provider, so all three share the
 * "Recommended" + "All models" UX.
 *
 * Prefixes (not exact ids) on purpose: provider apis return dated variants
 * (``claude-sonnet-4-20250514``, ``gpt-4o-mini-2024-07-18``) and we want the
 * family to match regardless of the date suffix.
 */

import type { AIProvider } from "../constants";

/**
 * Recommended model families per provider, most-recommended first. Matched as
 * id prefixes against the live model list. Order matters: more specific
 * prefixes (``gpt-4o-mini``) must precede the families they are a prefix of
 * (``gpt-4o``) so each model is claimed by its most specific family.
 */
export const RECOMMENDED_MODELS: Record<AIProvider, readonly string[]> = {
  anthropic: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-4-5"],
  openai: ["gpt-4o-mini", "gpt-4o", "o3-mini"],
  gemini: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
};

/** Minimal shape the partition needs from a model entry. */
export interface ModelLike {
  id: string;
}

export interface PartitionedModels<T extends ModelLike> {
  /** Up to one model per recommended family, in the curated order. */
  recommended: T[];
  /** Everything else, in the provider's original order. */
  rest: T[];
}

/**
 * Split a provider's model list into a curated "recommended" group (one model
 * per {@link RECOMMENDED_MODELS} family, newest match per family) and the rest.
 *
 * Falls back to the original "first 3" heuristic when NO model matches any
 * recommended family (an unexpected provider id scheme), so the Recommended
 * group is never empty when models exist.
 */
export function partitionModels<T extends ModelLike>(
  provider: AIProvider,
  models: readonly T[],
): PartitionedModels<T> {
  const families = RECOMMENDED_MODELS[provider] ?? [];
  const recommended: T[] = [];
  const claimed = new Set<string>();
  for (const family of families) {
    // Prefer the newest dated variant of the family (lexically-largest id),
    // so "claude-sonnet-4-20250514" beats an older "claude-sonnet-4-...".
    let best: T | null = null;
    for (const m of models) {
      if (claimed.has(m.id) || !m.id.startsWith(family)) continue;
      if (best === null || m.id > best.id) best = m;
    }
    if (best) {
      recommended.push(best);
      claimed.add(best.id);
    }
  }
  const rest = models.filter((m) => !claimed.has(m.id));
  if (recommended.length === 0 && models.length > 0) {
    return { recommended: models.slice(0, 3), rest: models.slice(3) };
  }
  return { recommended, rest };
}
