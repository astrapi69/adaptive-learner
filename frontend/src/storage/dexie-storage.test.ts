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

describe("DexieStorage.assessment", () => {
    it("questions resolves the 12-pack locally", async () => {
        const qs = await dexieStorage.assessment.questions("de");
        expect(qs).toHaveLength(12);
        expect(qs[0].id).toBe("q01");
    });

    it("evaluate creates a profile + profile() reads it back", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const profile = await dexieStorage.assessment.evaluate({
            project_id: p.id,
            answers: [{question_id: "q01", answer_id: "a"}],
        });
        expect(profile.project_id).toBe(p.id);
        expect(profile.user_id).toBe(u.id);
        expect(profile.deductive).toBeCloseTo(0.0833, 4);
        expect(profile.version).toBe(1);
        expect(profile.dominant_method).toBe("deductive");

        const re = await dexieStorage.assessment.profile(p.id);
        expect(re.id).toBe(profile.id);
    });

    it("re-evaluating bumps version and reuses the same row", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const v1 = await dexieStorage.assessment.evaluate({
            project_id: p.id,
            answers: [{question_id: "q01", answer_id: "a"}],
        });
        const v2 = await dexieStorage.assessment.evaluate({
            project_id: p.id,
            answers: [{question_id: "q01", answer_id: "c"}],
        });
        expect(v2.id).toBe(v1.id);
        expect(v2.version).toBe(2);
        expect(v2.deductive).toBe(0);
        expect(v2.error_based).toBeCloseTo(0.0833, 4);
    });

    it("profile() 404s when no evaluation has been run", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        await expect(
            dexieStorage.assessment.profile(p.id),
        ).rejects.toMatchObject({status: 404});
    });

    it("evaluate against unknown project 404s", async () => {
        await expect(
            dexieStorage.assessment.evaluate({
                project_id: "nope",
                answers: [{question_id: "q01", answer_id: "a"}],
            }),
        ).rejects.toMatchObject({status: 404});
    });
});

describe("DexieStorage.tracking + tools (empty project)", () => {
    it("tracking.progress returns an empty namespace for a fresh project", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const summary = await dexieStorage.tracking.progress(p.id);
        expect(summary.tracking?.total_sessions).toBe(0);
        expect(summary.tracking?.total_minutes).toBe(0);
        expect(summary.tracking?.streak_days).toBe(0);
        expect(summary.tracking?.method_distribution).toHaveLength(6);
    });

    it("tracking.commits returns [] for fresh project", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const list = await dexieStorage.tracking.commits(p.id);
        expect(list).toEqual([]);
    });

    it("tools.recommendations works without a profile (zero scores, authored order)", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const recs = await dexieStorage.tools.recommendations(p.id, "en");
        expect(recs).toHaveLength(5);
        expect(recs[0].name).toBe("Anki");
        for (const r of recs) expect(r.score).toBe(0);
    });

    it("tools.spaced is empty without a profile", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        expect(await dexieStorage.tools.spaced(p.id, "en")).toEqual([]);
    });
});

describe("DexieStorage health + i18n + plugins", () => {
    it("health returns a static ok status", async () => {
        const result = await dexieStorage.health();
        expect(result.status).toBe("ok");
        expect(result.debug).toBe(false);
    });

    it("i18n.get returns the bundled JSON catalog for the requested language", async () => {
        // v1.16.0 / Phase 29F hotfix — Dexie mode used to return
        // ``{}`` and rely on ``fallbacks.ts``, which only carried
        // 79 of 542 keys. The bundled catalogs under
        // ``frontend/src/data/i18n/`` now back this path so GH
        // Pages users see translated text instead of raw keys.
        const result = await dexieStorage.i18n.get("de");
        expect(Object.keys(result).length).toBeGreaterThan(0);
        // Pin the keys that motivated the hotfix (raw
        // ``dashboard.quick_start_subtitle`` bug + gamification
        // section).
        expect(
            (result.dashboard as Record<string, unknown>).quick_start_subtitle,
        ).toBeTruthy();
        expect(result.gamification).toBeTruthy();
    });

    it("i18n.get falls back to en.json for an unknown language", async () => {
        const unknown = await dexieStorage.i18n.get("xx");
        const en = await dexieStorage.i18n.get("en");
        expect(unknown).toEqual(en);
    });

    it("plugins helpers return empty containers", async () => {
        expect(await dexieStorage.plugins.health()).toEqual({});
        expect(await dexieStorage.plugins.manifests()).toEqual({});
        expect(await dexieStorage.plugins.errors()).toEqual({});
    });
});

