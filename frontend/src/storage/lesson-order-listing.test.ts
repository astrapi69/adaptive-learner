/**
 * The listLessons seam applies the stored display order in BOTH storage modes
 * (#2212).
 *
 * #2172 persisted the "Manage lessons" reorder, but the overlay was applied in
 * exactly one widget - the actual open-a-set / next-lesson sequence still read
 * the raw filename order from ``listLessons`` and ignored it. This pins the fix
 * at the single seam every consumer calls: ``IStorageService.contentLoader
 * .listLessons``. Both modes are proven (the #2053 rule: a storage change is
 * proven in BOTH modes or it is not proven).
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storeLessonOrder } from "../lib/content/browse/lesson-order-store";

// Dexie mode: stub the raw cached read so the test targets the FACADE overlay,
// not Dexie seeding (covered elsewhere).
vi.mock("./content/content-loader-dexie", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./content/content-loader-dexie")>();
  return {
    ...actual,
    listLessonsDexie: vi.fn(async (source: string, setId: string) => ({
      set_id: setId,
      source,
      version: "1.0.0",
      lessons: ["epilog.json", "kapitel-1.json", "kapitel-2.json"],
    })),
  };
});

import { dexieStorage } from "./dexie-storage";
import { apiStorage } from "./api-storage";

const SRC = "user-generated";
const SET = "mein-buch";
const NATURAL = ["epilog.json", "kapitel-1.json", "kapitel-2.json"];
const DESIRED = ["kapitel-1.json", "kapitel-2.json", "epilog.json"];

beforeEach(() => {
  localStorage.clear();
});

describe("Dexie mode: listLessons follows the stored order (#2212)", () => {
  it("returns lessons in the user's chosen order", async () => {
    storeLessonOrder(SRC, SET, DESIRED);
    const listing = await dexieStorage.contentLoader.listLessons(SRC, SET);
    expect(listing.lessons).toEqual(DESIRED);
  });

  it("keeps the natural order when the set was never reordered", async () => {
    const listing = await dexieStorage.contentLoader.listLessons(SRC, SET);
    expect(listing.lessons).toEqual(NATURAL);
  });
});

describe("API mode: listLessons follows the stored order (#2212)", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          set_id: SET,
          source: SRC,
          version: "1.0.0",
          lessons: NATURAL,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns lessons in the user's chosen order", async () => {
    storeLessonOrder(SRC, SET, DESIRED);
    const listing = await apiStorage.contentLoader.listLessons(SRC, SET);
    expect(listing.lessons).toEqual(DESIRED);
  });

  it("keeps the natural order when the set was never reordered", async () => {
    const listing = await apiStorage.contentLoader.listLessons(SRC, SET);
    expect(listing.lessons).toEqual(NATURAL);
  });
});
