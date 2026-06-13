/**
 * Concurrency regression pins for the #390 Class-B fixes (Phase 3).
 *
 * Class B is the full-replace ``get(id) -> {...row, ...patch} -> put(id)``
 * update. Two concurrent edits to the same row each read the same base
 * snapshot and write back their own field, so the slower writer drops the
 * other's change (last-writer-wins). Each pin fires two ``update`` calls
 * that set DIFFERENT fields via ``Promise.all`` and asserts BOTH survive.
 *
 * Every pin is RED on the pre-fix code and GREEN once the get+spread+put
 * is wrapped in a ``db.transaction("rw", table)`` — inside one
 * transaction each writer reads the latest committed row, so it only
 * overwrites its own field.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb, nowIso} from "./db";
import {dexieCurricula, dexieLessons, dexieTopics} from "./dexie-curricula";
import {dexieProjects, dexieUsers} from "./dexie-users";
import {dexieSettings} from "./dexie-settings";
import {dexieSubjects, dexieTags} from "./dexie-taxonomy";
import {dexieImports} from "./dexie-imports";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

const ts = () => nowIso();

describe("#390 Class B — concurrent full-replace edits keep both fields", () => {
    it("lessons.update (TipTap autosave vs manual save)", async () => {
        const db = getDb();
        await db.lessons.put({
            id: "l1",
            curriculum_id: "c1",
            title: "orig",
            content: "orig",
            order_index: 0,
            created_at: ts(),
            updated_at: ts(),
        });
        await Promise.all([
            dexieLessons.update("l1", {title: "T"}),
            dexieLessons.update("l1", {content: "C"}),
        ]);
        const row = await db.lessons.get("l1");
        expect(row!.title).toBe("T");
        expect(row!.content).toBe("C");
    });

    it("curricula.update", async () => {
        const db = getDb();
        await db.curricula.put({
            id: "c1",
            user_id: "u1",
            title: "orig",
            description: "orig",
            language: "en",
            created_at: ts(),
            updated_at: ts(),
            imported_conversation_id: null,
        });
        await Promise.all([
            dexieCurricula.update("c1", {title: "T"}),
            dexieCurricula.update("c1", {description: "D"}),
        ]);
        const row = await db.curricula.get("c1");
        expect(row!.title).toBe("T");
        expect(row!.description).toBe("D");
    });

    it("topics.update", async () => {
        const db = getDb();
        await db.learningTopics.put({
            id: "t1",
            curriculum_id: "c1",
            parent_id: null,
            title: "orig",
            description: "orig",
            order_index: 0,
            created_at: ts(),
            updated_at: ts(),
        });
        await Promise.all([
            dexieTopics.update("t1", {title: "T"}),
            dexieTopics.update("t1", {description: "D"}),
        ]);
        const row = await db.learningTopics.get("t1");
        expect(row!.title).toBe("T");
        expect(row!.description).toBe("D");
    });

    it("projects.update", async () => {
        const db = getDb();
        await db.learningProjects.put({
            id: "p1",
            user_id: "u1",
            topic: "orig",
            goal: "orig",
            timeframe: "1m",
            daily_minutes: 10,
            current_problem: null,
            active: true,
            kind: "standard",
            created_at: ts(),
            updated_at: ts(),
        });
        await Promise.all([
            dexieProjects.update("p1", {topic: "T"}),
            dexieProjects.update("p1", {goal: "G"}),
        ]);
        const row = await db.learningProjects.get("p1");
        expect(row!.topic).toBe("T");
        expect(row!.goal).toBe("G");
    });

    it("users.update", async () => {
        const db = getDb();
        await db.users.put({
            id: "u1",
            name: "orig",
            email: null,
            language: "en",
            created_at: ts(),
            updated_at: ts(),
        });
        await Promise.all([
            dexieUsers.update("u1", {name: "N"}),
            dexieUsers.update("u1", {language: "de"}),
        ]);
        const row = await db.users.get("u1");
        expect(row!.name).toBe("N");
        expect(row!.language).toBe("de");
    });

    it("subjects.update", async () => {
        const db = getDb();
        await db.subjects.put({
            id: "s1",
            parent_id: null,
            name: "orig",
            description: "orig",
            icon: null,
            created_at: ts(),
            updated_at: ts(),
        });
        await Promise.all([
            dexieSubjects.update("s1", {name: "N"}),
            dexieSubjects.update("s1", {description: "D"}),
        ]);
        const row = await db.subjects.get("s1");
        expect(row!.name).toBe("N");
        expect(row!.description).toBe("D");
    });

    it("tags.update", async () => {
        const db = getDb();
        await db.tags.put({
            id: "tg1",
            user_id: "u1",
            name: "orig",
            color: null,
            created_at: ts(),
        });
        await Promise.all([
            dexieTags.update("tg1", {name: "N"}),
            dexieTags.update("tg1", {color: "red"}),
        ]);
        const row = await db.tags.get("tg1");
        expect(row!.name).toBe("N");
        expect(row!.color).toBe("red");
    });

    it("settings.update vs setApiKey", async () => {
        const db = getDb();
        await db.users.put({
            id: "u1",
            name: "T",
            email: null,
            language: "en",
            created_at: ts(),
            updated_at: ts(),
        });
        await db.userSettings.put({
            id: "set1",
            user_id: "u1",
            language: "en",
            active_provider: "anthropic",
            api_key_anthropic: null,
            api_key_openai: null,
            api_key_gemini: null,
            model_override_anthropic: null,
            model_override_openai: null,
            model_override_gemini: null,
            created_at: ts(),
            updated_at: ts(),
        });
        await Promise.all([
            dexieSettings.update("u1", {language: "de"}),
            dexieSettings.setApiKey("u1", {provider: "anthropic", key: "sk-x"}),
        ]);
        const settings = await dexieSettings.get("u1");
        expect(settings.language).toBe("de");
        expect(settings.has_anthropic_key).toBe(true);
    });

    it("imports.update", async () => {
        const db = getDb();
        await db.importedConversations.put({
            id: "ic1",
            user_id: "u1",
            project_id: null,
            source: "chatgpt",
            title: "orig",
            message_count: 1,
            imported_at: ts(),
            analyzed: false,
            analysis_result: null,
            topic_tag: null,
            model: null,
            source_created_at: null,
            content_hash: null,
            source_language: null,
            target_language: null,
        });
        await Promise.all([
            dexieImports.update("ic1", {title: "T"}),
            dexieImports.update("ic1", {topic_tag: "TAG"}),
        ]);
        const row = await db.importedConversations.get("ic1");
        expect(row!.title).toBe("T");
        expect(row!.topic_tag).toBe("TAG");
    });
});
