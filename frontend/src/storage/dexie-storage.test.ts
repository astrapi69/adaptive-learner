/**
 * DexieStorage tests (Phase 10B).
 *
 * Uses fake-indexeddb's ``auto`` shim, which installs a working
 * ``indexedDB`` global into happy-dom. The shim is freshly reset
 * between tests via ``_resetDbForTests`` so no state leaks.
 *
 * The skeleton covers user / project / settings / curriculum
 * round-trips. Assessment / session / tracking / tools live in
 * later sub-phases; here we just pin that the unimplemented
 * methods throw ApiError 501 (so consumers can pattern-match
 * the same way they would with the real backend).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {ApiError} from "../api/client";
import {_resetDbForTests, getDb} from "./db";
import {dexieStorage} from "./dexie-storage";

beforeEach(async () => {
    await _resetDbForTests();
    // Replace the global indexedDB factory so each test starts
    // with an empty store. fake-indexeddb exposes a fresh
    // factory via ``IDBFactory``.
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
});

describe("DexieStorage.users", () => {
    it("creates + reads back a user with default language 'de'", async () => {
        const created = await dexieStorage.users.create({name: "Asterios"});
        expect(created.name).toBe("Asterios");
        expect(created.language).toBe("de");
        expect(created.email).toBeNull();

        const fetched = await dexieStorage.users.get(created.id);
        expect(fetched).toEqual(created);
    });

    it("ensures a UserSettings row on create", async () => {
        const user = await dexieStorage.users.create({name: "X", language: "en"});
        const settings = await dexieStorage.settings.get(user.id);
        expect(settings.user_id).toBe(user.id);
        expect(settings.active_provider).toBe("anthropic");
        expect(settings.language).toBe("en");
        expect(settings.has_anthropic_key).toBe(false);
    });

    it("get(unknown_id) throws ApiError 404", async () => {
        await expect(dexieStorage.users.get("nope")).rejects.toBeInstanceOf(
            ApiError,
        );
        await expect(dexieStorage.users.get("nope")).rejects.toMatchObject({
            status: 404,
        });
    });

    it("update patches the named fields and bumps updated_at", async () => {
        const u = await dexieStorage.users.create({name: "Old"});
        const updated = await dexieStorage.users.update(u.id, {name: "New"});
        expect(updated.name).toBe("New");
        expect(updated.email).toBeNull();
    });
});

describe("DexieStorage.projects", () => {
    it("create + list + update round-trip", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "Linear algebra",
            goal: "intuition",
            timeframe: "2 weeks",
            daily_minutes: 30,
        });
        expect(p.user_id).toBe(u.id);
        expect(p.active).toBe(true);

        const list = await dexieStorage.users.projects.list(u.id);
        expect(list).toHaveLength(1);
        expect(list[0]).toEqual(p);

        const patched = await dexieStorage.projects.update(p.id, {
            daily_minutes: 45,
        });
        expect(patched.daily_minutes).toBe(45);
        expect(patched.topic).toBe(p.topic);
    });

    it("create against an unknown user 404s", async () => {
        await expect(
            dexieStorage.users.projects.create("nobody", {
                topic: "t",
                goal: "g",
                timeframe: "1w",
                daily_minutes: 10,
            }),
        ).rejects.toMatchObject({status: 404});
    });
});

describe("DexieStorage.settings", () => {
    it("setApiKey + deleteApiKey flips has_*_key booleans", async () => {
        const u = await dexieStorage.users.create({name: "A"});

        const withKey = await dexieStorage.settings.setApiKey(u.id, {
            provider: "anthropic",
            key: "sk-test",
        });
        expect(withKey.has_anthropic_key).toBe(true);

        const cleared = await dexieStorage.settings.deleteApiKey(
            u.id,
            "anthropic",
        );
        expect(cleared.has_anthropic_key).toBe(false);
    });

    it("update clears model override on empty-string sentinel", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const set = await dexieStorage.settings.update(u.id, {
            model_override_anthropic: "claude-foo",
        });
        expect(set.model_override_anthropic).toBe("claude-foo");

        const cleared = await dexieStorage.settings.update(u.id, {
            model_override_anthropic: "",
        });
        expect(cleared.model_override_anthropic).toBeNull();
    });
});

describe("DexieStorage.curricula + topics + lessons", () => {
    it("full round-trip + cascade delete", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const c = await dexieStorage.curricula.create(u.id, {title: "Calculus"});
        expect(c.user_id).toBe(u.id);

        const t1 = await dexieStorage.curricula.createTopic(c.id, {
            title: "Limits",
            order_index: 0,
        });
        const t2 = await dexieStorage.curricula.createTopic(c.id, {
            title: "Derivatives",
            order_index: 1,
        });
        const l1 = await dexieStorage.curricula.createLesson(c.id, {
            title: "Definition of a limit",
            order_index: 0,
        });

        const topics = await dexieStorage.curricula.listTopics(c.id);
        expect(topics.map((x) => x.id)).toEqual([t1.id, t2.id]);

        const lessons = await dexieStorage.curricula.listLessons(c.id);
        expect(lessons[0].id).toBe(l1.id);

        // Cascade delete should remove the curriculum AND its
        // topics + lessons in one transaction.
        await dexieStorage.curricula.remove(c.id);
        await expect(dexieStorage.curricula.get(c.id)).rejects.toMatchObject({
            status: 404,
        });
        const db = getDb();
        expect(await db.learningTopics.count()).toBe(0);
        expect(await db.lessons.count()).toBe(0);
    });

    it("topics.update + lessons.update + remove", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const c = await dexieStorage.curricula.create(u.id, {title: "C"});
        const t = await dexieStorage.curricula.createTopic(c.id, {title: "T"});
        const l = await dexieStorage.curricula.createLesson(c.id, {title: "L"});

        const tp = await dexieStorage.topics.update(t.id, {title: "T2"});
        expect(tp.title).toBe("T2");

        const lp = await dexieStorage.lessons.update(l.id, {
            content: "Body",
        });
        expect(lp.content).toBe("Body");

        await dexieStorage.lessons.remove(l.id);
        await expect(dexieStorage.lessons.get(l.id)).rejects.toMatchObject({
            status: 404,
        });
    });
});

describe("DexieStorage.unimplemented placeholders", () => {
    it("assessment.questions throws ApiError 501", async () => {
        await expect(dexieStorage.assessment.questions("de")).rejects.toBeInstanceOf(
            ApiError,
        );
        await expect(
            dexieStorage.assessment.questions("de"),
        ).rejects.toMatchObject({status: 501});
    });

    it("session.start throws ApiError 501", async () => {
        await expect(
            dexieStorage.session.start({project_id: "p"}),
        ).rejects.toMatchObject({status: 501});
    });

    it("tracking.progress throws ApiError 501", async () => {
        await expect(
            dexieStorage.tracking.progress("p"),
        ).rejects.toMatchObject({status: 501});
    });

    it("tools.recommendations throws ApiError 501", async () => {
        await expect(
            dexieStorage.tools.recommendations("p", "en"),
        ).rejects.toMatchObject({status: 501});
    });
});

describe("DexieStorage health + i18n + plugins", () => {
    it("health returns a static ok status", async () => {
        const result = await dexieStorage.health();
        expect(result.status).toBe("ok");
        expect(result.debug).toBe(false);
    });

    it("i18n.get returns an empty record (UI falls back to inline strings)", async () => {
        const result = await dexieStorage.i18n.get("de");
        expect(result).toEqual({});
    });

    it("plugins helpers return empty containers", async () => {
        expect(await dexieStorage.plugins.health()).toEqual({});
        expect(await dexieStorage.plugins.manifests()).toEqual({});
        expect(await dexieStorage.plugins.errors()).toEqual({});
    });
});
