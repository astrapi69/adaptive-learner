/**
 * Imported-session context persistence — DOCUMENTATION OF CURRENT BEHAVIOUR.
 *
 * These pins document the "frozen prompt" mechanism as it stands today: the
 * imported-conversation context (analysis #827 + raw transcript #1078) is
 * composed exactly ONCE, when the session is first created, and persisted as
 * a ``role=system`` message. Resuming the same conversation returns that
 * stored message verbatim and never rebuilds it from the (possibly changed)
 * source.
 *
 * IMPORTANT: the assertions below encode the CURRENT freeze behaviour on
 * purpose. When the planned "Rebuild-on-Resume" fix lands (context recomposed
 * from the live DB on every turn instead of frozen at creation), these
 * assertions must be INVERTED - e.g. the second start() then reflects the
 * mutated analysis, and the prompt is no longer byte-identical to v1. Treat a
 * failure here after that fix as expected, and flip the expectations rather
 * than reverting the fix.
 *
 * The companion behaviour — that the frozen context still reaches the provider
 * on a resumed turn (so "frozen" is not the same as "lost") — is pinned
 * separately in ``session-flow.test.ts``.
 *
 * Harness: fake-indexeddb + a guard fetch (session.start makes no provider
 * call, so a fetch here would signal an unexpected network round-trip).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {dexieStorage} from "../dexie-storage";

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    // session.start composes the prompt locally and persists it; it must not
    // hit the network. A call here means an unexpected provider round-trip.
    global.fetch = vi.fn(async () => {
        throw new Error("unexpected fetch during session.start");
    }) as unknown as typeof fetch;
});

afterEach(async () => {
    await _resetDbForTests();
    vi.restoreAllMocks();
});

const ANALYSIS_V1 = {
    topic: "Spanish past tense",
    summary: "Practised the preterite.",
    user_level: "intermediate",
    strengths: ["vocabulary recall"],
    weaknesses: ["irregular verbs"],
    error_patterns: ["confuses ser/estar"],
    vocabulary: [{word: "tener", translation: "to have"}],
    suggested_curriculum: [],
};

async function setupUserWithKey(): Promise<{userId: string; projectId: string}> {
    const u = await dexieStorage.users.create({name: "A", language: "en"});
    const p = await dexieStorage.users.projects.create(u.id, {
        topic: "Topic",
        goal: "Goal",
        timeframe: "1w",
        daily_minutes: 10,
    });
    await dexieStorage.settings.setApiKey(u.id, {provider: "anthropic", key: "sk-fake"});
    return {userId: u.id, projectId: p.id};
}

/** Imported conversation with a raw transcript turn AND an analysis. */
async function setupAnalysedImport(userId: string) {
    const conv = await dexieStorage.imports.create(userId, {
        source: "manual",
        title: "Analysed chat",
        model: null,
        source_created_at: null,
        messages: [
            {role: "user", content: "When do I use ser vs estar?", timestamp: null},
        ],
    });
    await getDb().importedConversations.update(conv.id, {
        analyzed: true,
        analysis_result: ANALYSIS_V1,
    });
    return conv;
}

async function systemMessagesFor(sessionId: string) {
    return (await getDb().sessionMessages
        .where("session_id")
        .equals(sessionId)
        .toArray()).filter((m) => m.role === "system");
}

describe("Imported-session context persistence (current frozen behaviour)", () => {
    it("first start() persists analysis AND raw transcript as a single system message", async () => {
        const {userId, projectId} = await setupUserWithKey();
        const conv = await setupAnalysedImport(userId);

        const result = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
            imported_conversation_id: conv.id,
        });

        // Analysis block (#827).
        expect(result.system_prompt).toContain("Spanish past tense");
        expect(result.system_prompt).toContain("Weaknesses: irregular verbs");
        // Raw transcript block (#1078).
        expect(result.system_prompt).toContain("Imported conversation (previous chat)");
        expect(result.system_prompt).toContain("Learner: When do I use ser vs estar?");

        const sys = await systemMessagesFor(result.session.id);
        expect(sys).toHaveLength(1);
        expect(sys[0].content).toContain("Imported conversation (previous chat)");
    });

    it("FROZEN: a second start() returns the same session and the same prompt even after the analysis changes underneath", async () => {
        // CURRENT BEHAVIOUR. After "Rebuild-on-Resume", the second start()
        // would reflect the mutated topic and the prompt would NOT equal v1 —
        // invert these assertions then.
        const {userId, projectId} = await setupUserWithKey();
        const conv = await setupAnalysedImport(userId);

        const first = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
            imported_conversation_id: conv.id,
        });
        const v1 = first.system_prompt;
        expect(v1).toContain("Spanish past tense");

        // Simulate a content change AFTER the session exists.
        await getDb().importedConversations.update(conv.id, {
            analysis_result: {...ANALYSIS_V1, topic: "MUTATED-TOPIC-XYZ"},
        });

        const second = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
            imported_conversation_id: conv.id,
        });

        // Short-Circuit 2: the same active session is returned, not a new one.
        expect(second.session.id).toBe(first.session.id);
        // FROZEN: byte-identical to v1; the mutation never reaches the prompt.
        expect(second.system_prompt).toBe(v1);
        expect(second.system_prompt).not.toContain("MUTATED-TOPIC-XYZ");

        // No duplicate / rebuilt system message: still exactly one.
        const sys = await systemMessagesFor(first.session.id);
        expect(sys).toHaveLength(1);
        expect(sys[0].content).toBe(v1);
    });
});
