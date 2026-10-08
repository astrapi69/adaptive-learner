/**
 * Every backup table survives a browser round trip (#3693).
 *
 * BACKUP-AKZEPTANZTEST (quality-checks.md) asks for a real Export, wipe,
 * Import with real data, because unit tests missed five "fixed" backup
 * releases in a row. The content-verified specs next to this one prove it
 * for one data shape each, so every NEW table used to need a manual round
 * trip (#3679 added ``xp_purchases``). This spec proves it for all of them
 * at once, and for every table added later without an edit here: the table
 * list is read from ``frontend/src/storage/backup/backup-tables.ts``. The
 * module cannot be imported here (its ``lib/constants`` import reads
 * ``import.meta``), so the source is parsed, and the parsed set must equal
 * the table set of the real export, or the spec fails.
 *
 * Flow: onboard a learner, seed one row into every backup store that is
 * still empty (plus the four parents the ``via_*`` scopes point at, always;
 * the composite-key stores get the producer's key convention), export with
 * the real button and the
 * real download, wipe every backup store except the learner (``users``,
 * ``user_settings``: without them the Settings page has no Data tab to import
 * into), import the same bytes through the real file input, export again,
 * and compare the two exports table by table.
 * A table that is missing from the first export fails (fail closed): an empty
 * table would otherwise "round-trip" by proving nothing.
 *
 * What only a real device shows (standalone home-screen mode, storage
 * eviction) stays with the manual round trip.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {expect, test, type Download, type Page} from "@playwright/test";
import {strFromU8, unzipSync} from "fflate";

import {createTestUser} from "../helpers/onboarding";

const DEXIE_DB_NAME = "adaptive-learner";
const TS = "2026-06-01T10:00:00.000Z";
const SOURCE = "astrapi69/adaptive-learner-content";

interface TableInfo {
    name: string;
    store: string;
    scope: string;
    timestampField: string;
}

const REGISTRY = join(__dirname, "..", "..", "frontend", "src", "storage", "backup", "backup-tables.ts");

/** ``BACKUP_TABLES`` and ``SECRET_TABLES`` parsed from the registry source.
 *  Each entry is cut out as its own block and its fields read regardless of
 *  order and comments. */
function readRegistry(): {tables: TableInfo[]; secret: Set<string>} {
    const source = readFileSync(REGISTRY, "utf-8");
    const start = source.indexOf("export const BACKUP_TABLES");
    const block = source.slice(start, source.indexOf("\n};", start));
    const tables: TableInfo[] = [];
    for (const [, name, rawBody] of block.matchAll(/^ {4}(\w+): \{\n([\s\S]*?)^ {4}\},/gm)) {
        const body = rawBody.replace(/\/\/.*$/gm, "");
        const field = (key: string): string =>
            new RegExp(`${key}:\\s*"?(\\w+)"?`).exec(body)?.[1] ?? "";
        tables.push({name, store: field("store"), scope: field("scope"), timestampField: field("timestampField")});
    }
    const secretMatch = /SECRET_TABLES[^=]*=\s*new Set\(\[([^\]]*)\]\)/.exec(source);
    const secret = new Set([...(secretMatch?.[1] ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]));
    return {tables, secret};
}

const {tables: TABLES, secret: SECRET_TABLES} = readRegistry();
/** Tables whose round trip is broken by a known, filed defect, by issue.
 *  They are asserted to STILL differ, so a fix fails this spec until the
 *  entry goes. Empty since #3694 (badges, user_streaks) was fixed. */
const KNOWN_BROKEN = new Map<string, string>();

/**
 * Rows whose id is local to the device, so a correct restore keeps the local
 * id and the two exports differ in it (#3694). They are compared by identity
 * instead:
 * - the badge catalog is seeded per device with random ids: by ``key``;
 * - an earned badge points at the catalog by id: by the badge's ``key``;
 * - a per-user singleton (``&user_id``) the app may already have written:
 *   without its ``id``.
 */
