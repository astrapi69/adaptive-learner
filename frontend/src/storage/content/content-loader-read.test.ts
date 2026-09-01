/**
 * Tests for the Dexie-mode lesson-listing read path (#2835).
 *
 * ``listLessonsDexie`` must return lessons in the set's canonical
 * order even for a set that was cached WITHOUT the #2367
 * lesson-order overlay ever being seeded - the overlay is written
 * only by ``downloadSetDexie``'s "seed on download" step
 * (content-loader-download.ts), so a set cached before that step
 * existed, or via any path that bypasses it, has no overlay entry
 * and previously fell back to plain lexicographic filename sort
 * (breaking mixed 2-/3-digit prefixes: "100-..." before "11-...").
 *
 * These tests seed ``contentSets`` / ``contentSetFiles`` directly
 * (bypassing ``downloadSetDexie``) to reproduce exactly that
 * "legacy cached set, no overlay" state.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { listLessonsDexie } from "./content-loader-dexie";
import { _resetDbForTests, getDb } from "../dexie/db";
import { fileKey } from "./content-loader-sources";

const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "psych-intro";
const SET_PK = `${SOURCE}/${SET_ID}/1.0.0`;

const SET_MANIFEST_WITH_ORDER = `
schema_version: '1.0'
name: Psych Intro
sets:
  - id: psych-intro
    title: Psych Intro
    language: de
    level: A1
    version: '1.0.0'
    lesson_count: 3
metadata:
  lessons:
    - 10-a.json
    - 11-b.json
    - 100-c.json
`.trim();

async function seedCachedSet(manifestYaml: string, filenames: string[]) {
  const db = getDb();
  await db.contentSets.put({
    id: SET_PK,
    source: SOURCE,
    branch: "main",
    set_id: SET_ID,
    version: "1.0.0",
    title: "Psych Intro",
    language: "de",
    target_language: "de",
    source_language: "en",
    level: "A1",
    domain: "psychology",
    lesson_count: filenames.length,
    description: null,
    tags: "[]",
    cover_image: null,
    downloaded_at: "2026-05-26T00:00:00Z",
    manifest_yaml: manifestYaml,
  });
  for (const filename of filenames) {
    await db.contentSetFiles.put({
      id: fileKey(SET_PK, `lessons/${filename}`),
      set_pk: SET_PK,
      filename: `lessons/${filename}`,
      body: "{}",
      encoding: "text",
    });
  }
}

beforeEach(async () => {
  // Drop the Dexie database explicitly so every test starts from an
  // empty IndexedDB. ``_resetDbForTests`` only closes the connection —
  // it does not wipe the data, and the fake-indexeddb engine persists
  // across resets (see content-loader-dexie.test.ts for the same note).
  const db = getDb();
  try {
    await db.contentSets.clear();
    await db.contentSetFiles.clear();
  } catch {
    /* fresh DB — nothing to clear */
  }
  await _resetDbForTests();
});

describe("listLessonsDexie honours manifest-declared order without the overlay (#2835)", () => {
  it("orders by metadata.lessons even for a legacy-cached set with no order overlay", async () => {
    // Filenames land in the DB in plain lexicographic order (as a
    // pre-#2367 cached set would have them), NOT in declared order.
    await seedCachedSet(SET_MANIFEST_WITH_ORDER, [
      "100-c.json",
      "10-a.json",
      "11-b.json",
    ]);
    const listing = await listLessonsDexie(SOURCE, SET_ID);
    expect(listing.lessons).toEqual([
      "10-a.json",
      "11-b.json",
      "100-c.json",
    ]);
  });

  it("appends files the manifest doesn't declare, sorted, after the declared ones", async () => {
    await seedCachedSet(SET_MANIFEST_WITH_ORDER, [
      "100-c.json",
      "10-a.json",
      "11-b.json",
      "99-extra.json",
    ]);
    const listing = await listLessonsDexie(SOURCE, SET_ID);
    expect(listing.lessons).toEqual([
      "10-a.json",
      "11-b.json",
      "100-c.json",
      "99-extra.json",
    ]);
  });

  it("falls back to lexicographic order when the manifest declares no lessons field", async () => {
    const manifestWithoutOrder = `
schema_version: '1.0'
name: Psych Intro
sets:
  - id: psych-intro
    title: Psych Intro
    language: de
    level: A1
    version: '1.0.0'
    lesson_count: 3
`.trim();
    await seedCachedSet(manifestWithoutOrder, [
      "100-c.json",
      "10-a.json",
      "11-b.json",
    ]);
    const listing = await listLessonsDexie(SOURCE, SET_ID);
    expect(listing.lessons).toEqual([
      "10-a.json",
      "100-c.json",
      "11-b.json",
    ]);
  });
});
