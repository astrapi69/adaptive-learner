/**
 * Tests for the local contribution history + recognition (Phase 64D).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  CONTRIBUTOR_THRESHOLD,
  clearContributions,
  contributionCount,
  isCommunityContributor,
  listContributions,
  recordContribution,
  type SharedContribution,
} from "./contribution-history";

/** Minimal in-memory Storage for deterministic, isolated tests. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

function contribution(over: Partial<SharedContribution> = {}): SharedContribution {
  return {
    lesson_id: "l1",
    title: "Lektion",
    shared_at: "2026-06-01T10:00:00.000Z",
    github_url: "https://github.com/astrapi69/adaptive-learner-content/issues/1",
    status: "submitted",
    ...over,
  };
}

let storage: Storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe("recordContribution + listContributions", () => {
  it("records a contribution and reads it back", () => {
    recordContribution(contribution(), storage);
    const list = listContributions(storage);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Lektion");
  });

  it("orders newest-first by shared_at", () => {
    recordContribution(
      contribution({
        github_url: "u1",
        shared_at: "2026-06-01T10:00:00.000Z",
      }),
      storage,
    );
    recordContribution(
      contribution({
        github_url: "u2",
        title: "Newer",
        shared_at: "2026-06-02T10:00:00.000Z",
      }),
      storage,
    );
    expect(listContributions(storage).map((c) => c.title)).toEqual([
      "Newer",
      "Lektion",
    ]);
  });

  it("de-duplicates by github_url", () => {
    recordContribution(contribution({ github_url: "same" }), storage);
    recordContribution(
      contribution({ github_url: "same", title: "Updated" }),
      storage,
    );
    const list = listContributions(storage);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Updated");
  });
});

describe("contributionCount + recognition", () => {
  it("counts contributions", () => {
    expect(contributionCount(storage)).toBe(0);
    recordContribution(contribution({ github_url: "u1" }), storage);
    expect(contributionCount(storage)).toBe(1);
  });

  it("awards the Community Contributor recognition at the threshold", () => {
    for (let i = 0; i < CONTRIBUTOR_THRESHOLD - 1; i++) {
      recordContribution(contribution({ github_url: `u${i}` }), storage);
    }
    expect(isCommunityContributor(storage)).toBe(false);
    recordContribution(contribution({ github_url: "final" }), storage);
    expect(isCommunityContributor(storage)).toBe(true);
  });
});

describe("resilience", () => {
  it("returns an empty history for corrupt storage", () => {
    storage.setItem("adaptive-learner.contributions", "{not json");
    expect(listContributions(storage)).toEqual([]);
  });

  it("ignores malformed entries", () => {
    storage.setItem(
      "adaptive-learner.contributions",
      JSON.stringify([{ nope: true }, contribution({ github_url: "good" })]),
    );
    expect(listContributions(storage)).toHaveLength(1);
  });

  it("clearContributions empties the history", () => {
    recordContribution(contribution(), storage);
    clearContributions(storage);
    expect(contributionCount(storage)).toBe(0);
  });
});
