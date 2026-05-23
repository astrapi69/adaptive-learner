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

    // --- Phase 36 Bug 4 — session resume per imported conversation ---

    it("stamps imported_conversation_id when provided (Phase 36 Bug 4)", async () => {
        const {userId, projectId} = await setupUserWithKey();
        const conv = await dexieStorage.imports.create(userId, {
            source: "manual",
            title: "Linked source",
            model: null,
            source_created_at: null,
            messages: [
                {role: "user", content: "Q", timestamp: null},
                {role: "assistant", content: "A", timestamp: null},
            ],
        });
        const result = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
            imported_conversation_id: conv.id,
        });
        expect(result.session.imported_conversation_id).toBe(conv.id);
    });

    it(
        "resumes an existing active session for the same conversation (Phase 36 Bug 4)",
        async () => {
            const {userId, projectId} = await setupUserWithKey();
            const conv = await dexieStorage.imports.create(userId, {
                source: "manual",
                title: "Resume me",
                model: null,
                source_created_at: null,
                messages: [
                    {role: "user", content: "Q", timestamp: null},
                    {role: "assistant", content: "A", timestamp: null},
                ],
            });
            const first = await dexieStorage.session.start({
                project_id: projectId,
                lang: "en",
                imported_conversation_id: conv.id,
            });
            const second = await dexieStorage.session.start({
                project_id: projectId,
                lang: "en",
                imported_conversation_id: conv.id,
            });
            // Second call MUST return the same session id, not
            // create a new one.
            expect(second.session.id).toBe(first.session.id);
        },
    );

    it(
        "getActiveForConversation returns null + linked session (Phase 36 Bug 4)",
        async () => {
            const {userId, projectId} = await setupUserWithKey();
            const conv = await dexieStorage.imports.create(userId, {
                source: "manual",
                title: "Linked source",
                model: null,
                source_created_at: null,
                messages: [
                    {role: "user", content: "x", timestamp: null},
                    {role: "assistant", content: "y", timestamp: null},
                ],
            });
            // Before any session: null.
            expect(
                await dexieStorage.session.getActiveForConversation(conv.id),
            ).toBeNull();
            // After starting with FK: returns the active session.
            const started = await dexieStorage.session.start({
                project_id: projectId,
                lang: "en",
                imported_conversation_id: conv.id,
            });
            const lookup = await dexieStorage.session.getActiveForConversation(
                conv.id,
            );
            expect(lookup?.id).toBe(started.session.id);
        },
    );
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


// --- session.streamMessage (v1.6.0 / Phase 19B-2) --------------------------


/**
 * Build an SSE-shaped Response carrying the given Anthropic
 * ``content_block_delta`` chunks. Used to mock the fetch result
 * for the streaming chat call. The eval call after the stream
 * goes via the same fetch mock — but it sets ``stream: false``,
 * so we leave the non-stream JSON branch in the global mock to
 * handle that.
 */
function anthropicSseResponse(chunks: string[]): Response {
    const frames = chunks
        .map(
            (c) =>
                `event: content_block_delta\ndata: ${JSON.stringify({
                    type: "content_block_delta",
                    delta: {type: "text_delta", text: c},
                })}`,
        )
        .concat(["event: message_stop\ndata: {\"type\":\"message_stop\"}"]);
    const wire = frames.map((f) => `${f}\n\n`).join("");
    const encoder = new TextEncoder();
    let emitted = false;
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (!emitted) {
                controller.enqueue(encoder.encode(wire));
                emitted = true;
            } else {
                controller.close();
            }
        },
    });
    return new Response(stream, {
        status: 200,
        headers: {"Content-Type": "text/event-stream"},
    });
}

