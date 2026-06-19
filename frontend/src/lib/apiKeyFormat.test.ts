import { describe, it, expect } from "vitest";

import { isValidApiKeyFormat, API_KEY_FORMAT_HINT } from "./apiKeyFormat";

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

  it("accepts a classic AIza-prefixed Gemini key", () => {
    expect(isValidApiKeyFormat("gemini", "AIza" + "a".repeat(35))).toBe(true);
  });

  it("accepts a valid Gemini key WITHOUT the AI prefix (#781)", () => {
    // Newer Google keys do not all start with AI/AIza — these must
    // not be rejected on prefix.
    expect(isValidApiKeyFormat("gemini", "BB" + "a".repeat(35))).toBe(true);
    expect(isValidApiKeyFormat("gemini", "x9_-" + "Z".repeat(30))).toBe(true);
  });

  it("rejects a too-short Gemini key", () => {
    expect(isValidApiKeyFormat("gemini", "abc")).toBe(false);
  });

  it("rejects a key with internal whitespace (corrupted paste)", () => {
    expect(isValidApiKeyFormat("gemini", "key with spaces " + "a".repeat(30))).toBe(
      false,
    );
    expect(
      isValidApiKeyFormat("openai", "sk-" + "a".repeat(20) + "\t" + "b".repeat(10)),
    ).toBe(false);
  });

  it("accepts a key with characters outside [A-Za-z0-9_-] (#793)", () => {
    // Newer Google keys carry characters (e.g. ".") that a positive
    // charset allowlist falsely rejected, blocking a valid key from being
    // saved. Only whitespace is disqualifying now.
    expect(isValidApiKeyFormat("gemini", "AIzaSy.AB-cd_0123456789xyz")).toBe(true);
    expect(isValidApiKeyFormat("openai", "sk-proj.ABCdef0123456789xyz")).toBe(true);
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

  it("exposes a format hint per provider (Gemini is length-based, #781)", () => {
    expect(API_KEY_FORMAT_HINT.anthropic).toMatch(/sk-ant-/);
    expect(API_KEY_FORMAT_HINT.openai).toMatch(/sk-/);
    expect(API_KEY_FORMAT_HINT.gemini).not.toMatch(/AI/);
  });
});
