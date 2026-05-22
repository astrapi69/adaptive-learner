/**
 * Tests for the Dexie-mode export builder (Phase 16A).
 *
 * Mirrors backend/tests/test_export_service.py so the same data
 * produces the same export shape in both storage modes.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
    EXPORT_FORMAT,
    EXPORT_VERSION,
    buildCurriculumOverview,
    buildProgressReport,
    buildSessionDetail,
} from "./export-builder";
import {_resetDbForTests, getDb, newId, nowIso} from "./db";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
});

async function seedUser(name = "Aster") {
    const db = getDb();
    const userId = newId();
    await db.users.add({
        id: userId,
        name,
        email: null,
        language: "de",
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return userId;
}

async function seedProject(userId: string, topic = "Bayes-Statistik") {
    const db = getDb();
    const projectId = newId();
    await db.learningProjects.add({
        id: projectId,
        user_id: userId,
        topic,
        goal: "Master it",
        timeframe: "2 weeks",
        daily_minutes: 30,
        current_problem: "Math basics",
        active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
    });
    return projectId;
}

async function seedSessionWithRating(
    projectId: string,
    method = "deductive",
    startedAt = "2026-05-01T10:00:00.000Z",
    endedAt: string | null = "2026-05-01T10:30:00.000Z",
) {
    const db = getDb();
    const sessionId = newId();
    await db.learningSessions.add({
        id: sessionId,
        project_id: projectId,
        method: method as never,
        started_at: startedAt,
        ended_at: endedAt,
        cycle_step: 7,
        status: "completed" as never,
    });
    await db.sessionMessages.add({
        id: newId(),
        session_id: sessionId,
        role: "user" as never,
        content: "Hello",
        created_at: startedAt,
    });
    await db.sessionMessages.add({
        id: newId(),
        session_id: sessionId,
        role: "assistant" as never,
        content: "Hi",
        created_at: endedAt ?? startedAt,
    });
    await db.sessionRatings.add({
        id: newId(),
        session_id: sessionId,
        understanding: 4,
        stress: 2,
        method_fit: 5,
        notes: "Felt clear",
        created_at: endedAt ?? startedAt,
    });
    await db.progressCommits.add({
        id: newId(),
        project_id: projectId,
        session_id: sessionId,
        method: method as never,
        understanding: 0.8,
        stress: 0.2,
        error_rate: 0.1,
        duration_minutes: 30,
        committed_at: endedAt ?? startedAt,
    });
    return sessionId;
}

describe("buildProgressReport", () => {
    it("envelope carries the export version + type", async () => {
        const userId = await seedUser();
        const payload = await buildProgressReport(getDb(), userId);
        expect(payload.format).toBe(EXPORT_FORMAT);
        expect(payload.version).toBe(EXPORT_VERSION);
        expect(payload.type).toBe("progress_report");
        expect(payload.lang).toBe("de");
        expect(payload.generated_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it("respects lang argument", async () => {
        const userId = await seedUser();
        const payload = await buildProgressReport(getDb(), userId, "en");
        expect(payload.lang).toBe("en");
    });

    it("throws when the user does not exist", async () => {
        await expect(
            buildProgressReport(getDb(), "missing-id"),
        ).rejects.toThrow(/not found/);
    });

    it("returns empty collections for a user with no data", async () => {
        const userId = await seedUser();
        const payload = await buildProgressReport(getDb(), userId);
        expect(payload.user.id).toBe(userId);
        expect(payload.profile).toBeNull();
        expect(payload.projects).toEqual([]);
        expect(payload.recent_sessions).toEqual([]);
        expect(payload.step_evaluation_insights).toBeNull();
        expect(payload.extractions).toEqual([]);
    });

    it("picks the most recent profile when there are multiple", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        const db = getDb();
        await db.learningProfiles.add({
            id: newId(),
            user_id: userId,
            project_id: projectId,
            deductive: 0.1,
            inductive: 0.0,
            error_based: 0.0,
            dialogic: 0.0,
            contextual: 0.0,
            ai_adaptive: 0.0,
            assessed_at: "2026-01-01T00:00:00.000Z",
            version: 1,
        });
        await db.learningProfiles.add({
            id: newId(),
            user_id: userId,
            project_id: projectId,
            deductive: 0.0,
            inductive: 0.9,
            error_based: 0.0,
            dialogic: 0.0,
            contextual: 0.0,
            ai_adaptive: 0.0,
            assessed_at: "2026-05-01T00:00:00.000Z",
            version: 2,
        });
        const payload = await buildProgressReport(db, userId);
        expect(payload.profile?.version).toBe(2);
        expect(payload.profile?.inductive).toBe(0.9);
        expect(payload.profile?.dominant_method).toBe("inductive");
    });

    it("aggregates per-project session count + method distribution", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        await seedSessionWithRating(projectId);
        const payload = await buildProgressReport(getDb(), userId);
        expect(payload.projects).toHaveLength(1);
        const project = payload.projects[0];
        expect(project.session_count).toBe(1);
        expect(project.total_minutes).toBe(30);
        expect(project.mean_understanding).toBe(0.8);
        const deductive = project.method_distribution.find(
            (e) => e.method === "deductive",
        );
        expect(deductive?.count).toBe(1);
        expect(deductive?.percentage).toBe(100);
        const inductive = project.method_distribution.find(
            (e) => e.method === "inductive",
        );
        expect(inductive?.count).toBe(0);
    });

    it("returns recent sessions newest first with project topic", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        await seedSessionWithRating(
            projectId,
            "deductive",
            "2026-05-01T10:00:00.000Z",
            "2026-05-01T10:30:00.000Z",
        );
        await seedSessionWithRating(
            projectId,
            "inductive",
            "2026-05-02T10:00:00.000Z",
            "2026-05-02T10:15:00.000Z",
        );
        const payload = await buildProgressReport(getDb(), userId);
        expect(payload.recent_sessions[0].started_at).toBe(
            "2026-05-02T10:00:00.000Z",
        );
        expect(payload.recent_sessions[0].project_topic).toBe(
            "Bayes-Statistik",
        );
        expect(payload.recent_sessions[1].started_at).toBe(
            "2026-05-01T10:00:00.000Z",
        );
    });

    it("includes only analyzed conversations in extractions", async () => {
        const userId = await seedUser();
        const db = getDb();
        await db.importedConversations.add({
            id: newId(),
            user_id: userId,
            project_id: null,
            source: "claude",
            title: "Analyzed",
            message_count: 5,
            imported_at: "2026-05-02T00:00:00.000Z",
            analyzed: true,
            analysis_result: {topic: "Bayes"},
            topic_tag: "bayes",
            model: null,
            source_created_at: null,
            content_hash: null,
        });
        await db.importedConversations.add({
            id: newId(),
            user_id: userId,
            project_id: null,
            source: "chatgpt",
            title: "Pending",
            message_count: 3,
            imported_at: "2026-05-03T00:00:00.000Z",
            analyzed: false,
            analysis_result: null,
            topic_tag: null,
            model: null,
            source_created_at: null,
            content_hash: null,
        });
        const payload = await buildProgressReport(db, userId);
        expect(payload.extractions).toHaveLength(1);
        expect(payload.extractions[0].title).toBe("Analyzed");
        expect((payload.extractions[0].analysis as Record<string, unknown>).topic).toBe(
            "Bayes",
        );
    });
});

describe("buildSessionDetail", () => {
    it("throws when the session does not exist", async () => {
        await expect(
            buildSessionDetail(getDb(), "missing-id"),
        ).rejects.toThrow(/not found/);
    });

    it("returns session + project + messages + rating", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        const sessionId = await seedSessionWithRating(projectId);
        const payload = await buildSessionDetail(getDb(), sessionId);
        expect(payload.type).toBe("session_detail");
        expect(payload.session.method).toBe("deductive");
        expect(payload.session.duration_minutes).toBe(30);
        expect(payload.project?.topic).toBe("Bayes-Statistik");
        expect(payload.messages).toHaveLength(2);
        expect(payload.messages[0].role).toBe("user");
        expect(payload.rating?.understanding).toBe(4);
    });

    it("returns nulls for active sessions without rating", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        const db = getDb();
        const sessionId = newId();
        await db.learningSessions.add({
            id: sessionId,
            project_id: projectId,
            method: "inductive" as never,
            started_at: "2026-05-01T10:00:00.000Z",
            ended_at: null,
            cycle_step: 2,
            status: "active" as never,
        });
        const payload = await buildSessionDetail(db, sessionId);
        expect(payload.rating).toBeNull();
        expect(payload.messages).toEqual([]);
        expect(payload.step_evaluations).toEqual([]);
        expect(payload.session.duration_minutes).toBe(0);
    });

    it("normalises step_evaluation field names to backend shape", async () => {
        const userId = await seedUser();
        const projectId = await seedProject(userId);
        const sessionId = await seedSessionWithRating(projectId);
        const db = getDb();
        await db.stepEvaluations.add({
            id: newId(),
            session_id: sessionId,
            from_step: 3,
            // v1.8.0 / Phase 21A — column rename for sync parity.
            to_step: 4,
            advance: true,
            applied: true,
            confidence: 0.85,
            reason: "Step understood",
            fallback_used: false,
            duration_seconds: 60,
            evaluated_at: "2026-05-01T10:10:00.000Z",
        });
        const payload = await buildSessionDetail(db, sessionId);
        expect(payload.step_evaluations).toHaveLength(1);
        const e = payload.step_evaluations[0];
        expect(e.from_step).toBe(3);
        expect(e.to_step).toBe(4);
        expect(e.evaluated_at).toBe("2026-05-01T10:10:00.000Z");
    });
});

describe("buildCurriculumOverview", () => {
    it("throws when the curriculum does not exist", async () => {
        await expect(
            buildCurriculumOverview(getDb(), "missing-id"),
        ).rejects.toThrow(/not found/);
    });

    it("returns empty topics + lessons for an empty curriculum", async () => {
        const userId = await seedUser();
        const db = getDb();
        const curriculumId = newId();
        await db.curricula.add({
            id: curriculumId,
            user_id: userId,
            title: "Empty",
            description: null,
            language: "de",
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        const payload = await buildCurriculumOverview(db, curriculumId);
        expect(payload.curriculum.title).toBe("Empty");
        expect(payload.topics).toEqual([]);
        expect(payload.lessons).toEqual([]);
    });

    it("flattens the topic tree depth-first with computed depth", async () => {
        const userId = await seedUser();
        const db = getDb();
        const curriculumId = newId();
        await db.curricula.add({
            id: curriculumId,
            user_id: userId,
            title: "Tree",
            description: null,
            language: "de",
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        const rootAId = newId();
        const childAId = newId();
        const grandchildId = newId();
        const rootBId = newId();
        await db.learningTopics.bulkAdd([
            {
                id: rootAId,
                curriculum_id: curriculumId,
                parent_id: null,
                title: "Root A",
                description: null,
                order_index: 0,
                created_at: nowIso(),
                updated_at: nowIso(),
            },
            {
                id: rootBId,
                curriculum_id: curriculumId,
                parent_id: null,
                title: "Root B",
                description: null,
                order_index: 1,
                created_at: nowIso(),
                updated_at: nowIso(),
            },
            {
                id: childAId,
                curriculum_id: curriculumId,
                parent_id: rootAId,
                title: "Child A.1",
                description: null,
                order_index: 0,
                created_at: nowIso(),
                updated_at: nowIso(),
            },
            {
                id: grandchildId,
                curriculum_id: curriculumId,
                parent_id: childAId,
                title: "Grandchild",
                description: null,
                order_index: 0,
                created_at: nowIso(),
                updated_at: nowIso(),
            },
        ]);
        const payload = await buildCurriculumOverview(db, curriculumId);
        const titles = payload.topics.map((t) => t.title);
        expect(titles).toEqual(["Root A", "Child A.1", "Grandchild", "Root B"]);
        const depths = Object.fromEntries(
            payload.topics.map((t) => [t.title, t.depth]),
        );
        expect(depths["Root A"]).toBe(0);
        expect(depths["Child A.1"]).toBe(1);
        expect(depths["Grandchild"]).toBe(2);
        expect(depths["Root B"]).toBe(0);
    });

    it("includes ordered lessons", async () => {
        const userId = await seedUser();
        const db = getDb();
        const curriculumId = newId();
        await db.curricula.add({
            id: curriculumId,
            user_id: userId,
            title: "With lessons",
            description: null,
            language: "de",
            created_at: nowIso(),
            updated_at: nowIso(),
        });
        await db.lessons.bulkAdd([
            {
                id: newId(),
                curriculum_id: curriculumId,
                title: "Lesson 2",
                content: "Two",
                order_index: 1,
                created_at: nowIso(),
                updated_at: nowIso(),
            },
            {
                id: newId(),
                curriculum_id: curriculumId,
                title: "Lesson 1",
                content: "One",
                order_index: 0,
                created_at: nowIso(),
                updated_at: nowIso(),
            },
        ]);
        const payload = await buildCurriculumOverview(db, curriculumId);
        expect(payload.lessons.map((l) => l.title)).toEqual([
            "Lesson 1",
            "Lesson 2",
        ]);
    });
});