describe("session.streamMessage", () => {
    it("invokes onChunk for each streamed delta and persists the full assistant text", async () => {
        const {projectId} = await setupUserWithKey();
        const start = await dexieStorage.session.start({
            project_id: projectId,
            lang: "en",
        });
        evalReplies.push(
            '{"advance":true,"confidence":0.9,"reason":"ok","suggested_step":2}',
        );

        // Override the global fetch mock for THIS test to emit SSE
        // for the streaming chat call and fall back to JSON for
        // the non-streaming eval call.
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
            calls.push({url, method: (init?.method ?? "GET").toUpperCase(), body});
            const stream = (body as {stream?: boolean})?.stream === true;
            if (stream) {
                return anthropicSseResponse(["Hi ", "there!"]);
            }
            const reply =
                evalReplies.shift() ??
                '{"advance":false,"confidence":0.3,"reason":"x","suggested_step":1}';
            return new Response(
                JSON.stringify({content: [{type: "text", text: reply}]}),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );
        }) as unknown as typeof fetch;

        const chunks: string[] = [];
        const startUserMessages: string[] = [];
        let doneResult: unknown = null;
        await dexieStorage.session.streamMessage(
            start.session.id,
            {role: "user", content: "ping"},
            {
                onStart: (u) => startUserMessages.push(u.content),
                onChunk: (d) => chunks.push(d),
                onDone: (r) => {
                    doneResult = r;
                },
            },
        );
        expect(chunks).toEqual(["Hi ", "there!"]);
        expect(startUserMessages).toEqual(["ping"]);
        // The full assistant text is persisted + the step
        // evaluator ran on top of it.
        const final = doneResult as {
            assistant_message: {content: string};
            ai_error: string | null;
            session: {cycle_step: number};
            step_evaluation: {applied: boolean};
        };
        expect(final.assistant_message.content).toBe("Hi there!");
        expect(final.ai_error).toBeNull();
        expect(final.session.cycle_step).toBe(2);
        expect(final.step_evaluation.applied).toBe(true);
    });

    it("missing API key surfaces ai_error with no chunks emitted", async () => {
        const u = await dexieStorage.users.create({name: "A"});
        const p = await dexieStorage.users.projects.create(u.id, {
            topic: "T",
            goal: "G",
            timeframe: "1w",
            daily_minutes: 10,
        });
        const start = await dexieStorage.session.start({project_id: p.id});
        const chunks: string[] = [];
        let doneResult: unknown = null;
        await dexieStorage.session.streamMessage(
            start.session.id,
            {role: "user", content: "hi"},
            {
                onChunk: (d) => chunks.push(d),
                onDone: (r) => {
                    doneResult = r;
                },
            },
        );
        expect(chunks).toEqual([]);
        const final = doneResult as {ai_error: string | null};
        expect(final.ai_error).toMatch(/No API key/i);
    });

    it("404 on unknown session (matches the non-stream sendMessage contract)", async () => {
        await expect(
            dexieStorage.session.streamMessage(
                "nope",
                {role: "user", content: "x"},
                {onChunk: () => {}, onDone: () => {}},
            ),
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

describe("session.get / session.getMessages (Phase 38 Bug 7)", () => {
    it("session.get returns the session record by ID", async () => {
        const {projectId} = await setupUserWithKey();
        const started = await dexieStorage.session.start({project_id: projectId});
        const fetched = await dexieStorage.session.get(started.session.id);
        expect(fetched.id).toBe(started.session.id);
        expect(fetched.project_id).toBe(projectId);
        expect(fetched.status).toBe("active");
    });

    it("session.get throws ApiError(404) on missing", async () => {
        await expect(
            dexieStorage.session.get("does-not-exist"),
        ).rejects.toMatchObject({status: 404});
    });

    it("session.getMessages returns the system prompt as the first entry", async () => {
        const {projectId} = await setupUserWithKey();
        const started = await dexieStorage.session.start({project_id: projectId});
        const messages = await dexieStorage.session.getMessages(
            started.session.id,
        );
        expect(messages.length).toBeGreaterThanOrEqual(1);
        expect(messages[0].role).toBe("system");
        expect(messages[0].session_id).toBe(started.session.id);
        // Returned in oldest-first order — the system prompt
        // must come first.
        const timestamps = messages.map((m) => m.created_at);
        expect(timestamps).toEqual([...timestamps].sort());
    });

    it("session.getMessages returns the chronological history after exchanges", async () => {
        const {projectId} = await setupUserWithKey();
        chatReplies.push("Sure, let me explain.");
        evalReplies.push(
            '{"advance":false,"confidence":0.6,"reason":"keep going","suggested_step":1}',
        );
        const started = await dexieStorage.session.start({project_id: projectId});
        await dexieStorage.session.message(started.session.id, {
            role: "user",
            content: "Hello!",
        });
        const messages = await dexieStorage.session.getMessages(
            started.session.id,
        );
        // Expect at least: system prompt, user message, assistant
        // reply (the order is enforced by created_at).
        const roles = messages.map((m) => m.role);
        expect(roles).toContain("system");
        expect(roles).toContain("user");
        expect(roles).toContain("assistant");
    });

    it("session.getMessages throws ApiError(404) on missing session", async () => {
        await expect(
            dexieStorage.session.getMessages("missing"),
        ).rejects.toMatchObject({status: 404});
    });
});
