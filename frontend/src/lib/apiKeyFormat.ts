/**
 * Client-side API-key FORMAT validation (Phase 65 — instant feedback).
 *
 * Catches the two cheap-to-detect mistakes before a key is ever
 * saved or test-called: a typo'd / truncated key, and a key pasted
 * into the wrong provider's field (an OpenAI ``sk-...`` into the
 * Gemini row). This is a shape check only — it never proves the
 * key works; the "Test" button does that with a live call.
 *
 * Format rules (deliberately loose lower bounds — providers lengthen
 * their keys and change their prefixes over time, so we gate on a
 * conservative minimum length + an allowed character set, and only
 * require a positive prefix where the provider keeps it stable):
 *
 *   - Anthropic: ``sk-ant-`` prefix, >= 40 chars
 *   - OpenAI:    ``sk-`` prefix, >= 20 chars
 *   - Gemini:    NO prefix requirement, >= 20 chars (#781 — newer
 *     Google keys do not all start with ``AI``/``AIza``); a
 *     ``reject`` guard still rejects an Anthropic/OpenAI ``sk-`` key
 *     pasted into the Gemini field.
 *
 * If a key is the right shape but actually invalid, the user finds
 * out on the first AI call (the provider returns an auth error) —
 * that is the intended safety net, not this format gate.
 */

import type { AIProvider } from "./constants";

interface FormatRule {
  /** Required leading prefix, or ``null`` when the provider has no
   *  reliable one (so we never reject a valid key on prefix alone). */
  prefix: string | null;
  minLength: number;
  /** Prefixes that disqualify the key — used to catch a
   *  wrong-provider paste when there is no positive prefix to match. */
  reject?: string[];
}

const FORMAT_RULES: Record<AIProvider, FormatRule> = {
  anthropic: { prefix: "sk-ant-", minLength: 40 },
  openai: { prefix: "sk-", minLength: 20 },
  gemini: { prefix: null, minLength: 20, reject: ["sk-"] },
};

/** A real API key never contains whitespace; an internal space / tab /
 *  newline is the tell-tale of a corrupted copy-paste. We reject on
 *  whitespace ONLY and deliberately do NOT use a positive character
 *  allowlist: providers change their key alphabets over time (e.g. newer
 *  Google keys carry characters outside ``[A-Za-z0-9_-]``), and a positive
 *  allowlist silently rejects valid keys — the exact #793 regression. */
const KEY_WHITESPACE = /\s/;

/**
 * Short, human-readable hint per provider, used as the English
 * fallback for the inline ``settings.api_key.format_hint.*`` string.
 */
export const API_KEY_FORMAT_HINT: Record<AIProvider, string> = {
  anthropic: "Starts with sk-ant-",
  openai: "Starts with sk-",
  gemini: "At least 20 characters",
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
  if (trimmed.length < rule.minLength) return false;
  if (KEY_WHITESPACE.test(trimmed)) return false;
  if (rule.prefix !== null && !trimmed.startsWith(rule.prefix)) return false;
  if (rule.reject?.some((bad) => trimmed.startsWith(bad))) return false;
  return true;
}
