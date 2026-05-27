/**
 * Tests for the pluginSettings namespace (Phase 49 / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Covers:
 *
 * - ApiStorage delegates to ``api.pluginSettings.{get,update}``
 *   1:1 (the same surface ``LearningRepoSettings`` was using
 *   directly before the 49G swap).
 * - DexieStorage's lazy-defaults path: on a fresh DB the first
 *   ``get(name)`` returns the bundled YAML defaults from
 *   ``frontend/src/data/plugin-config/{name}.json``.
 * - DexieStorage's round-trip: ``update`` then ``get`` returns
 *   exactly what was written.
 * - DexieStorage's per-plugin isolation: writing
 *   ``learning-repo`` doesn't pollute ``anki``'s defaults.
 * - Unknown plugin name returns an empty defaults object
 *   (rather than throwing) so a typo in a consumer doesn't
 *   crash the Settings page.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {apiStorage} from "./api-storage";
import {_resetDbForTests, getDb} from "./db";
import {dexieStorage} from "./dexie-storage";

beforeEach(async () => {
    const db = getDb();
    try {
        await db.pluginSettings.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// --- ApiStorage delegation ----------------------------------------------

describe("apiStorage.pluginSettings", () => {
    it("get delegates to api.pluginSettings.get", async () => {
        const mockResponse = {
            plugin: "learning-repo",
            settings: {enable_git: true, repos_dir: "/tmp/foo"},
        };
        // ``api.pluginSettings.get`` calls ``apiCall`` which
        // calls ``fetch`` under the hood. Stub fetch globally
        // so the delegation is verifiable end-to-end.
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await apiStorage.pluginSettings.get("learning-repo");

        expect(result).toEqual(mockResponse);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url] = fetchMock.mock.calls[0];
        expect(url).toContain("/api/plugin-settings/learning-repo");
    });

    it("update delegates to api.pluginSettings.update with PATCH", async () => {
        const body = {settings: {enable_git: false, repos_dir: "/x"}};
        const mockResponse = {plugin: "learning-repo", ...body};
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await apiStorage.pluginSettings.update(
            "learning-repo",
            body,
        );

        expect(result).toEqual(mockResponse);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0];
        expect(init.method).toBe("PATCH");
    });
});

// --- DexieStorage lazy defaults -----------------------------------------

describe("dexieStorage.pluginSettings — lazy YAML defaults", () => {
    it("returns the bundled learning-repo defaults on a fresh DB", async () => {
        const result = await dexieStorage.pluginSettings.get("learning-repo");

        expect(result.plugin).toBe("learning-repo");
        // Defaults come from
        // backend/config/plugins/learning-repo.yaml ->
        // frontend/src/data/plugin-config/learning-repo.json
        // (drift-pinned by plugin-config-sync.test.ts).
        expect(result.settings).toMatchObject({
            enable_git: false,
            repos_dir: "~/.local/share/adaptive_learner/repos",
        });
    });

    it("returns an empty settings object for an unknown plugin", async () => {
        // Defensive contract: a typo in a consumer must NOT
        // crash the Settings page. Return ``{}`` and let the
        // consumer merge against its expected shape.
        const result = await dexieStorage.pluginSettings.get(
            "no-such-plugin",
        );

        expect(result.plugin).toBe("no-such-plugin");
        expect(result.settings).toEqual({});
    });
});

// --- DexieStorage round-trip + upsert ----------------------------------

describe("dexieStorage.pluginSettings — round-trip", () => {
    it("update writes a row that get reads back", async () => {
        const written = {enable_git: true, repos_dir: "/custom"};

        const updateResult = await dexieStorage.pluginSettings.update(
            "learning-repo",
            {settings: written},
        );
        expect(updateResult.plugin).toBe("learning-repo");
        expect(updateResult.settings).toEqual(written);

        // Second get must hit the table, NOT the YAML defaults.
        const getResult = await dexieStorage.pluginSettings.get(
            "learning-repo",
        );
        expect(getResult.settings).toEqual(written);
    });

    it("update is idempotent — second update with same body returns same shape", async () => {
        const body = {settings: {enable_git: true, repos_dir: "/x"}};
        const first = await dexieStorage.pluginSettings.update(
            "learning-repo",
            body,
        );
        const second = await dexieStorage.pluginSettings.update(
            "learning-repo",
            body,
        );
        expect(first).toEqual(second);
    });

    it("update on one plugin does NOT affect another plugin's defaults", async () => {
        await dexieStorage.pluginSettings.update("learning-repo", {
            settings: {enable_git: true, repos_dir: "/x"},
        });

        // anki was never updated — its get should still return
        // the bundled defaults, not learning-repo's overrides.
        const anki = await dexieStorage.pluginSettings.get("anki");
        expect(anki.plugin).toBe("anki");
        // anki has its own bundle (or {} if it has no settings:
        // block). Either way, it must NOT contain
        // learning-repo's keys.
        expect(anki.settings).not.toHaveProperty("repos_dir");
    });

    it("subsequent update overwrites the previous row", async () => {
        await dexieStorage.pluginSettings.update("learning-repo", {
            settings: {enable_git: false, repos_dir: "/old"},
        });
        await dexieStorage.pluginSettings.update("learning-repo", {
            settings: {enable_git: true, repos_dir: "/new"},
        });

        const result = await dexieStorage.pluginSettings.get(
            "learning-repo",
        );
        expect(result.settings).toEqual({
            enable_git: true,
            repos_dir: "/new",
        });
    });
});
