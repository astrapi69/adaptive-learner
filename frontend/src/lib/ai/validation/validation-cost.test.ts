import { describe, it, expect } from "vitest";

import {
  estimateValidationCost,
  formatTokens,
  pricePer1M,
  TOKENS_PER_CARD,
  DEFAULT_PRICE_PER_1M,
} from "./validation-cost";

describe("estimateValidationCost", () => {
  it("estimates tokens at ~200 per card", () => {
    const est = estimateValidationCost(120, "openai", "gpt-4o-mini");
    expect(est.estimatedTokens).toBe(120 * TOKENS_PER_CARD);
    expect(est.cardCount).toBe(120);
  });

  it("prices gpt-4o-mini correctly (~$0.0036 for 120 cards)", () => {
    const est = estimateValidationCost(120, "openai", "gpt-4o-mini");
    // 24000 tokens * 0.15 / 1e6 = 0.0036
    expect(est.estimatedUsd).toBeCloseTo(0.0036, 4);
    expect(est.usdLabel).toBe("$0.0036");
  });

  it("falls back to the default price for an unknown model", () => {
    const est = estimateValidationCost(1000, "openai", "some-future-model");
    expect(pricePer1M("some-future-model")).toBe(DEFAULT_PRICE_PER_1M);
    // 200000 tokens * 1.0 / 1e6 = 0.2
    expect(est.estimatedUsd).toBeCloseTo(0.2, 4);
  });

  it("clamps a negative card count to zero", () => {
    const est = estimateValidationCost(-5, "openai", "gpt-4o-mini");
    expect(est.cardCount).toBe(0);
    expect(est.estimatedTokens).toBe(0);
    expect(est.estimatedUsd).toBe(0);
  });

  it("carries the provider + model through", () => {
    const est = estimateValidationCost(10, "anthropic", "claude-haiku-4-5-20251001");
    expect(est.provider).toBe("anthropic");
    expect(est.model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("formatTokens", () => {
  it("formats thousands compactly", () => {
    expect(formatTokens(24000)).toBe("24K");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(900)).toBe("900");
  });
});
