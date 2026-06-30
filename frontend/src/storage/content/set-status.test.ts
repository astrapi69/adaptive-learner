/**
 * Set lifecycle status in the Dexie content cache (#1300).
 *
 * Pins: a freshly downloaded set is "active"; ``setSetStatusDexie``
 * persists a transition on the cached row(s) and survives a subsequent
 * ``listSetsDexie`` (online path rebuilds entries from the manifest, so
 * the status MUST be carried through); a re-download keeps the status;
 * a cached row written before the field existed reads back as "active"
 * (migration-equivalent default); an unknown set is a safe no-op.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  downloadSetDexie,
  listSetsDexie,
  setSetStatusDexie,
} from "./content-loader-dexie";
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

beforeEach(async () => {
  const db = getDb();
  try {
    await db.contentSets.clear();
    await db.contentSetFiles.clear();
  } catch {
    /* fresh DB */
  }
  await _resetDbForTests();
});

describe("set status (Dexie cache, #1300)", () => {
  it("defaults a freshly downloaded set to 'active'", async () => {
    const entry = await download();
    expect(entry.status).toBe("active");
    const rows = await getDb().contentSets.toArray();
    expect(rows[0].status).toBe("active");
  });

  it("setSetStatusDexie persists a transition and listSets carries it", async () => {
    await download();
    await setSetStatusDexie(SOURCE, SET_ID, "deferred");

    // Online path: listSets rebuilds the entry from the upstream manifest,
    // so the status must be threaded through from the cached row.
    installFetchMock(DOWNLOAD_ROUTES);
    const { sets } = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    const entry = sets.find((s) => s.id === SET_ID);
    expect(entry?.status).toBe("deferred");
  });

  it("preserves the status across a re-download", async () => {
    await download();
    await setSetStatusDexie(SOURCE, SET_ID, "completed");
    const reDownloaded = await download();
    expect(reDownloaded.status).toBe("completed");
  });

  it("reads a row without a status field as 'active' (migration default)", async () => {
    await download();
    // Simulate a pre-#1300 cached row: strip the status field.
    await getDb().contentSets.toCollection().modify((row) => {
      delete (row as unknown as Record<string, unknown>).status;
    });
    installFetchMock(DOWNLOAD_ROUTES);
    const { sets } = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    expect(sets.find((s) => s.id === SET_ID)?.status).toBe("active");
  });

  it("is a no-op for an unknown set (idempotent, no throw)", async () => {
    await expect(
      setSetStatusDexie(SOURCE, "does-not-exist", "deferred"),
    ).resolves.toBeUndefined();
  });
});
