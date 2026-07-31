/**
 * The saveUserSet seam records the source order in BOTH storage modes (#2173).
 *
 * A book/text import creates the set with its lessons in document order, but
 * ``listLessons`` returns filenames alphabetically (backend ``sorted(...)`` /
 * Dexie ``.sort()``), so an epilogue lands before chapter one. The fix
 * prepopulates the #2172 display-order overlay at the single
 * ``IStorageService.contentLoader.saveUserSet`` seam so the source order drives
 * the listing. Both modes are proven (the #2053 rule: a storage change is
 * proven in BOTH modes or it is not proven).
 *
 * The origin distinction is the crux: import and user writes share one store,
 * so a re-save must never overwrite an order the user already arranged.
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLessonOrder,
  storeLessonOrder,
} from "../lib/content/browse/lesson-order-store";
import type { ContentLesson, ContentSetEntry, SaveUserSetInput } from "./types";
import { USER_GENERATED_SOURCE } from "./types";

// Dexie mode: stub the raw cache write so the test targets the FACADE wiring
// (the order-store prepopulation), not Dexie seeding (covered elsewhere).
vi.mock("./content/content-loader-user-sets", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./content/content-loader-user-sets")>();
  return {
    ...actual,
    saveUserSetDexie: vi.fn(
      async (input: SaveUserSetInput): Promise<ContentSetEntry> =>
        ({ id: input.set_id }) as unknown as ContentSetEntry,
    ),
  };
});

import { dexieStorage } from "./dexie-storage";
import { apiStorage } from "./api-storage";

const SET = "mein-buch";

/** Book import: lessons arrive in document/reading order. */
function bookLesson(id: string): ContentLesson {
  return { id, title: id } as unknown as ContentLesson;
}

const SOURCE_ORDER_IDS = [
  "kapitel-1",
  "kapitel-2",
  "epilog",
];
/** The order store keys BY the cache filename, ``<lesson.id>.json``. */
const SOURCE_ORDER_FILES = SOURCE_ORDER_IDS.map((id) => `${id}.json`);

function input(): SaveUserSetInput {
  return {
    set_id: SET,
    title: "Mein Buch",
    language: "de",
    level: "A1",
    origin: "imported",
    lessons: SOURCE_ORDER_IDS.map(bookLesson),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("Dexie mode: saveUserSet records the source order (#2173)", () => {
  it("prepopulates the order overlay with the import order", async () => {
    await dexieStorage.contentLoader.saveUserSet(input());
    expect(getLessonOrder(USER_GENERATED_SOURCE, SET)).toEqual(SOURCE_ORDER_FILES);
  });

  it("does NOT overwrite an order the user already arranged (user wins)", async () => {
    const userOrder = ["epilog.json", "kapitel-1.json", "kapitel-2.json"];
    storeLessonOrder(USER_GENERATED_SOURCE, SET, userOrder);
    await dexieStorage.contentLoader.saveUserSet(input());
    expect(getLessonOrder(USER_GENERATED_SOURCE, SET)).toEqual(userOrder);
  });
});

describe("API mode: saveUserSet records the source order (#2173)", () => {
  beforeEach(() => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: SET }), { status: 200 }),
    ) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prepopulates the order overlay with the import order", async () => {
    await apiStorage.contentLoader.saveUserSet(input());
    expect(getLessonOrder(USER_GENERATED_SOURCE, SET)).toEqual(SOURCE_ORDER_FILES);
  });

  it("does NOT overwrite an order the user already arranged (user wins)", async () => {
    const userOrder = ["epilog.json", "kapitel-1.json", "kapitel-2.json"];
    storeLessonOrder(USER_GENERATED_SOURCE, SET, userOrder);
    await apiStorage.contentLoader.saveUserSet(input());
    expect(getLessonOrder(USER_GENERATED_SOURCE, SET)).toEqual(userOrder);
  });
});
