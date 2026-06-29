/**
 * EXP-033 / AIV-05 — cost estimation for a set-wide AI content check.
 *
 * Pure helper: given a card count + the provider/model the user has
 * configured, estimate the token volume and US-dollar cost so the UI can
 * show "~120 cards, ~24K tokens, ~$0.004. Check?" BEFORE any API call.
 *
 * Numbers are intentionally rough — the point is an order-of-magnitude
 * guard against an accidental large spend, not an invoice. ~200 tokens per
 * card (prompt + the card's JSON + the model's per-card reply) matches
 * EXP-033 §3.3.
 */

/** Rough prompt+reply token budget per card (EXP-033 §3.3). */
export const TOKENS_PER_CARD = 200;

/**
 * Per-model input price in USD per 1M tokens. Output is priced higher,
 * but the validation reply is short relative to the prompt, so a single
 * input-priced figure is a fair rough estimate. Unknown models fall back
 * to {@link DEFAULT_PRICE_PER_1M}.
 */
export const PRICE_PER_1M_USD: Record<string, number> = {
  // OpenAI
  "gpt-4o-mini": 0.15,
  "gpt-4o": 2.5,
  // Anthropic
  "claude-haiku-4-5-20251001": 1.0,
  "claude-3-5-haiku-latest": 0.8,
  "claude-sonnet-4-5": 3.0,
  // Gemini
  "gemini-2.0-flash": 0.1,
  "gemini-1.5-flash": 0.075,
};

/** Conservative fallback when the model isn't in the price table. */
export const DEFAULT_PRICE_PER_1M = 1.0;

export interface CostEstimate {
  cardCount: number;
  /** Estimated total tokens (prompt + reply across all batches). */
  estimatedTokens: number;
  /** Estimated cost in USD, rounded to 4 decimals. */
  estimatedUsd: number;
  /** "~24K" style compact token label for display. */
  tokensLabel: string;
  /** "$0.0040" style display string. */
  usdLabel: string;
  provider: string;
  model: string;
}

/** Look up the per-1M USD price for a model, falling back conservatively. */
export function pricePer1M(model: string): number {
  return PRICE_PER_1M_USD[model] ?? DEFAULT_PRICE_PER_1M;
}

/** Format a token count compactly: 24000 → "24K", 900 → "900". */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    const k = tokens / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${rounded}K`;
  }
  return String(tokens);
}

/**
 * Estimate the cost of validating ``cardCount`` cards with ``model``.
 */
export function estimateValidationCost(
  cardCount: number,
  provider: string,
  model: string,
): CostEstimate {
  const safeCount = Math.max(0, Math.floor(cardCount));
  const estimatedTokens = safeCount * TOKENS_PER_CARD;
  const price = pricePer1M(model);
  const rawUsd = (estimatedTokens / 1_000_000) * price;
  const estimatedUsd = Math.round(rawUsd * 10000) / 10000;
  return {
    cardCount: safeCount,
    estimatedTokens,
    estimatedUsd,
    tokensLabel: formatTokens(estimatedTokens),
    usdLabel: `$${estimatedUsd.toFixed(4)}`,
    provider,
    model,
  };
}
