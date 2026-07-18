/**
 * Tests for the service-worker lesson-cache purge (#1819).
 *
 * The Workbox runtime cache ``adaptive-learner-lessons`` kept serving a
 * DELETED set's lessons (StaleWhileRevalidate) - a deleted set could be
 * resurrected from the SW cache. The purge removes the set's entries on
 * every delete, regardless of the progress-delete opt-in.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { purgeSetFromLessonCache } from "./sw-lesson-cache";

function fakeCacheStorage(urls: string[]) {
  const requests = urls.map((url) => ({ url }) as Request);
  const deleted: string[] = [];
  const cache = {
    keys: vi.fn(async () => requests),
    delete: vi.fn(async (request: Request) => {
      deleted.push(request.url);
      return true;
    }),
  };
  const storage = { open: vi.fn(async () => cache) };
  vi.stubGlobal("caches", storage);
  return { storage, cache, deleted };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("purgeSetFromLessonCache", () => {
  it("deletes exactly the set's cached lesson entries", async () => {
    const { storage, deleted } = fakeCacheStorage([
      "http://x/api/plugins/content-loader/sets/jane--repo/waehrung/lessons/01.json",
      "http://x/api/plugins/content-loader/sets/jane--repo/waehrung/lessons",
      "http://x/api/plugins/content-loader/sets/jane--repo/other-set/lessons/01.json",
      "http://x/api/plugins/content-loader/sets/other--repo/waehrung/lessons/01.json",
    ]);
    const removed = await purgeSetFromLessonCache("jane/repo", "waehrung");
    expect(storage.open).toHaveBeenCalledWith("adaptive-learner-lessons");
    expect(removed).toBe(2);
    expect(deleted).toEqual([
      "http://x/api/plugins/content-loader/sets/jane--repo/waehrung/lessons/01.json",
      "http://x/api/plugins/content-loader/sets/jane--repo/waehrung/lessons",
    ]);
  });

  it("returns 0 when nothing matches", async () => {
    fakeCacheStorage([
      "http://x/api/plugins/content-loader/sets/other--repo/foo/lessons/01.json",
    ]);
    expect(await purgeSetFromLessonCache("jane/repo", "waehrung")).toBe(0);
  });

  it("is a safe no-op when the Cache API is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await purgeSetFromLessonCache("jane/repo", "waehrung")).toBe(0);
  });

  it("never throws when the cache read fails", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn(async () => {
        throw new Error("cache backend gone");
      }),
    });
    expect(await purgeSetFromLessonCache("jane/repo", "waehrung")).toBe(0);
  });
});
