/**
 * aiProviderLabel (#3812): a provider's name in running text comes from the
 * ``settings.provider_<id>`` label of the UI language, not from its id.
 */

import { describe, expect, it } from "vitest";

import { aiProviderLabel } from "./provider-label";

const LABELS: Record<string, string> = {
  "settings.provider_anthropic": "Anthropic Claude",
  "settings.provider_openai": "OpenAI GPT",
};

const t = (key: string, fallback?: string): string => LABELS[key] ?? fallback ?? key;

describe("aiProviderLabel", () => {
  it.each([
    ["anthropic", "Anthropic Claude"],
    ["openai", "OpenAI GPT"],
  ])("names %s by its settings label", (provider, label) => {
    expect(aiProviderLabel(t, provider)).toBe(label);
  });

  it("keeps the id of a provider that has no label", () => {
    expect(aiProviderLabel(t, "mistral")).toBe("mistral");
  });
});
