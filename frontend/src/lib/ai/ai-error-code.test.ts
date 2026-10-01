/**
 * Tutor AI error classes and their localized messages (#3376).
 */

import { describe, expect, it } from "vitest";

import { aiErrorCodeForStatus, aiErrorMessage } from "./ai-error-code";

const t = (key: string, _fallback: string) => key;

describe("aiErrorCodeForStatus", () => {
  it.each([
    [401, "provider_auth"],
    [403, "provider_auth"],
    [429, "provider_rate_limited"],
    [0, "provider_unavailable"],
    [500, "provider_unavailable"],
    [503, "provider_unavailable"],
    [400, "provider_error"],
    [404, "provider_error"],
  ])("maps status %i to %s", (status, code) => {
    expect(aiErrorCodeForStatus(status)).toBe(code);
  });
});

describe("aiErrorMessage", () => {
  it.each([
    ["no_api_key", "session.no_api_key"],
    ["no_provider", "session.no_api_key"],
    ["no_model", "session.ai_error_no_model"],
    ["provider_auth", "session.ai_error_provider_auth"],
    ["provider_rate_limited", "session.ai_error_rate_limited"],
    ["provider_unavailable", "session.ai_error_provider_unavailable"],
    ["provider_error", "session.ai_error"],
  ])("maps %s to %s", (code, key) => {
    expect(aiErrorMessage(t, code)).toBe(key);
  });

  it.each([
    ["an unknown code", "something_new"],
    ["no code", null],
  ])("falls back to the generic message for %s", (_name, code) => {
    expect(aiErrorMessage(t, code)).toBe("session.ai_error");
  });
});
