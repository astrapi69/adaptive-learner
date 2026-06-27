/**
 * Tests for checkedWithLine (#940): "Checked with: <provider> (<model>)",
 * tolerant of a missing model and empty when no provider is known.
 */

import { describe, expect, it } from "vitest";

import { checkedWithLine } from "./validation-provenance";

describe("checkedWithLine", () => {
  it("composes prefix, provider, and model", () => {
    expect(
      checkedWithLine({
        prefix: "Geprüft mit",
        providerLabel: "Anthropic Claude",
        model: "claude-haiku-4-5-20251001",
      }),
    ).toBe("Geprüft mit: Anthropic Claude (claude-haiku-4-5-20251001)");
  });

  it("omits the parentheses when the model is empty", () => {
    expect(
      checkedWithLine({
        prefix: "Checked with",
        providerLabel: "OpenAI GPT",
        model: "",
      }),
    ).toBe("Checked with: OpenAI GPT");
  });

  it("returns empty string when the provider is unknown", () => {
    expect(
      checkedWithLine({ prefix: "Checked with", providerLabel: "", model: "gpt-4o" }),
    ).toBe("");
  });
});
