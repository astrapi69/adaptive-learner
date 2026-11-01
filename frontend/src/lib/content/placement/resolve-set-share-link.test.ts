/**
 * Tests for choosing between the short set link and the add-repo link
 * (#3819): short only when the recipient's app can resolve the id.
 */

import { describe, expect, it, vi } from "vitest";

import type { RegistrySetLookup } from "../repos/registry-set-lookup";
import type { SearchableSet } from "../repos/search-index-loader";
import { OFFICIAL_SOURCE } from "../repos/source-identity";
import { resolveSetShareLink } from "./resolve-set-share-link";

const ORIGIN = "https://astrapi69.github.io";
const BASE = "/adaptive-learner/";

function found(repoUrl: string): RegistrySetLookup {
  return {
    status: "found",
    set: { id: "ki-einsteiger-from-de" } as SearchableSet,
    repo: { url: repoUrl, branch: "main" },
  };
}

describe("resolveSetShareLink", () => {
  it.each([
    ["an official set", OFFICIAL_SOURCE],
    ["a bundled set", "bundled:adaptive-learner-content"],
  ])("gives %s the short link without asking the registry", async (_label, source) => {
    const lookup = vi.fn();
    const result = await resolveSetShareLink(
      { source, branch: "main", id: "fr-a1" },
      { lookup, origin: ORIGIN, basePath: BASE },
    );
    expect(result).toEqual({ url: `${ORIGIN}${BASE}content/set/fr-a1`, short: true });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("gives a registry set the short link when the registry names its repo", async () => {
    const result = await resolveSetShareLink(
      { source: "astrapi69/alc-ai", branch: "main", id: "ki-einsteiger-from-de" },
      {
        lookup: async () => found("https://github.com/astrapi69/alc-ai"),
        origin: ORIGIN,
        basePath: BASE,
      },
    );
    expect(result).toEqual({
      url: `${ORIGIN}${BASE}content/set/ki-einsteiger-from-de`,
      short: true,
    });
  });

  it.each<[string, RegistrySetLookup]>([
    ["the registry does not list the set", { status: "absent" }],
    ["the registry cannot be read", { status: "unreachable" }],
    // The same id in another registry repo would open that repo's set.
    ["the registry names another repo for the id", found("https://github.com/jane/other")],
  ])("falls back to the add-repo link when %s", async (_label, lookupResult) => {
    const result = await resolveSetShareLink(
      { source: "astrapi69/alc-ai", branch: "main", id: "ki-einsteiger-from-de" },
      { lookup: async () => lookupResult, origin: ORIGIN, basePath: BASE },
    );
    expect(result).toEqual({
      url: `${ORIGIN}${BASE}add-repo?repo=astrapi69/alc-ai&set=ki-einsteiger-from-de`,
      short: false,
    });
  });

  it("falls back to the add-repo link when the lookup throws", async () => {
    const result = await resolveSetShareLink(
      { source: "coach/deck", branch: "dev", id: "lesson-1" },
      {
        lookup: async () => {
          throw new Error("offline");
        },
        origin: ORIGIN,
        basePath: BASE,
      },
    );
    expect(result.short).toBe(false);
    expect(result.url).toBe(`${ORIGIN}${BASE}add-repo?repo=coach/deck&branch=dev&set=lesson-1`);
  });
});
