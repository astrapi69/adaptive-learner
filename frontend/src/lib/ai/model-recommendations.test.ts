/**
 * Tests for the curated model partition (#917): recommended families pulled to
 * the top, one model per family (newest dated variant), rest preserved; with a
 * first-3 fallback when nothing matches.
 */

import { describe, expect, it } from "vitest";

import { partitionModels, RECOMMENDED_MODELS } from "./model-recommendations";

const ids = <T extends { id: string }>(xs: T[]) => xs.map((x) => x.id);
const models = (...list: string[]) => list.map((id) => ({ id }));

describe("partitionModels — anthropic", () => {
  it("pulls sonnet/opus/haiku families to the top in curated order", () => {
    const { recommended, rest } = partitionModels(
      "anthropic",
      models(
        "claude-3-5-haiku-latest",
        "claude-opus-4-20250101",
        "claude-sonnet-4-20250514",
        "claude-haiku-4-5-20251001",
        "claude-2.1",
      ),
    );
    expect(ids(recommended)).toEqual([
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250101",
      "claude-haiku-4-5-20251001",
    ]);
    // Legacy models drop to the rest group.
    expect(ids(rest)).toEqual(["claude-3-5-haiku-latest", "claude-2.1"]);
  });

  it("picks the newest dated variant per family", () => {
    const { recommended } = partitionModels(
      "anthropic",
      models("claude-sonnet-4-20250101", "claude-sonnet-4-20250514"),
    );
    expect(ids(recommended)).toEqual(["claude-sonnet-4-20250514"]);
  });
});

describe("partitionModels — openai", () => {
  it("claims gpt-4o-mini before gpt-4o (specific prefix first)", () => {
    const { recommended, rest } = partitionModels(
      "openai",
      models(
        "gpt-4o-2024-08-06",
        "gpt-4o-mini-2024-07-18",
        "o3-mini",
        "gpt-3.5-turbo",
        "dall-e-3",
      ),
    );
    expect(ids(recommended)).toEqual([
      "gpt-4o-mini-2024-07-18",
      "gpt-4o-2024-08-06",
      "o3-mini",
    ]);
    expect(ids(rest)).toEqual(["gpt-3.5-turbo", "dall-e-3"]);
  });
});

describe("partitionModels — fallback", () => {
  it("falls back to the first 3 when no family matches", () => {
    const { recommended, rest } = partitionModels(
      "gemini",
      models("mystery-a", "mystery-b", "mystery-c", "mystery-d"),
    );
    expect(ids(recommended)).toEqual(["mystery-a", "mystery-b", "mystery-c"]);
    expect(ids(rest)).toEqual(["mystery-d"]);
  });

  it("returns empty groups for an empty list", () => {
    expect(partitionModels("openai", [])).toEqual({ recommended: [], rest: [] });
  });
});

describe("RECOMMENDED_MODELS", () => {
  it("covers all three providers with non-empty families", () => {
    for (const provider of ["anthropic", "openai", "gemini"] as const) {
      expect(RECOMMENDED_MODELS[provider].length).toBeGreaterThan(0);
    }
  });
});
