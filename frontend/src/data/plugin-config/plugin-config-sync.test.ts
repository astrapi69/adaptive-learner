/**
 * Drift pin (Phase 49 / v1.32.0 / PHASE-42-STORAGE-ABSTRACTION-01):
 * the bundled JSON files under
 * ``frontend/src/data/plugin-config/`` are what
 * ``DexieStorage.pluginSettings.get`` returns as the lazy default
 * for a plugin whose IndexedDB row hasn't been created yet (i.e.
 * every fresh GH Pages user).
 *
 * Backend YAML
 * (``backend/config/plugins/{name}.yaml``) stays the canonical
 * authoring surface;
 * ``scripts/sync_plugin_config_to_frontend.py`` regenerates the
 * JSON.
 *
 * This pin asserts the invariants on the JSON side without
 * taking a YAML dep on the frontend:
 *   1. The 5 v1.31.0 plugin configs are present (drift means
 *      a new YAML was added without regeneration, or a YAML was
 *      removed without removing the JSON).
 *   2. Each file parses as a JSON object.
 *   3. The learning-repo defaults carry the keys the
 *      LearningRepoSettings UI consumes (regression pin for
 *      the 49G UI swap).
 */

import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

const JSON_DIR = join(__dirname);
// As of v1.31.0: anki, content-loader, gamification,
// learning-repo, session. Update this list any time a new
// plugin YAML lands under backend/config/plugins/.
const EXPECTED_PLUGINS = [
    "anki",
    "content-loader",
    "gamification",
    "learning-repo",
    "session",
];

function loadJson(name: string): Record<string, unknown> {
    return JSON.parse(
        readFileSync(join(JSON_DIR, `${name}.json`), "utf-8"),
    );
}

describe("plugin-config JSON bundle — Dexie-mode pluginSettings defaults", () => {
    it("ships exactly the 5 expected plugins", () => {
        const present = readdirSync(JSON_DIR)
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(/\.json$/, ""))
            .sort();
        expect(present).toEqual([...EXPECTED_PLUGINS].sort());
    });

    it.each(EXPECTED_PLUGINS)("%s.json parses as an object", (name) => {
        const data = loadJson(name);
        expect(data).toBeTruthy();
        expect(typeof data).toBe("object");
        expect(Array.isArray(data)).toBe(false);
    });

    it("learning-repo carries the v1.26.0 UI-driven defaults", () => {
        // Regression pin: the LearningRepoSettings component
        // (49G swap to storage.pluginSettings) reads these
        // exact keys; the parity here protects against a
        // YAML rename that silently breaks the UI defaults
        // path in Dexie mode.
        const repo = loadJson("learning-repo");
        expect(repo).toHaveProperty("enable_git");
        expect(typeof repo.enable_git).toBe("boolean");
        expect(repo).toHaveProperty("repos_dir");
        expect(typeof repo.repos_dir).toBe("string");
    });
});
