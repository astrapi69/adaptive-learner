/**
 * Set lifecycle status — the full persistence cycle at the storage
 * boundary (recurring status-reset bug).
 *
 * Status is NO LONGER a Dexie-row concern: it lives in the mode-agnostic
 * ``lib/content/browse/set-status-store`` (localStorage + Dexie userData
 * mirror), overlaid on the read path in BOTH storage modes. These tests
 * run against the REAL Dexie read path (``listSetsDexie`` over
 * fake-indexeddb) AND the REAL store (localStorage) — no mock of either —
 * and model the "reload" (leave + return to "Meine Inhalte") as a second
 * ``listSetsDexie`` call, exactly what a page remount does.
 *
 * The old #1300 ``setSetStatusDexie``/``setSetsStatusDexie`` were removed:
 * they persisted only on the Dexie row, so API mode never stored anything
 * and every reload read "active". This suite pins that the store carries
 * the status through a real Dexie reload, and that batch delete + the
 * migration default still hold.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  deleteSetsDexie,
  downloadSetDexie,
  listSetsDexie,
} from "./content-loader-dexie";
import {
  applyStoredStatuses,
  storeSetStatus,
  storeSetStatuses,
} from "../../lib/content/browse/set-status-store";
import { _resetDbForTests, getDb } from "../dexie/db";

const SOURCE = "astrapi69/adaptive-learner-content";
const BRANCH = "main";
const SET_ID = "language-fr-a1";

const REPO_MANIFEST = `
schema_version: '1.0'
name: Adaptive Learner Pilot
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
    domain: language
    tags: [beginner]
`.trim();

const SET_MANIFEST = `
schema_version: '1.0'
name: French A1
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
metadata:
  lessons:
    - 01-greetings.json
`.trim();

const LESSON_JSON = JSON.stringify({
  id: "01-greetings",
  title: "Greetings",
  cards: [{ id: "bonjour", front: "Bonjour", back: "Hello" }],
  steps: [{ id: "intro", type: "theory", body: "# Greetings" }],
});

function installFetchMock(routes: Record<string, string | null>): Mock {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [path, body] of Object.entries(routes)) {
      if (url.endsWith(path)) {
        if (body === null) return new Response("not found", { status: 404 });
        return new Response(body, { status: 200 });
      }
    }
    return new Response(`unmocked: ${url}`, { status: 404 });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

const DOWNLOAD_ROUTES = {
  [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
  [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
  [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]: LESSON_JSON,
};

async function download() {
  installFetchMock(DOWNLOAD_ROUTES);
  return downloadSetDexie(SOURCE, SET_ID, [{ source: SOURCE, branch: BRANCH }]);
}

/** A page load: read the real Dexie list, then overlay the real store —
 *  exactly what ``loadSets`` does on mount. */
async function loadSetsWithOverlay() {
  installFetchMock(DOWNLOAD_ROUTES);
  const { sets } = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
  return applyStoredStatuses(sets);
}

beforeEach(async () => {
  localStorage.clear();
  const db = getDb();
  try {
    await db.contentSets.clear();
    await db.contentSetFiles.clear();
  } catch {
    /* fresh DB */
  }
  await _resetDbForTests();
});

describe("set status — real persistence cycle (store overlay over Dexie read)", () => {
  it("a freshly downloaded set is 'active' with no stored status", async () => {
    const entry = await download();
    expect(entry.status).toBe("active");
    const overlaid = await loadSetsWithOverlay();
    expect(overlaid.find((s) => s.id === SET_ID)?.status).toBe("active");
  });

  it("a deferred set stays deferred across a reload (the bug: it reverted to active)", async () => {
    await download();
    storeSetStatus(SOURCE, SET_ID, "deferred");

    const overlaid = await loadSetsWithOverlay();
    expect(overlaid.find((s) => s.id === SET_ID)?.status).toBe("deferred");
  });

  it("survives a second reload (idempotent across remounts)", async () => {
    await download();
    storeSetStatus(SOURCE, SET_ID, "completed");
    await loadSetsWithOverlay();
    const again = await loadSetsWithOverlay();
    expect(again.find((s) => s.id === SET_ID)?.status).toBe("completed");
  });

  it("re-activation sticks across a reload", async () => {
    await download();
    storeSetStatus(SOURCE, SET_ID, "deferred");
    storeSetStatus(SOURCE, SET_ID, "active");
    const overlaid = await loadSetsWithOverlay();
    expect(overlaid.find((s) => s.id === SET_ID)?.status).toBe("active");
  });

  it("reads a row without a status field as 'active' (migration default)", async () => {
    await download();
    // Simulate a pre-#1300 cached row: strip the status field.
    await getDb().contentSets.toCollection().modify((row) => {
      delete (row as unknown as Record<string, unknown>).status;
    });
    const overlaid = await loadSetsWithOverlay();
    expect(overlaid.find((s) => s.id === SET_ID)?.status).toBe("active");
  });
});

describe("bulk set operations (Dexie batch, #1351)", () => {
  /** Download the pilot set, then clone its row into a second cached set so
   *  the batch helpers have two real rows to operate on. */
  async function twoSets() {
    await download();
    const db = getDb();
    const [row] = await db.contentSets.toArray();
    await db.contentSets.add({ ...row, id: `${row.id}-2`, set_id: "second-set" });
    return db;
  }

  const refs = [
    { source: SOURCE, setId: SET_ID },
    { source: SOURCE, setId: "second-set" },
  ];

  it("bulk status persists across a reload for every referenced set", async () => {
    await twoSets();
    storeSetStatuses(refs, "completed");
    const overlaid = await loadSetsWithOverlay();
    // listSetsDexie surfaces the manifest set + the cached-only "second-set".
    expect(overlaid.find((s) => s.id === SET_ID)?.status).toBe("completed");
    expect(overlaid.find((s) => s.id === "second-set")?.status).toBe(
      "completed",
    );
  });

  it("deleteSetsDexie removes every referenced set (and its files) in one transaction", async () => {
    const db = await twoSets();
    expect(await db.contentSets.count()).toBe(2);
    await deleteSetsDexie(refs);
    expect(await db.contentSets.count()).toBe(0);
    // The pilot set had one cached lesson file — it is purged too.
    const orphanFiles = await db.contentSetFiles.count();
    expect(orphanFiles).toBe(0);
  });

  it("deleteSetsDexie is a no-op for an empty list", async () => {
    await expect(deleteSetsDexie([])).resolves.toBeUndefined();
  });
});
