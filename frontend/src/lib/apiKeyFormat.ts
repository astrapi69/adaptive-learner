/**
 * Client-side API-key FORMAT validation (Phase 65 — instant feedback).
 *
 * Catches the two cheap-to-detect mistakes before a key is ever
 * saved or test-called: a typo'd / truncated key, and a key pasted
 * into the wrong provider's field (an OpenAI ``sk-...`` into the
 * Anthropic row). This is a shape check only — it never proves the
 * key works; the "Test" button does that with a live call.
 *
 * Format rules (deliberately loose lower bounds — providers lengthen
 * their keys over time, so we gate on prefix + a conservative
 * minimum length, never an exact length):
 *
 *   - Anthropic: ``sk-ant-`` prefix, >= 90 chars
 *   - OpenAI:    ``sk-`` prefix, >= 40 chars
 *   - Gemini:    ``AI`` prefix, >= 30 chars
 */

import type { AIProvider } from "./constants";

interface FormatRule {
  prefix: string;
  minLength: number;
}

const FORMAT_RULES: Record<AIProvider, FormatRule> = {
  anthropic: { prefix: "sk-ant-", minLength: 90 },
  openai: { prefix: "sk-", minLength: 40 },
  gemini: { prefix: "AI", minLength: 30 },
};

/** The expected prefix per provider, for the inline format hint. */
export const API_KEY_PREFIX: Record<AIProvider, string> = {
  anthropic: "sk-ant-",
  openai: "sk-",
  gemini: "AI",
};

/**
 * True when ``key`` has the right shape for ``provider``. Whitespace
 * is trimmed first (a trailing newline from a copy-paste is common
 * and harmless). An empty string is NOT valid — callers treat empty
 * as "nothing entered yet" and show no error.
 */
export function isValidApiKeyFormat(
  provider: AIProvider,
  key: string,
): boolean {
  const trimmed = key.trim();
  if (trimmed.length === 0) return false;
  const rule = FORMAT_RULES[provider];
  return trimmed.startsWith(rule.prefix) && trimmed.length >= rule.minLength;
}