const DEVICE_LOCAL_ID = new Set(["badges", "user_streaks", "user_xp", "user_settings"]);
const BY_BADGE_KEY = new Set(["user_badges"]);

/** The learner the import runs into; every other backup store is wiped. */
const KEPT = new Set(["users", "user_settings"]);
const WIPED = TABLES.filter((t) => !KEPT.has(t.name));

type Rows = Record<string, Record<string, unknown>[]>;

async function exportBackup(page: Page): Promise<{bytes: Buffer; name: string; data: Rows}> {
    await page.goto("/settings?tab=data");
    await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
    const [download]: [Download, void] = await Promise.all([
        page.waitForEvent("download", {timeout: 15000}),
        page.getByTestId("backup-export").click(),
    ]);
    const path = await download.path();
    expect(path, "download must materialize to a local file").not.toBeNull();
    const bytes = readFileSync(path as string);
    const entries = unzipSync(new Uint8Array(bytes));
    const dataEntry = Object.keys(entries).find((n) => n.endsWith("data.json"));
    expect(dataEntry, `no data.json in ${Object.keys(entries).join(", ")}`).toBeDefined();
    const parsed = JSON.parse(strFromU8(entries[dataEntry as string])) as {data: Rows};
    return {bytes, name: download.suggestedFilename(), data: parsed.data};
}

/** Rows of one table in a stable order, so two exports compare by content.
 *  Device-local ids are replaced by their identity (see DEVICE_LOCAL_ID). */
function comparable(name: string, data: Rows): string {
    const badgeKey = new Map((data.badges ?? []).map((b) => [String(b.id), String(b.key)]));
    const rows = (data[name] ?? []).map((row) => {
        const out: Record<string, unknown> = {...row};
        if (name === "badges") {
            delete out.id;
            delete out.created_at;
            delete out.updated_at;
        } else if (DEVICE_LOCAL_ID.has(name)) {
            delete out.id;
        }
        // The streak read path rewrites updated_at on every read
        // (storage/gamification/streaks.ts), before and after the restore.
        if (name === "user_streaks") delete out.updated_at;
        if (BY_BADGE_KEY.has(name)) out.badge_id = badgeKey.get(String(row.badge_id)) ?? row.badge_id;
        // A merged row puts the local fields first; key order is not content.
        return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
    });
    const order = (r: Record<string, unknown>) => String(r.id ?? r.key ?? r.user_id ?? JSON.stringify(r));
    return JSON.stringify(rows.sort((a, b) => order(a).localeCompare(order(b))));
}

