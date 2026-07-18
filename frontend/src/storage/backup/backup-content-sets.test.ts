/**
 * backup-content-sets (#1806) — direct module pins.
 *
 * Complements the hub-level #130/#134 round-trips in backup.test.ts
 * with the recovery edges those don't pin: per-entry error isolation,
 * the meta-less manifest fallback chain (languages cross-fill, lesson
 * count derived from the files, tags from the manifest), and the
 * undefined-entries no-op.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {restoreDexieContentSets} from "./backup-content-sets";
import {_resetDbForTests, getDb} from "../dexie/db";
import type {ContentSetBackupEntry} from "../../types/domain";

beforeEach(async () => {
    await _resetDbForTests();
    // fake-indexeddb keeps its data across _resetDbForTests (it only
    // closes the handle), so the seeded fixed-id rows must be cleared
    // explicitly or they collide on the next test's add().
    const db = getDb();
    await Promise.all(
        [db.contentSets, db.contentSetFiles].map(
            (table) => table.clear(),
        ),
    );
});

afterEach(async () => {
    await _resetDbForTests();
});

const MANIFEST = [
    "name: adaptive-learner-content",
    "sets:",
    "  - id: fr-a1",
    "    title: French A1",
    "    target_language: fr",
    "    source_language: de",
    "    level: A1",
    "    tags:",
    "      - beginner",
].join("\n");

/** API-origin entry (no Dexie meta) carrying a manifest + two lessons. */
function metaLessEntry(): ContentSetBackupEntry {
    return {
        source: "astrapi69/adaptive-learner-content",
        set_id: "fr-a1",
        version: 3,
        branch: "main",
        meta: undefined,
        files: [
            {filename: "manifest.yaml", body: MANIFEST, encoding: "text"},
            {filename: "lessons/01-intro.json", body: "{}", encoding: "text"},
            {filename: "lessons/02-greet.json", body: "{}", encoding: "text"},
        ],
    } as unknown as ContentSetBackupEntry;
}

describe("restoreDexieContentSets", () => {
    it("is a no-op for a payload without a content_sets block", async () => {
        const result = await restoreDexieContentSets(getDb(), undefined);
        expect(result).toEqual({restored: 0, skipped: 0, errors: []});
    });

    it("recovers a meta-less set from the manifest (title, pair, count, tags)", async () => {
        const db = getDb();
        const result = await restoreDexieContentSets(db, [metaLessEntry()]);
        expect(result).toEqual({restored: 1, skipped: 0, errors: []});
        const row = await db.contentSets.get(
            "astrapi69--adaptive-learner-content/fr-a1/3",
        );
        expect(row).toMatchObject({
            title: "French A1",
            target_language: "fr",
            language: "fr",
            source_language: "de",
            level: "A1",
            lesson_count: 2,
            tags: JSON.stringify(["beginner"]),
        });
        const files = await db.contentSetFiles
            .where("set_pk")
            .equals(row!.id)
            .toArray();
        expect(files).toHaveLength(3);
    });

    it("isolates a corrupt entry: the error is reported, the rest restores", async () => {
        const db = getDb();
        const broken = {
            source: "x/y",
            set_id: "broken",
            version: 1,
            branch: "main",
            meta: undefined,
            files: null,
        } as unknown as ContentSetBackupEntry;
        const result = await restoreDexieContentSets(db, [broken, metaLessEntry()]);
        expect(result.restored).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("x/y/broken@v1");
        expect(
            await db.contentSets.get(
                "astrapi69--adaptive-learner-content/fr-a1/3",
            ),
        ).toBeTruthy();
    });

    it("falls back to the set_id when there is neither meta nor manifest", async () => {
        const db = getDb();
        const bare = {
            source: "x/y",
            set_id: "mystery",
            version: 1,
            branch: null,
            meta: undefined,
            files: [{filename: "lessons/01.json", body: "{}", encoding: "text"}],
        } as unknown as ContentSetBackupEntry;
        const result = await restoreDexieContentSets(db, [bare]);
        expect(result.restored).toBe(1);
        const row = await db.contentSets.get("x--y/mystery/1");
        expect(row).toMatchObject({
            title: "mystery",
            branch: "main",
            domain: "language",
            source_language: "en",
            lesson_count: 1,
        });
    });
});
