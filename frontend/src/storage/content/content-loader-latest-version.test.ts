/**
 * #3788 - which cached version of a set is the latest is a numeric
 * question. Compared as strings, "1.9.3" sorts above "1.10.0", so a
 * device holding both read its lessons from the older one and listed
 * the older one.
 *
 * The rows are seeded directly: two versions of one set side by side is
 * the state a backup restore leaves (it adds a version the device lacks
 * and never removes one), and no download path produces it in one call.
 * The API mode orders numerically already
 * (``list_cached_versions`` in the content-loader plugin).
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { latestCachedRow, listSetsDexie } from "./content-loader-listing";
import { getLessonDexie } from "./content-loader-read";
import { _resetDbForTests, getDb } from "../dexie/db";
import { fileKey } from "./content-loader-sources";

const SOURCE = "astrapi69/alc-psychology";
const SET_ID = "psych-intro";

function manifest(version: string): string {
  return `
schema_version: '1.0'
name: Psych Intro
sets:
  - id: ${SET_ID}
    title: Psych Intro
    language: de
    level: A1
    version: '${version}'
    lesson_count: 1
`.trim();
}

async function seedVersion(version: string) {
  const db = getDb();
  const setPk = `${SOURCE}/${SET_ID}/${version}`;
  await db.contentSets.put({
    id: setPk,
    source: SOURCE,
    branch: "main",
    set_id: SET_ID,
    version,
    title: "Psych Intro",
    language: "de",
    target_language: "de",
    source_language: "en",
    level: "A1",
    domain: "psychology",
    lesson_count: 1,
    description: null,
    tags: "[]",
    cover_image: null,
    downloaded_at: "2026-05-26T00:00:00Z",
    manifest_yaml: manifest(version),
  });
  await db.contentSetFiles.put({
    id: fileKey(setPk, "lessons/01.json"),
    set_pk: setPk,
    filename: "lessons/01.json",
    body: JSON.stringify({
      id: "01",
      title: `Lesson of ${version}`,
      description: null,
      estimated_minutes: 5,
      cards: [],
      steps: [],
    }),
    encoding: "text",
  });
}

beforeEach(async () => {
  const db = getDb();
  try {
    await db.contentSets.clear();
    await db.contentSetFiles.clear();
  } catch {
    /* fresh DB - nothing to clear */
  }
  await _resetDbForTests();
});

describe("the latest cached version of a set is the numerically highest (#3788)", () => {
  it.each([
    { name: "a two-digit minor above a one-digit one", older: "1.9.3", newer: "1.10.0" },
    { name: "a two-digit patch above a one-digit one", older: "1.0.9", newer: "1.0.10" },
    { name: "a two-digit major above a one-digit one", older: "9.0.0", newer: "10.0.0" },
    { name: "the plain case, which a string comparison gets right too", older: "1.2.0", newer: "1.3.0" },
  ])("$name: $newer over $older", async ({ older, newer }) => {
    // Seeded newest first and oldest first: the answer may not depend on
    // the order the rows come back in.
    await seedVersion(newer);
    await seedVersion(older);

    expect((await latestCachedRow(SOURCE, SET_ID))?.version).toBe(newer);
  });

  it("reads a lesson from the numerically highest version", async () => {
    await seedVersion("1.9.3");
    await seedVersion("1.10.0");

    const lesson = await getLessonDexie(SOURCE, SET_ID, "01.json");

    expect(lesson.title).toBe("Lesson of 1.10.0");
  });

  it("lists a set of an unconnected source at its numerically highest version", async () => {
    await seedVersion("1.10.0");
    await seedVersion("1.9.3");

    const { sets } = await listSetsDexie([]);

    expect(sets.map((entry) => [entry.id, entry.cached_version])).toEqual([
      [SET_ID, "1.10.0"],
    ]);
  });
});