test.describe("Backup — every BACKUP_TABLES table round-trips (Dexie)", () => {
    test("export, wipe, import and a second export agree on every table", async ({page}) => {
        test.setTimeout(120_000);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(() => {
            try {
                // @ts-expect-error — force the download fallback.
                delete window.showSaveFilePicker;
            } catch {
                /* non-configurable in some engines; ignore */
            }
        });

        // #2083 point 4: a parse that found nothing would read as clean.
        expect(TABLES.length, "no tables parsed from backup-tables.ts").toBeGreaterThan(25);
        const incomplete = TABLES.filter((t) => !t.store || !t.scope || !t.timestampField);
        expect(incomplete.map((t) => t.name), "registry entries parsed incompletely").toEqual([]);

        await createTestUser(page);
        const userId = (await page.evaluate(() =>
            localStorage.getItem("adaptive-learner.user_id"),
        )) as string;
        expect(userId, "onboarding must have set a learner id").not.toBeNull();

        // --- Seed one row into every backup store that is still empty ----
        const seeded: string[] = await page.evaluate(
            ({dbName, tables, userId, ts, source, secret}) =>
                new Promise<string[]>((resolve, reject) => {
                    const ids = {
                        project: "e2e-project",
                        curriculum: "e2e-curriculum",
                        session: "e2e-session",
                        conversation: "e2e-conversation",
                    };
                    const slug = source.replace(/\//g, "--");
                    /** Parents the ``via_*`` rows point at. They are always
                     *  seeded: onboarding already creates a project, and a
                     *  child pointing at a project id that does not exist
                     *  falls out of the user's scope on export. */
                    const parents = new Set([
                        "learning_projects",
                        "curriculums",
                        "learning_sessions",
                        "imported_conversations",
                    ]);
                    /** The id each store's producer would write. */
                    const idFor = (name: string): string => {
                        switch (name) {
                            case "users":
                                return userId;
                            case "learning_projects":
                                return ids.project;
                            case "curriculums":
                                return ids.curriculum;
                            case "learning_sessions":
                                return ids.session;
                            case "imported_conversations":
                                return ids.conversation;
                            case "lesson_progress":
                                return `${userId}#${slug}#es-a1#01-e2e.json`;
                            case "speech_recordings":
                                return `${userId}#${slug}#es-a1#01-e2e.json#ex-1`;
                            case "element_errors":
                                return `${userId}#es-a1#01-e2e#ex-1#hola#target_to_source#1`;
                            default:
                                return `e2e-${name}`;
                        }
                    };
                    const link: Record<string, Record<string, string>> = {
                        via_project: {project_id: ids.project},
                        via_curriculum: {curriculum_id: ids.curriculum},
                        via_session: {session_id: ids.session},
                        via_conversation: {conversation_id: ids.conversation},
                        user: {user_id: userId},
                    };
                    /** Fields some stores key or index on. */
                    const extra: Record<string, Record<string, unknown>> = {
                        lesson_progress: {source, set_id: "es-a1", lesson_filename: "01-e2e.json"},
                        speech_recordings: {
                            source,
                            set_id: "es-a1",
                            lesson_filename: "01-e2e.json",
                            exercise_id: "ex-1",
                            audio_base64: "UklGRhAAAABXQVZF",
                        },
                        element_errors: {
                            set_id: "es-a1",
                            lesson_id: "01-e2e",
                            exercise_id: "ex-1",
                            element_key: "hola",
                            direction: "target_to_source",
                            run_id: 1,
                        },
                        // The full shape the streak producer writes: a
                        // field the backup lacks would come from the local
                        // row on merge and read as a difference.
                        user_streaks: {
                            current_streak_days: 2,
                            longest_streak_days: 7,
                            freezes_available: 1,
                            weekend_mode: true,
                            last_freeze_earned_on: null,
                            last_freeze_used_on: null,
                        },
                        user_badges: {badge_id: "e2e-badge"},
                        badges: {key: "e2e-badge"},
                        xp_purchases: {item_kind: "avatar_frame", item_id: "e2e"},
                    };
                    const open = indexedDB.open(dbName);
                    open.onerror = () => reject(String(open.error));
                    open.onsuccess = () => {
                        const db = open.result;
                        const stores = tables
                            .filter((t) => !secret.includes(t.name))
                            .map((t) => t.store);
                        const tx = db.transaction(stores, "readwrite");
                        const done: string[] = [];
                        for (const t of tables) {
                            if (secret.includes(t.name)) continue;
                            const store = tx.objectStore(t.store);
                            const count = store.count();
                            count.onsuccess = () => {
                                if (count.result > 0 && !parents.has(t.name)) return;
                                store.put({
                                    id: idFor(t.name),
                                    ...(link[t.scope] ?? {}),
                                    ...(extra[t.name] ?? {}),
                                    created_at: ts,
                                    updated_at: ts,
                                    [t.timestampField]: ts,
                                    e2e_table: t.name,
                                });
                                done.push(t.name);
                            };
                        }
                        tx.oncomplete = () => {
                            db.close();
                            resolve(done);
                        };
                        tx.onerror = () => reject(String(tx.error));
                    };
                }),
            {
                dbName: DEXIE_DB_NAME,
                tables: TABLES,
                userId,
                ts: TS,
                source: SOURCE,
                secret: [...SECRET_TABLES],
            },
        );
        // eslint-disable-next-line no-console -- evidence: what this run seeded
        console.log(`[backup-every-table] ${TABLES.length} tables, seeded ${seeded.length}: ${seeded.join(", ")}`);

        // --- First export: every table carries a row (fail closed) -------
        const first = await exportBackup(page);
        expect(
            Object.keys(first.data).sort(),
            "the parsed registry and the real export disagree on the table set",
        ).toEqual(TABLES.map((t) => t.name).sort());
        const empty = TABLES.filter(
            (t) => !SECRET_TABLES.has(t.name) && (first.data[t.name]?.length ?? 0) === 0,
        ).map((t) => t.name);
        expect(empty, "tables with no row in the first export prove nothing").toEqual([]);
        for (const name of SECRET_TABLES) {
            expect(first.data[name] ?? [], `${name} must stay empty`).toEqual([]);
        }
        await expect(page.locator(".Toastify__toast--error")).toHaveCount(0);

        // --- Wipe every backup store but the learner ----------------------
        // users and user_settings stay: without them the Settings page shows
        // "not found", so there is no Data tab to import into. The restore
        // runs into an existing profile, as the manual round trip into a
        // profile does. Both tables are still compared below.
        const wiped = await page.evaluate(
            ({dbName, stores}) =>
                new Promise<number>((resolve, reject) => {
                    const open = indexedDB.open(dbName);
                    open.onsuccess = () => {
                        const db = open.result;
                        const tx = db.transaction(stores, "readwrite");
                        for (const s of stores) tx.objectStore(s).clear();
                        tx.oncomplete = () => {
                            db.close();
                            resolve(stores.length);
                        };
                        tx.onerror = () => reject(String(tx.error));
                    };
                }),
            {dbName: DEXIE_DB_NAME, stores: WIPED.map((t) => t.store)},
        );
        expect(wiped).toBe(WIPED.length);

        // --- Import the exact bytes through the real file input -----------
        await page.goto("/settings?tab=data");
        await expect(page.getByTestId("settings-panel-data")).toBeVisible({timeout: 15000});
        await page.getByTestId("backup-file-input").setInputFiles({
            name: first.name,
            mimeType: "application/zip",
            buffer: first.bytes,
        });
        await expect(page.getByTestId("backup-comparison")).toBeVisible({timeout: 10000});
        await page.getByTestId("backup-confirm").click();
        await expect(page.getByTestId("backup-summary")).toBeVisible({timeout: 15000});

        // --- Second export: every table equals the first ------------------
        const second = await exportBackup(page);
        const differing = TABLES.filter(
            (t) => comparable(t.name, first.data) !== comparable(t.name, second.data),
        ).map(
            (t) =>
                `${t.name} (${first.data[t.name]?.length ?? 0} -> ${second.data[t.name]?.length ?? 0} rows)`,
        );
        const broken = differing.filter((d) => !KNOWN_BROKEN.has(d.split(" ")[0]));
        expect(broken, "tables that did not survive export -> wipe -> import").toEqual([]);
        // A known defect that stops reproducing must leave the list, or the
        // list would keep excusing a table that now round-trips (#2083).
        const healed = [...KNOWN_BROKEN.keys()].filter(
            (name) => !differing.some((d) => d.startsWith(`${name} `)),
        );
        expect(healed, "known-broken tables that round-trip now: remove them from KNOWN_BROKEN").toEqual([]);
        // eslint-disable-next-line no-console -- evidence: the proven set
        console.log(
            `[backup-every-table] ${TABLES.length - KNOWN_BROKEN.size} of ${TABLES.length} tables round-trip, ` +
                `${KNOWN_BROKEN.size} known broken (${[...KNOWN_BROKEN.keys()].join(", ")}), .alb ${first.bytes.byteLength} bytes`,
        );

        expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
    });
});
