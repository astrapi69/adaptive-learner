/**
 * Phase 0 proof-of-seam (#1126): the assistant-ui ChatModelAdapter streams
 * through the app's storage layer. No assistant-ui rendering here — this pins
 * the bridge contract (deltas -> accumulating assistant text, user content
 * forwarded, failures propagated) against a mocked getStorage, i.e. the exact
 * Dexie-mode path with no backend.
 */

import {describe, it, expect, vi, beforeEach} from "vitest";

const {streamMessage} = vi.hoisted(() => ({streamMessage: vi.fn()}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({session: {streamMessage}}),
}));

import {createSessionChatAdapter} from "./session-chat-adapter";

type RunResult = {content: {type: string; text: string}[]};

function userMessage(text: string) {
    return {role: "user", content: [{type: "text", text}]};
}

function runOptions(messages: unknown[]) {
    const adapter = createSessionChatAdapter("sess-1");
    const opts = {
        messages,
        abortSignal: new AbortController().signal,
    } as unknown as Parameters<typeof adapter.run>[0];
    return {adapter, opts};
}

async function collect(gen: AsyncIterable<RunResult>): Promise<RunResult[]> {
    const out: RunResult[] = [];
    for await (const result of gen) out.push(result);
    return out;
}

describe("createSessionChatAdapter (Phase 0 seam, #1126)", () => {
    beforeEach(() => streamMessage.mockReset());

    it("streams storage deltas as accumulating assistant text and forwards the user content", async () => {
        streamMessage.mockImplementation(async (...args: unknown[]) => {
            const handlers = args[2] as
                | {onChunk: (d: string) => void; onDone: (r: unknown) => void}
                | undefined;
            if (!handlers) return;
            handlers.onChunk("Hel");
            handlers.onChunk("lo!");
            handlers.onDone({});
        });

        const {adapter, opts} = runOptions([userMessage("Hi")]);
        const results = await collect(adapter.run(opts) as AsyncIterable<RunResult>);

        expect(results.map((r) => r.content[0].text)).toEqual(["Hel", "Hello!"]);
        expect(streamMessage).toHaveBeenCalledWith(
            "sess-1",
            {role: "user", content: "Hi"},
            expect.objectContaining({
                onChunk: expect.any(Function),
                onDone: expect.any(Function),
            }),
        );
    });

    it("yields nothing and skips the call when there is no user message", async () => {
        const {adapter, opts} = runOptions([]);
        const results = await collect(adapter.run(opts) as AsyncIterable<RunResult>);
        expect(results).toEqual([]);
        expect(streamMessage).not.toHaveBeenCalled();
    });

    it("propagates a streaming failure", async () => {
        streamMessage.mockImplementation(async (...args: unknown[]) => {
            // Only the real (3-arg) call from the adapter should fail; ignore
            // any arg-less probe so its rejection can't leak as unhandled.
            if (args.length === 0) return;
            throw new Error("provider down");
        });
        const {adapter, opts} = runOptions([userMessage("x")]);
        await expect(
            collect(adapter.run(opts) as AsyncIterable<RunResult>),
        ).rejects.toThrow("provider down");
    });
});
