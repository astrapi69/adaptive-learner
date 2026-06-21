/**
 * Tests for the inline SSE reader (v1.6.0 / Phase 19).
 *
 * Focused on the frame parser + the fetch-based loop. The route-
 * level integration sits in Import.test.tsx / SessionChat.test.tsx
 * for the consumer side.
 */

import {describe, it, expect, vi, afterEach} from "vitest";

import {parseFrame, streamSse} from "./sse-reader";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("parseFrame", () => {
    it("parses a simple event + JSON data line", () => {
        const out = parseFrame('event: chunk\ndata: {"delta":"Hi"}');
        expect(out).toEqual({event: "chunk", data: {delta: "Hi"}});
    });

    it("defaults event name to 'message' when only data is present", () => {
        const out = parseFrame('data: {"x":1}');
        expect(out).toEqual({event: "message", data: {x: 1}});
    });

    it("joins multi-line data into a single payload before parsing", () => {
        const out = parseFrame('event: done\ndata: {"a":1,\ndata: "b":2}');
        expect(out).toEqual({event: "done", data: {a: 1, b: 2}});
    });

    it("ignores comment lines (`:`-prefixed)", () => {
        const out = parseFrame(': heartbeat\nevent: chunk\ndata: {"delta":"k"}');
        expect(out).toEqual({event: "chunk", data: {delta: "k"}});
    });

    it("strips the single optional space after the colon", () => {
        // Per spec, both ``data: foo`` and ``data:foo`` are valid;
        // the leading space is just a separator hint.
        const out = parseFrame('data:{"x":1}');
        expect(out).toEqual({event: "message", data: {x: 1}});
    });

    it("returns null for frames with no data line", () => {
        expect(parseFrame("event: ping")).toBeNull();
        expect(parseFrame(": comment only")).toBeNull();
    });

    it("falls back to raw string when data is not valid JSON", () => {
        const out = parseFrame("event: chunk\ndata: not json");
        expect(out).toEqual({event: "chunk", data: "not json"});
    });
});

describe("streamSse", () => {
    function mockSseResponse(frames: string[]): Response {
        // Build the full wire body and feed it through a
        // ReadableStream in two halves to exercise the partial-
        // buffer handling.
        const wire = frames.map((f) => `${f}\n\n`).join("");
        const encoder = new TextEncoder();
        const halfPoint = Math.floor(wire.length / 2);
        const chunks = [wire.slice(0, halfPoint), wire.slice(halfPoint)];
        let idx = 0;
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (idx < chunks.length) {
                    controller.enqueue(encoder.encode(chunks[idx]));
                    idx += 1;
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

    it("dispatches every parsed event to onEvent in order", async () => {
        const frames = [
            'event: start\ndata: {"user_message":{"id":"u1"}}',
            'event: chunk\ndata: {"delta":"Hi"}',
            'event: chunk\ndata: {"delta":" there"}',
            'event: done\ndata: {"assistant_message":{"id":"a1","content":"Hi there"}}',
        ];
        vi.spyOn(globalThis, "fetch").mockResolvedValue(mockSseResponse(frames));

        const events: Array<{event: string; data: unknown}> = [];
        await streamSse({
            url: "/api/plugins/session/x/message/stream",
            body: {role: "user", content: "ping"},
            onEvent: (e) => events.push(e),
        });

        expect(events.map((e) => e.event)).toEqual([
            "start",
            "chunk",
            "chunk",
            "done",
        ]);
        const chunks = events
            .filter((e) => e.event === "chunk")
            .map((e) => (e.data as {delta: string}).delta);
        expect(chunks).toEqual(["Hi", " there"]);
        const done = events[events.length - 1].data as {
            assistant_message: {content: string};
        };
        expect(done.assistant_message.content).toBe("Hi there");
    });

    it("posts the JSON body with Content-Type + Accept headers", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(mockSseResponse(['event: done\ndata: {}']));

        await streamSse({
            url: "/api/x",
            body: {role: "user", content: "ping"},
            onEvent: () => {},
        });

        const call = fetchSpy.mock.calls[0];
        const init = call[1] as RequestInit;
        expect(init.method).toBe("POST");
        const headers = init.headers as Record<string, string>;
        expect(headers["Content-Type"]).toBe("application/json");
        expect(headers["Accept"]).toBe("text/event-stream");
        expect(JSON.parse(init.body as string)).toEqual({
            role: "user",
            content: "ping",
        });
    });

    it("throws on non-2xx HTTP status with the response detail", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response('{"detail":"session no-such not found"}', {
                status: 404,
                headers: {"Content-Type": "application/json"},
            }),
        );
        await expect(
            streamSse({url: "/api/x", body: {}, onEvent: () => {}}),
        ).rejects.toThrow(/404.*session no-such/);
    });

    it("handles a partial frame split across two reads cleanly", async () => {
        const wire = 'event: chunk\ndata: {"delta":"abc"}\n\n';
        const encoder = new TextEncoder();
        // Split mid-data so the buffer must accumulate across reads.
        const first = wire.slice(0, 25);
        const second = wire.slice(25);
        let idx = 0;
        const chunks = [first, second];
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (idx < chunks.length) {
                    controller.enqueue(encoder.encode(chunks[idx]));
                    idx += 1;
                } else {
                    controller.close();
                }
            },
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(stream, {status: 200}),
        );
        const events: Array<{event: string; data: unknown}> = [];
        await streamSse({
            url: "/api/x",
            body: {},
            onEvent: (e) => events.push(e),
        });
        expect(events).toEqual([{event: "chunk", data: {delta: "abc"}}]);
    });
});
