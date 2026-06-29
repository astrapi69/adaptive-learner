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

import type { AIProvider } from "../../constants";

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
 * Each model is owned by the FIRST (most specific) family it matches, so a
 * ``gpt-4o-mini`` variant can never be mis-claimed by the broader ``gpt-4o``
 * family — even when the api returns several dated mini variants (#928).
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
  // The most-specific family a model belongs to (first match in list order),
  // or -1 when it matches none. Families are ordered specific→broad, so
  // "gpt-4o-mini" claims its models before the broader "gpt-4o" is considered.
  const owningFamily = (id: string): number => {
    for (let i = 0; i < families.length; i++) {
      if (id.startsWith(families[i])) return i;
    }
    return -1;
  };
  const recommended: T[] = [];
  for (let i = 0; i < families.length; i++) {
    // Among the models OWNED by family i, prefer the newest variant
    // (lexically-largest id, e.g. "claude-sonnet-4-20250514" beats an older one).
    let best: T | null = null;
    for (const m of models) {
      if (owningFamily(m.id) !== i) continue;
      if (best === null || m.id > best.id) best = m;
    }
    if (best) recommended.push(best);
  }
  const recommendedIds = new Set(recommended.map((m) => m.id));
  const rest = models.filter((m) => !recommendedIds.has(m.id));
  if (recommended.length === 0 && models.length > 0) {
    return { recommended: models.slice(0, 3), rest: models.slice(3) };
  }
  return { recommended, rest };
}
