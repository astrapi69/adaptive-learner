import { describe, it, expect } from "vitest";

import {
  buildSignature,
  verifySignature,
  badgeStatusForCachedSet,
  isCompleteSignature,
  responseIdMatchesProvider,
  CHECKER_VERSION,
  type AiValidationSignature,
} from "./validation-signature";

function sig(over: Partial<AiValidationSignature> = {}): AiValidationSignature {
  return {
    content_hash: "sha256:abc",
    result: "passed",
    checked_cards: 10,
    issues_found: 0,
    provider: "openai/gpt-4o-mini",
    response_id: "chatcmpl-xyz",
    timestamp: "2026-06-17T12:00:00.000Z",
    checker_version: CHECKER_VERSION,
    ...over,
  };
}

const NOW = new Date("2026-06-17T13:00:00.000Z");

describe("buildSignature", () => {
  it("marks result passed when no issues", () => {
    const s = buildSignature({
      contentHash: "sha256:h",
      checkedCards: 5,
      issuesFound: 0,
      provider: "openai",
      model: "gpt-4o-mini",
      responseId: "chatcmpl-1",
    });
    expect(s.result).toBe("passed");
    expect(s.provider).toBe("openai/gpt-4o-mini");
    expect(s.checker_version).toBe(CHECKER_VERSION);
  });

  it("marks result review_needed when issues were found", () => {
    const s = buildSignature({
      contentHash: "sha256:h",
      checkedCards: 5,
      issuesFound: 2,
      provider: "anthropic",
      model: "claude",
      responseId: "msg_1",
    });
    expect(s.result).toBe("review_needed");
  });
});

describe("responseIdMatchesProvider", () => {
  it("checks OpenAI / Anthropic prefixes", () => {
    expect(responseIdMatchesProvider("openai/x", "chatcmpl-1")).toBe(true);
    expect(responseIdMatchesProvider("openai/x", "msg_1")).toBe(false);
    expect(responseIdMatchesProvider("anthropic/x", "msg_1")).toBe(true);
    expect(responseIdMatchesProvider("gemini/x", "anything")).toBe(true);
    expect(responseIdMatchesProvider("openai/x", "")).toBe(false);
  });
});

describe("verifySignature", () => {
  it("returns none for a missing signature", () => {
    expect(verifySignature(null, "sha256:abc", NOW)).toBe("none");
  });

  it("returns verified when the hash matches and fields are valid", () => {
    expect(verifySignature(sig(), "sha256:abc", NOW)).toBe("verified");
  });

  it("returns stale when the content hash differs (content changed)", () => {
    expect(verifySignature(sig(), "sha256:DIFFERENT", NOW)).toBe("stale");
  });

  it("returns invalid for incomplete fields", () => {
    expect(verifySignature(sig({ response_id: "" }), "sha256:abc", NOW)).toBe(
      "invalid",
    );
  });

  it("returns invalid for a future timestamp", () => {
    expect(
      verifySignature(sig({ timestamp: "2099-01-01T00:00:00.000Z" }), "sha256:abc", NOW),
    ).toBe("invalid");
  });

  it("returns invalid when the response id doesn't match the provider", () => {
    expect(
      verifySignature(sig({ response_id: "msg_wrong" }), "sha256:abc", NOW),
    ).toBe("invalid");
  });
});

describe("badgeStatusForCachedSet", () => {
  it("none when no signature", () => {
    expect(badgeStatusForCachedSet(null, "1", "1")).toBe("none");
  });
  it("verified when versions match", () => {
    expect(badgeStatusForCachedSet(sig(), "1", "1")).toBe("verified");
  });
  it("stale when the set version changed since the check", () => {
    expect(badgeStatusForCachedSet(sig(), "1", "2")).toBe("stale");
  });
  it("invalid for a malformed signature", () => {
    expect(
      badgeStatusForCachedSet({ ...sig(), response_id: "" }, "1", "1"),
    ).toBe("invalid");
  });
});

describe("isCompleteSignature", () => {
  it("rejects non-objects and partial shapes", () => {
    expect(isCompleteSignature(null)).toBe(false);
    expect(isCompleteSignature({})).toBe(false);
    expect(isCompleteSignature(sig())).toBe(true);
  });
});
