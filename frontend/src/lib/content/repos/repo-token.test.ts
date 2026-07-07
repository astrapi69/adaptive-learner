/**
 * Tests for the per-repo token store (EXP-023 Phase B). Tokens live in
 * localStorage, one entry per source, falling back to the shared token.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRepoToken,
  hasRepoToken,
  resolveRepoToken,
  writeRepoToken,
} from "./repo-token";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

describe("per-repo token store", () => {
  it("writes, reports presence, and clears a per-repo token", () => {
    expect(hasRepoToken("jane/a")).toBe(false);
    writeRepoToken("jane/a", "ghp_secret");
    expect(hasRepoToken("jane/a")).toBe(true);
    expect(resolveRepoToken("jane/a")).toBe("ghp_secret");
    clearRepoToken("jane/a");
    expect(hasRepoToken("jane/a")).toBe(false);
  });

  it("a blank write clears the entry", () => {
    writeRepoToken("jane/a", "x");
    writeRepoToken("jane/a", "   ");
    expect(hasRepoToken("jane/a")).toBe(false);
  });

  it("falls back to the shared github token when no per-repo token", () => {
    store.set("adaptive-learner.github_token", "shared");
    expect(resolveRepoToken("jane/a")).toBe("shared");
    writeRepoToken("jane/a", "specific");
    expect(resolveRepoToken("jane/a")).toBe("specific");
  });

  it("isolates tokens per source", () => {
    writeRepoToken("jane/a", "ta");
    writeRepoToken("bob/b", "tb");
    expect(resolveRepoToken("jane/a")).toBe("ta");
    expect(resolveRepoToken("bob/b")).toBe("tb");
  });
});

describe("official/public source never resolves the shared PAT (#1429)", () => {
  it("resolves empty for the official repo even with a shared token set", () => {
    store.set("adaptive-learner.github_token", "shared");
    expect(resolveRepoToken("astrapi69/adaptive-learner-content")).toBe("");
  });

  it("resolves empty for a bundled source even with a shared token set", () => {
    store.set("adaptive-learner.github_token", "shared");
    expect(resolveRepoToken("bundled:fr-a1")).toBe("");
  });

  it("still applies the shared token to a genuine user repo", () => {
    store.set("adaptive-learner.github_token", "shared");
    expect(resolveRepoToken("jane/private-content")).toBe("shared");
  });

  it("honours an explicit per-repo token on the official source (opt-in)", () => {
    store.set("adaptive-learner.github_token", "shared");
    writeRepoToken("astrapi69/adaptive-learner-content", "explicit");
    expect(resolveRepoToken("astrapi69/adaptive-learner-content")).toBe(
      "explicit",
    );
  });
});
