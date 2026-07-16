/**
 * dismissed-sets (#1709) — the persisted "explicitly removed by the user"
 * state that keeps a deleted set out of "Meine Inhalte" across Refresh.
 *
 * TDD reproduction context: deleting a set purges the cache, but the
 * source catalogue still advertises it, so a bare Refresh used to bring
 * every deleted set back. These tests pin the persistence half; the
 * list-filter half is pinned in useContentSetsData.test.tsx.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  dismissSet,
  dismissSets,
  isDismissedSet,
  readDismissedSetKeys,
  undismissSet,
} from "./dismissed-sets";

/** Minimal in-memory Storage double (same shape the DOM provides). */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const bag = new Map(Object.entries(seed));
  return {
    get length() {
      return bag.size;
    },
    clear: () => bag.clear(),
    getItem: (k: string) => bag.get(k) ?? null,
    key: (i: number) => [...bag.keys()][i] ?? null,
    removeItem: (k: string) => {
      bag.delete(k);
    },
    setItem: (k: string, v: string) => {
      bag.set(k, v);
    },
  } as Storage;
}

describe("dismissed-sets", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("round-trips a dismissal (dismiss → isDismissed → undismiss)", () => {
    expect(isDismissedSet("owner/repo", "es-a1-from-de", storage)).toBe(false);
    dismissSet("owner/repo", "es-a1-from-de", storage);
    expect(isDismissedSet("owner/repo", "es-a1-from-de", storage)).toBe(true);
    undismissSet("owner/repo", "es-a1-from-de", storage);
    expect(isDismissedSet("owner/repo", "es-a1-from-de", storage)).toBe(false);
  });

  it("keys by source AND id — same id under another source stays visible", () => {
    dismissSet("owner/repo", "es-a1-from-de", storage);
    expect(isDismissedSet("other/repo", "es-a1-from-de", storage)).toBe(false);
    expect(isDismissedSet("owner/repo", "other-set", storage)).toBe(false);
  });

  it("dismissSets records every ref of a bulk delete in one write", () => {
    dismissSets(
      [
        { source: "a/r", setId: "one" },
        { source: "b/r", setId: "two" },
      ],
      storage,
    );
    expect(isDismissedSet("a/r", "one", storage)).toBe(true);
    expect(isDismissedSet("b/r", "two", storage)).toBe(true);
    expect(readDismissedSetKeys(storage).length).toBe(2);
  });

  it("is idempotent — dismissing twice keeps one record", () => {
    dismissSet("a/r", "one", storage);
    dismissSet("a/r", "one", storage);
    expect(readDismissedSetKeys(storage).length).toBe(1);
  });

  it("tolerates corrupt storage content (returns empty, never throws)", () => {
    storage.setItem("adaptive-learner.dismissed-sets", "{not json");
    expect(readDismissedSetKeys(storage)).toEqual([]);
    expect(isDismissedSet("a/r", "one", storage)).toBe(false);
    // A write after corruption recovers the store.
    dismissSet("a/r", "one", storage);
    expect(isDismissedSet("a/r", "one", storage)).toBe(true);
  });

  it("tolerates a non-array JSON payload", () => {
    storage.setItem(
      "adaptive-learner.dismissed-sets",
      JSON.stringify({ nope: true }),
    );
    expect(readDismissedSetKeys(storage)).toEqual([]);
  });
});
