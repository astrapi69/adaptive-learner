import { describe, it, expect } from "vitest";

import { isValidApiKeyFormat, API_KEY_PREFIX } from "./apiKeyFormat";

describe("isValidApiKeyFormat", () => {
  it("accepts a well-formed Anthropic key", () => {
    expect(isValidApiKeyFormat("anthropic", "sk-ant-" + "a".repeat(90))).toBe(
      true,
    );
  });

  it("rejects an Anthropic key without the sk-ant- prefix", () => {
    expect(isValidApiKeyFormat("anthropic", "sk-" + "a".repeat(90))).toBe(
      false,
    );
  });

  it("rejects a too-short Anthropic key", () => {
    expect(isValidApiKeyFormat("anthropic", "sk-ant-short")).toBe(false);
  });

  it("accepts a well-formed OpenAI key and rejects a short one", () => {
    expect(isValidApiKeyFormat("openai", "sk-" + "a".repeat(45))).toBe(true);
    expect(isValidApiKeyFormat("openai", "sk-short")).toBe(false);
  });

  it("accepts a well-formed Gemini key and rejects a wrong prefix", () => {
    expect(isValidApiKeyFormat("gemini", "AI" + "a".repeat(35))).toBe(true);
    expect(isValidApiKeyFormat("gemini", "BB" + "a".repeat(35))).toBe(false);
  });

  it("treats empty / whitespace as invalid", () => {
    expect(isValidApiKeyFormat("anthropic", "")).toBe(false);
    expect(isValidApiKeyFormat("openai", "   ")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(
      isValidApiKeyFormat("anthropic", "  sk-ant-" + "a".repeat(90) + "\n"),
    ).toBe(true);
  });

  it("catches a wrong-provider paste (OpenAI key in the Gemini field)", () => {
    expect(isValidApiKeyFormat("gemini", "sk-" + "a".repeat(45))).toBe(false);
  });

  it("exposes the expected prefix per provider", () => {
    expect(API_KEY_PREFIX.anthropic).toBe("sk-ant-");
    expect(API_KEY_PREFIX.openai).toBe("sk-");
    expect(API_KEY_PREFIX.gemini).toBe("AI");
  });
});
