/**
 * Connected repositories, redeemed invites and the Learning Repository
 * switch travel with the backup (#3412).
 *
 * They live in plugin settings, which neither backup carried, so after
 * Export -> new device -> Import the sets came back without their sources:
 * updates and sync stopped and invite access was lost.
 */

import {describe, expect, it} from "vitest";

import {
    PLUGIN_SETTINGS_BACKUP_KEYS,
    capturePluginSettingsSnapshot,
    restorePluginSettingsSnapshot,
    type PluginSettingsStore,
} from "./pluginSettingsSnapshot";

function memoryStore(initial: Record<string, Record<string, unknown>>): PluginSettingsStore & {
    data: Record<string, Record<string, unknown>>;
    writes: string[];
} {
    const data = structuredClone(initial);
    const writes: string[] = [];
    return {
        data,
        writes,
        get: async (name) => ({plugin: name, settings: structuredClone(data[name] ?? {})}),
        update: async (name, body) => {
            writes.push(name);
            data[name] = structuredClone(body.settings);
            return {plugin: name, settings: body.settings};
        },
    };
}

const REPO_A = {url: "https://github.com/a/one", owner: "a", repo: "one", branch: "main", connected: true, last_synced: null, set_count: 2, lesson_count: 9};
const REPO_B = {url: "https://github.com/b/two", owner: "b", repo: "two", branch: "main", connected: true, last_synced: null, set_count: 1, lesson_count: 3};

describe("capturePluginSettingsSnapshot (#3412)", () => {
    it("carries only the listed user keys of each plugin", async () => {
        const store = memoryStore({
            "content-loader": {
                user_repos: [REPO_A],
                invite_redemptions: [{code: "ABC", repo: "a/one", redeemed_at: "2026-10-01T00:00:00Z"}],
                sources: ["bundled:x"],
            },
            "learning-repo": {enable_git: true, repos_dir: "/home/me/repos"},
        });

        const snapshot = await capturePluginSettingsSnapshot(store);

        expect(snapshot).toEqual({
            "content-loader": {
                user_repos: [REPO_A],
                invite_redemptions: [{code: "ABC", repo: "a/one", redeemed_at: "2026-10-01T00:00:00Z"}],
            },
            "learning-repo": {enable_git: true},
        });
    });

    it("never carries the Learning Repository folder, a path on this device", () => {
        expect(PLUGIN_SETTINGS_BACKUP_KEYS["learning-repo"]).not.toContain("repos_dir");
    });

    it("leaves out a plugin whose settings cannot be read", async () => {
        const store = memoryStore({"learning-repo": {enable_git: false}});
        store.get = async (name) => {
            if (name === "content-loader") throw new Error("offline");
            return {plugin: name, settings: {enable_git: false}};
        };

        expect(await capturePluginSettingsSnapshot(store)).toEqual({"learning-repo": {enable_git: false}});
    });
});

describe("restorePluginSettingsSnapshot (#3412)", () => {
    it("adds the backup's repos and invites to the local ones, matched by identity", async () => {
        const store = memoryStore({
            "content-loader": {
                user_repos: [{...REPO_A, set_count: 5}],
                invite_redemptions: [{code: "OLD", repo: "a/one", redeemed_at: "2026-09-01T00:00:00Z"}],
                sources: ["bundled:x"],
            },
        });

        await restorePluginSettingsSnapshot(
            {
                "content-loader": {
                    user_repos: [{...REPO_A, owner: "A"}, REPO_B],
                    invite_redemptions: [
                        {code: "OLD", repo: "a/one", redeemed_at: "2026-09-01T00:00:00Z"},
                        {code: "NEW", repo: "b/two", redeemed_at: "2026-10-01T00:00:00Z"},
                    ],
                },
            },
            store,
        );

        const settings = store.data["content-loader"];
        expect((settings.user_repos as {repo: string; set_count: number}[]).map((r) => [r.repo, r.set_count])).toEqual([
            ["one", 5],
            ["two", 1],
        ]);
        expect((settings.invite_redemptions as {code: string}[]).map((r) => r.code)).toEqual(["OLD", "NEW"]);
        expect(settings.sources).toEqual(["bundled:x"]);
    });

    it("sets a backup scalar and keeps the device-local folder", async () => {
        const store = memoryStore({"learning-repo": {enable_git: false, repos_dir: "/here"}});

        await restorePluginSettingsSnapshot({"learning-repo": {enable_git: true, repos_dir: "/there"}}, store);

        expect(store.data["learning-repo"]).toEqual({enable_git: true, repos_dir: "/here"});
    });

    it.each([
        ["no block", undefined],
        ["an empty block", {}],
        ["a block with unknown plugins only", {"some-plugin": {x: 1}}],
    ])("writes nothing for %s", async (_label, snapshot) => {
        const store = memoryStore({"content-loader": {user_repos: [REPO_A]}});

        const applied = await restorePluginSettingsSnapshot(snapshot, store);

        expect(applied).toEqual([]);
        expect(store.writes).toEqual([]);
    });

    it("reports the plugins it wrote", async () => {
        const store = memoryStore({});

        const applied = await restorePluginSettingsSnapshot(
            {"content-loader": {user_repos: [REPO_B]}, "learning-repo": {enable_git: true}},
            store,
        );

        expect(applied).toEqual(["content-loader", "learning-repo"]);
    });
});
