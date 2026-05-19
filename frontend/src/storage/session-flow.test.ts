/**
 * Session-flow integration tests (Phase 10D).
 *
 * Exercises the full /start + /message round-trip against
 * fake-indexeddb + a mocked fetch. The fetch mock answers the
 * AI provider URL (one call for the chat reply, a second for
 * the step evaluator); the session-flow logic ties it all
 * together and persists the messages + StepEvaluation row.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {_resetDbForTests, getDb} from "./db";
import {dexieStorage} from "./dexie-storage";

interface MockCall {
    url: string;
    method: string;
    body: unknown;
}

let calls: MockCall[];
let chatReplies: string[];
let evalReplies: string[];

beforeEach(async () => {
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
    calls = [];
    chatReplies = [];
    evalReplies = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as URL).toString();
        let body: unknown = undefined;
        if (typeof init?.body === "string") {
            try {
                body = JSON.parse(init.body);
            } catch {
                body = init.body;
            }
        }
        calls.push({
            url,
            method: (init?.method ?? "GET").toUpperCase(),
            body,
        });
        // Anthropic shape: alternate chat reply (long max_tokens)
        // vs eval reply (short max_tokens / system prompt
        // contains "Output ONLY a single valid JSON object").
        const isEval =
            typeof body === "object" &&
            body !== null &&
            typeof (body as {system?: unknown}).system === "string" &&
            ((body as {system: string}).system).includes("Output ONLY a single valid JSON object");
        const reply = isEval
            ? evalReplies.shift() ?? '{"advance":true,"confidence":0.9,"reason":"ok","suggested_step":2}'
            : chatReplies.shift() ?? "(default chat reply)";
        return new Response(
            JSON.stringify({content: [{type: "text", text: reply}]}),
            {status: 200, headers: {"Content-Type": "application/json"}},
        );
    }) as unknown as typeof fetch;
});

afterEach(async () => {
    await _resetDbForTests();
    vi.restoreAllMocks();
});

async function setupUserWithKey(): Promise<{userId: string; projectId: string}> {
    const u = await dexieStorage.users.create({name: "A", language: "en"});
    const p = await dexieStorage.users.projects.create(u.id, {
        topic: "Topic",
        goal: "Goal",
        timeframe: "1w",
        daily_minutes: 10,
    });
    await dexieStorage.settings.setApiKey(u.id, {
        provider: "anthropic",
        key: "sk-fake",
    });
    return {userId: u.id, projectId: p.id};
}

describe("session.start", () => {
    it("creates a session, persists the system prompt, picks deductive default", async () => {
        const {projectId} = await setupUserWithKey();
        const result = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        expect(result.session.method).toBe("deductive");
        expect(result.session.cycle_step).toBe(1);
        expect(result.system_prompt.length).toBeGreaterThan(20);
        // System message persisted as the first message.
        const db = getDb();
        const msgs = await db.sessionMessages
            .where("session_id")
            .equals(result.session.id)
            .toArray();
        expect(msgs).toHaveLength(1);
        expect(msgs[0].role).toBe("system");
    });

    it("uses profile.dominant_method when present", async () => {
        const {projectId} = await setupUserWithKey();
        await dexieStorage.assessment.evaluate({
            project_id: projectId,
            answers: [
                {question_id: "q01", answer_id: "b"}, // inductive
            ],
        });
        const result = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        expect(result.session.method).toBe("inductive");
    });

    it("404s on unknown project", async () => {
        await expect(
            dexieStorage.session.start({project_id: "nope"}),
        ).rejects.toMatchObject({status: 404});
    });
});

describe("session.message", () => {
    it("user message triggers chat reply + step eval; advances step on high confidence", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        chatReplies.push("Hello, learner. Here's the rule...");
        evalReplies.push(
            '{"advance":true,"confidence":0.9,"reason":"on track","suggested_step":2}',
        );
        const result = await dexieStorage.session.message(start.session.id, {
            role: "user",
            content: "I'm ready",
        });
        expect(result.assistant_message?.content).toBe("Hello, learner. Here's the rule...");
        expect(result.ai_error).toBeNull();
        expect(result.session.cycle_step).toBe(2);
        expect(result.step_evaluation?.applied).toBe(true);
        expect(result.step_evaluation?.from_step).toBe(1);
        expect(result.step_evaluation?.suggested_step).toBe(2);
        expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it("low-confidence eval does NOT advance step", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        chatReplies.push("Reply");
        evalReplies.push(
            '{"advance":true,"confidence":0.4,"reason":"low","suggested_step":2}',
        );
        const result = await dexieStorage.session.message(start.session.id, {
            role: "user",
            content: "x",
        });
        expect(result.session.cycle_step).toBe(1);
        expect(result.step_evaluation?.applied).toBe(false);
    });

    it("fallback advance applies on unparseable eval JSON", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        chatReplies.push("Reply");
        evalReplies.push("not valid JSON");
        const result = await dexieStorage.session.message(start.session.id, {
            role: "user",
            content: "x",
        });
        expect(result.step_evaluation?.fallback_used).toBe(true);
        expect(result.step_evaluation?.applied).toBe(true);
        expect(result.session.cycle_step).toBe(2);
    });

    it("missing API key surfaces ai_error without crashing", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const start = await dexieStorage.session.start({project_id: p.id});
        const result = await dexieStorage.session.message(start.session.id, {
            role: "user",
            content: "hi",
        });
        expect(result.assistant_message).toBeNull();
        expect(result.ai_error).toMatch(/No API key/i);
    });

    it("non-user role skips the AI step entirely", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        const before = calls.length;
        const result = await dexieStorage.session.message(start.session.id, {
            role: "assistant",
            content: "manual append",
        });
        expect(result.assistant_message).toBeNull();
        expect(result.step_evaluation).toBeNull();
        expect(calls.length).toBe(before);
    });

    it("404 on unknown session", async () => {
        await expect(
            dexieStorage.session.message("nope", {role: "user", content: "x"}),
        ).rejects.toMatchObject({status: 404});
    });
});

describe("session.rate / end / acceptSwitch / switchRecommendation", () => {
    it("rate persists a SessionRating row", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        const rating = await dexieStorage.session.rate(start.session.id, {
            understanding: 4,
            stress: 2,
            method_fit: 5,
            notes: "good",
        });
        expect(rating.understanding).toBe(4);
        expect(rating.session_id).toBe(start.session.id);
    });

    it("end flips status to completed and stamps ended_at", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        const result = await dexieStorage.session.end(start.session.id);
        expect(result.session.status).toBe("completed");
        expect(result.session.ended_at).not.toBeNull();
    });

    it("switchRecommendation defaults to no-recommendation", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        const rec = await dexieStorage.session.switchRecommendation(start.session.id);
        expect(rec.recommended).toBe(false);
    });

    it("end writes a ProgressCommit row when a rating exists", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        await dexieStorage.session.rate(start.session.id, {
            understanding: 5,
            stress: 1,
            method_fit: 5,
        });
        await dexieStorage.session.end(start.session.id);
        const commits = await dexieStorage.tracking.commits(projectId);
        expect(commits).toHaveLength(1);
        expect(commits[0].understanding).toBe(1);
        expect(commits[0].stress).toBe(0.2);
    });

    it("end without rating writes no ProgressCommit", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        await dexieStorage.session.end(start.session.id);
        const commits = await dexieStorage.tracking.commits(projectId);
        expect(commits).toHaveLength(0);
    });

    it("tracking.progress reflects committed sessions", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        await dexieStorage.session.rate(start.session.id, {
            understanding: 4,
            stress: 2,
            method_fit: 4,
        });
        await dexieStorage.session.end(start.session.id);
        const summary = await dexieStorage.tracking.progress(projectId);
        expect(summary.tracking?.total_sessions).toBe(1);
        expect(summary.tracking?.sessions_per_method.deductive).toBe(1);
    });

    it("acceptSwitch updates method and writes a MethodSwitch row", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({project_id: projectId});
        const updated = await dexieStorage.session.acceptSwitch(start.session.id, {
            to_method: "dialogic",
            reason: "felt right",
        });
        expect(updated.method).toBe("dialogic");
        const db = getDb();
        const switches = await db.methodSwitches.toArray();
        expect(switches).toHaveLength(1);
        expect(switches[0].from_method).toBe("deductive");
        expect(switches[0].to_method).toBe("dialogic");
    });
});
