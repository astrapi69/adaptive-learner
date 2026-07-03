/**
 * Tests for the Discover "last seen catalogue" anchor (New-content indicator).
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  computeNewKeys,
  markCatalogSeen,
  newKeysAgainstSeen,
  readSeenCatalog,
  SEEN_CATALOG_KEY,
  writeSeenCatalog,
} from "./seen-catalog";

beforeEach(() => {
  localStorage.clear();
});

describe("computeNewKeys", () => {
  it("flags a set that is not in the seen anchor as new", () => {
    const seen = new Set(["a/es-a1", "a/fr-a1"]);
    const result = computeNewKeys(["a/es-a1", "a/fr-a1", "a/fr-a1-from-el"], seen);
    expect([...result]).toEqual(["a/fr-a1-from-el"]);
  });

  it("does NOT flag a set that is already in the seen anchor", () => {
    const seen = new Set(["a/es-a1", "a/fr-a1"]);
    expect(computeNewKeys(["a/es-a1", "a/fr-a1"], seen).size).toBe(0);
  });

  it("flags nothing on the first run (null anchor) — no catalogue-wide 'New'", () => {
    expect(computeNewKeys(["a/es-a1", "a/fr-a1"], null).size).toBe(0);
  });
});

describe("readSeenCatalog / writeSeenCatalog", () => {
  it("returns null before anything is recorded (distinct from empty)", () => {
    expect(readSeenCatalog()).toBeNull();
  });

  it("round-trips the seen keys through localStorage", () => {
    writeSeenCatalog(["a/es-a1", "a/fr-a1"]);
    expect(readSeenCatalog()).toEqual(new Set(["a/es-a1", "a/fr-a1"]));
    expect(localStorage.getItem(SEEN_CATALOG_KEY)).not.toBeNull();
  });

  it("tolerates a malformed stored value (→ null)", () => {
    localStorage.setItem(SEEN_CATALOG_KEY, "{not json");
    expect(readSeenCatalog()).toBeNull();
  });
});

describe("anchor update after viewing / sync", () => {
  it("marking the catalogue seen makes previously-new sets no longer new", () => {
    // First open: fr-a1-from-el is new against a known anchor.
    writeSeenCatalog(["a/es-a1"]);
    const current = ["a/es-a1", "a/fr-a1-from-el"];
    expect([...newKeysAgainstSeen(current)]).toEqual(["a/fr-a1-from-el"]);

    // User viewed Discover → mark seen.
    markCatalogSeen(current);

    // Next open with the same catalogue: nothing new.
    expect(newKeysAgainstSeen(current).size).toBe(0);
  });

  it("persists across a reload: a set seen last time is not new again", () => {
    markCatalogSeen(["a/es-a1", "a/fr-a1-from-el"]);
    // Simulate a reload: a fresh read of the anchor (localStorage survives).
    const seen = readSeenCatalog();
    expect(computeNewKeys(["a/es-a1", "a/fr-a1-from-el"], seen).size).toBe(0);
    // …but a genuinely newer set still shows as new.
    expect([...computeNewKeys(["a/es-a1", "a/fr-a1-from-el", "a/de-a1"], seen)]).toEqual([
      "a/de-a1",
    ]);
  });
});