describe("DexieStorage imports (Phase 12C)", () => {
    async function makeUser() {
        return await dexieStorage.users.create({name: "Aster"});
    }

    function body(overrides: Record<string, unknown> = {}) {
        return {
            source: "chatgpt" as const,
            title: "Anonymised sample",
            messages: [
                {role: "user" as const, content: "Explain induction"},
                {role: "assistant" as const, content: "Induction generalises..."},
            ],
            ...overrides,
        };
    }

    it("create + get round-trip preserves messages and order", async () => {
        const u = await makeUser();
        const created = await dexieStorage.imports.create(u.id, body());
        expect(created.source).toBe("chatgpt");
        expect(created.message_count).toBe(2);
        const detail = await dexieStorage.imports.get(created.id);
        expect(detail.messages.length).toBe(2);
        expect(detail.messages[0]?.order_index).toBe(0);
        expect(detail.messages[1]?.role).toBe("assistant");
    });

    it("create rejects when messages list is empty", async () => {
        const u = await makeUser();
        await expect(
            dexieStorage.imports.create(u.id, body({messages: []})),
        ).rejects.toBeInstanceOf(ApiError);
    });

    it("create 404s on unknown user", async () => {
        await expect(
            dexieStorage.imports.create("bogus", body()),
        ).rejects.toMatchObject({status: 404});
    });

    it("create 400s on cross-user project assignment", async () => {
        const alice = await dexieStorage.users.create({name: "Alice"});
        const bob = await dexieStorage.users.create({name: "Bob"});
        const bobProject = await dexieStorage.users.projects.create(bob.id, {
            topic: "x",
            goal: "y",
            timeframe: "1w",
            daily_minutes: 5,
        });
        await expect(
            dexieStorage.imports.create(
                alice.id,
                body({project_id: bobProject.id}),
            ),
        ).rejects.toMatchObject({status: 400});
    });

    it("list returns user's conversations newest first", async () => {
        const u = await makeUser();
        // Distinct message content per call so the Phase 36 Bug 1
        // content-hash dedup does not collapse the two imports.
        const first = await dexieStorage.imports.create(
            u.id,
            body({
                title: "First",
                messages: [
                    {role: "user" as const, content: "topic 1 q"},
                    {role: "assistant" as const, content: "topic 1 a"},
                ],
            }),
        );
        await new Promise((r) => setTimeout(r, 5));
        const second = await dexieStorage.imports.create(
            u.id,
            body({
                title: "Second",
                messages: [
                    {role: "user" as const, content: "topic 2 q"},
                    {role: "assistant" as const, content: "topic 2 a"},
                ],
            }),
        );
        const listing = await dexieStorage.imports.list(u.id);
        expect(listing.map((c) => c.id)).toEqual([second.id, first.id]);
    });

    it("creates with a 64-char content_hash (Phase 36 Bug 1)", async () => {
        const u = await makeUser();
        const created = await dexieStorage.imports.create(u.id, body());
        expect(created.content_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("re-import collides on hash and surfaces 409 + existing_id (Phase 36 Bug 1)", async () => {
        const u = await makeUser();
        const first = await dexieStorage.imports.create(u.id, body());
        await expect(
            dexieStorage.imports.create(u.id, body({title: "Different title"})),
        ).rejects.toMatchObject({
            status: 409,
            extra: {existing_id: first.id},
        });
    });

    it("dedup is scoped per-user (Phase 36 Bug 1)", async () => {
        const alice = await dexieStorage.users.create({name: "Alice"});
        const bob = await dexieStorage.users.create({name: "Bob"});
        const a = await dexieStorage.imports.create(alice.id, body());
        const b = await dexieStorage.imports.create(bob.id, body());
        expect(a.content_hash).toBe(b.content_hash);
        expect(a.id).not.toBe(b.id);
    });

    it("update can assign a topic_tag", async () => {
        const u = await makeUser();
        const conv = await dexieStorage.imports.create(u.id, body());
        const updated = await dexieStorage.imports.update(conv.id, {
            topic_tag: "philosophy",
        });
        expect(updated.topic_tag).toBe("philosophy");
    });

    it("update rejects cross-user project", async () => {
        const alice = await dexieStorage.users.create({name: "Alice"});
        const bob = await dexieStorage.users.create({name: "Bob"});
        const bobProject = await dexieStorage.users.projects.create(bob.id, {
            topic: "x",
            goal: "y",
            timeframe: "1w",
            daily_minutes: 5,
        });
        const aliceConv = await dexieStorage.imports.create(alice.id, body());
        await expect(
            dexieStorage.imports.update(aliceConv.id, {project_id: bobProject.id}),
        ).rejects.toMatchObject({status: 400});
    });

    it("remove drops the conversation and cascade-deletes messages", async () => {
        const u = await makeUser();
        const conv = await dexieStorage.imports.create(u.id, body());
        await dexieStorage.imports.remove(conv.id);
        await expect(dexieStorage.imports.get(conv.id)).rejects.toMatchObject({
            status: 404,
        });
        const db = getDb();
        const leftover = await db.importedMessages
            .where("conversation_id")
            .equals(conv.id)
            .count();
        expect(leftover).toBe(0);
    });

    it("saveAnalysis sets analyzed=true and persists the blob", async () => {
        const u = await makeUser();
        const conv = await dexieStorage.imports.create(u.id, body());
        const analysis = {
            topic: "Induction",
            user_level: "beginner" as const,
            recommended_method: "inductive" as const,
        };
        const detail = await dexieStorage.imports.saveAnalysis(conv.id, {
            analysis_result: analysis,
        });
        expect(detail.analyzed).toBe(true);
        expect(detail.analysis_result?.topic).toBe("Induction");
        const reread = await dexieStorage.imports.get(conv.id);
        expect(reread.analyzed).toBe(true);
        expect(reread.analysis_result?.recommended_method).toBe("inductive");
    });
});

describe("DexieStorage taxonomy (Phase 22C)", () => {
    async function makeUser() {
        return await dexieStorage.users.create({name: "Tagger"});
    }

    async function makeProject(userId: string) {
        return await dexieStorage.users.projects.create(userId, {
            topic: "Spanish Grammar",
            goal: "Master conversational Spanish",
            timeframe: "3 months",
            daily_minutes: 30,
        });
    }

    describe("subjects", () => {
        it("create + list returns sorted by name", async () => {
            await dexieStorage.subjects.create({name: "Zebra"});
            await dexieStorage.subjects.create({name: "Alpha"});
            const list = await dexieStorage.subjects.list();
            expect(list.map((s) => s.name)).toEqual(["Alpha", "Zebra"]);
        });

        it("create under parent links parent_id", async () => {
            const parent = await dexieStorage.subjects.create({name: "Math"});
            const child = await dexieStorage.subjects.create({
                name: "Algebra",
                parent_id: parent.id,
            });
            expect(child.parent_id).toBe(parent.id);
        });

        it("rejects create with unknown parent", async () => {
            await expect(
                dexieStorage.subjects.create({
                    name: "Orphan",
                    parent_id: "nope",
                }),
            ).rejects.toBeInstanceOf(ApiError);
        });

        it("rejects update making subject its own parent", async () => {
            const s = await dexieStorage.subjects.create({name: "Self"});
            await expect(
                dexieStorage.subjects.update(s.id, {parent_id: s.id}),
            ).rejects.toBeInstanceOf(ApiError);
        });

        it("remove detaches children (SET NULL semantics)", async () => {
            const parent = await dexieStorage.subjects.create({name: "Parent"});
            const child = await dexieStorage.subjects.create({
                name: "Child",
                parent_id: parent.id,
            });
            await dexieStorage.subjects.remove(parent.id);
            const refreshed = await dexieStorage.subjects.get(child.id);
            expect(refreshed.parent_id).toBeNull();
        });
    });

    describe("tags", () => {
        it("create + list scopes to user", async () => {
            const u = await makeUser();
            await dexieStorage.tags.create(u.id, {name: "exam-prep"});
            await dexieStorage.tags.create(u.id, {name: "daily"});
            const list = await dexieStorage.tags.list(u.id);
            expect(list.map((t) => t.name)).toEqual(["daily", "exam-prep"]);
        });

        it("rejects duplicate name per user", async () => {
            const u = await makeUser();
            await dexieStorage.tags.create(u.id, {name: "dup"});
            await expect(
                dexieStorage.tags.create(u.id, {name: "dup"}),
            ).rejects.toBeInstanceOf(ApiError);
        });

        it("same name across two users is allowed", async () => {
            const a = await makeUser();
            const b = await dexieStorage.users.create({name: "Other"});
            await dexieStorage.tags.create(a.id, {name: "shared"});
            await dexieStorage.tags.create(b.id, {name: "shared"});
            expect((await dexieStorage.tags.list(a.id)).length).toBe(1);
            expect((await dexieStorage.tags.list(b.id)).length).toBe(1);
        });

        it("rename rejects collision", async () => {
            const u = await makeUser();
            await dexieStorage.tags.create(u.id, {name: "tag-a"});
            const second = await dexieStorage.tags.create(u.id, {name: "tag-b"});
            await expect(
                dexieStorage.tags.update(second.id, {name: "tag-a"}),
            ).rejects.toBeInstanceOf(ApiError);
        });

        it("remove deletes associations too", async () => {
            const u = await makeUser();
            const project = await makeProject(u.id);
            const tag = await dexieStorage.tags.create(u.id, {name: "trans"});
            await dexieStorage.projectTaxonomy.assignTag(project.id, tag.id);
            expect(
                (await dexieStorage.projectTaxonomy.listTags(project.id)).length,
            ).toBe(1);
            await dexieStorage.tags.remove(tag.id);
            expect(
                (await dexieStorage.projectTaxonomy.listTags(project.id)).length,
            ).toBe(0);
        });
    });

    describe("projectTaxonomy", () => {
        it("assign + list subjects round-trip", async () => {
            const u = await makeUser();
            const project = await makeProject(u.id);
            const subject = await dexieStorage.subjects.create({name: "S1"});
            await dexieStorage.projectTaxonomy.assignSubject(
                project.id,
                subject.id,
            );
            const list = await dexieStorage.projectTaxonomy.listSubjects(
                project.id,
            );
            expect(list.length).toBe(1);
            expect(list[0]?.id).toBe(subject.id);
        });

        it("assignSubject twice is idempotent", async () => {
            const u = await makeUser();
            const project = await makeProject(u.id);
            const subject = await dexieStorage.subjects.create({name: "Idemp"});
            await dexieStorage.projectTaxonomy.assignSubject(
                project.id,
                subject.id,
            );
            await dexieStorage.projectTaxonomy.assignSubject(
                project.id,
                subject.id,
            );
            const list = await dexieStorage.projectTaxonomy.listSubjects(
                project.id,
            );
            expect(list.length).toBe(1);
        });

        it("unassignSubject removes the association only", async () => {
            const u = await makeUser();
            const project = await makeProject(u.id);
            const subject = await dexieStorage.subjects.create({name: "X"});
            await dexieStorage.projectTaxonomy.assignSubject(
                project.id,
                subject.id,
            );
            await dexieStorage.projectTaxonomy.unassignSubject(
                project.id,
                subject.id,
            );
            const list = await dexieStorage.projectTaxonomy.listSubjects(
                project.id,
            );
            expect(list).toEqual([]);
            // The Subject itself survives.
            expect(await dexieStorage.subjects.get(subject.id)).toBeDefined();
        });

        it("assignTag rejects cross-user mismatch", async () => {
            const a = await makeUser();
            const b = await dexieStorage.users.create({name: "Other"});
            const projectA = await makeProject(a.id);
            const tagB = await dexieStorage.tags.create(b.id, {name: "leak"});
            await expect(
                dexieStorage.projectTaxonomy.assignTag(projectA.id, tagB.id),
            ).rejects.toBeInstanceOf(ApiError);
        });
    });
});
