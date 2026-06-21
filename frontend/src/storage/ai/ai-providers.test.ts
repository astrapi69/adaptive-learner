/**
 * AI provider tests (Phase 10D).
 *
 * Each provider has a different on-the-wire shape; we verify
 * URL + headers + body for the request, and parse the response
 * into the assistant text. Failures collapse to ApiError with a
 * provider-prefixed detail.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {ApiError} from "../../api/client";
import {aiComplete, aiStream, DEFAULT_MODELS, resolveModel} from "./ai-providers";

interface MockCall {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
}

let calls: MockCall[];
let nextResponse: () => Response;

beforeEach(() => {
    calls = [];
    nextResponse = () => new Response("{}", {status: 200});
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
            headers: (init?.headers as Record<string, string>) ?? {},
            body,
        });
        return nextResponse();
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("resolveModel + DEFAULT_MODELS", () => {
    it("defaults map every provider", () => {
        expect(DEFAULT_MODELS.anthropic).toMatch(/claude/);
        expect(DEFAULT_MODELS.openai).toMatch(/gpt/);
        expect(DEFAULT_MODELS.gemini).toMatch(/gemini/);
    });

    it("override wins when non-empty", () => {
        expect(resolveModel("anthropic", "claude-foo")).toBe("claude-foo");
    });

    it("empty / whitespace override falls back to default", () => {
        expect(resolveModel("anthropic", "")).toBe(DEFAULT_MODELS.anthropic);
        expect(resolveModel("anthropic", "   ")).toBe(DEFAULT_MODELS.anthropic);
        expect(resolveModel("anthropic", null)).toBe(DEFAULT_MODELS.anthropic);
    });
});

describe("anthropicComplete", () => {
    it("posts the expected URL + headers + body", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({content: [{type: "text", text: "hi"}]}),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );
        const reply = await aiComplete({
            provider: "anthropic",
            model: "claude-3-5-haiku-latest",
            apiKey: "sk-test",
            messages: [
                {role: "system", content: "system message"},
                {role: "user", content: "hello"},
            ],
        });
        expect(reply).toBe("hi");
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
        expect(calls[0].method).toBe("POST");
        expect(calls[0].headers["x-api-key"]).toBe("sk-test");
        expect(calls[0].headers["anthropic-version"]).toBe("2023-06-01");
        expect(calls[0].headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
        const body = calls[0].body as Record<string, unknown>;
        expect(body.model).toBe("claude-3-5-haiku-latest");
        expect(body.system).toBe("system message");
        expect(body.messages).toEqual([{role: "user", content: "hello"}]);
    });

    it("throws ApiError with anthropic-prefix on 401", async () => {
        nextResponse = () =>
            new Response(JSON.stringify({error: {message: "Invalid API Key"}}), {
                status: 401,
            });
        await expect(
            aiComplete({
                provider: "anthropic",
                model: "claude-x",
                apiKey: "bad",
                messages: [{role: "user", content: "hi"}],
            }),
        ).rejects.toBeInstanceOf(ApiError);
        await expect(
            aiComplete({
                provider: "anthropic",
                model: "claude-x",
                apiKey: "bad",
                messages: [{role: "user", content: "hi"}],
            }),
        ).rejects.toMatchObject({status: 401, detail: /Anthropic: Invalid API Key/});
    });

    it("throws 502 when response carries no text content", async () => {
        nextResponse = () =>
            new Response(JSON.stringify({content: []}), {status: 200});
        await expect(
            aiComplete({
                provider: "anthropic",
                model: "claude-x",
                apiKey: "k",
                messages: [{role: "user", content: "x"}],
            }),
        ).rejects.toMatchObject({status: 502});
    });
});

describe("openaiComplete", () => {
    it("posts the chat-completions URL with Bearer auth", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({choices: [{message: {content: "ok"}}]}),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );
        const reply = await aiComplete({
            provider: "openai",
            model: "gpt-4o-mini",
            apiKey: "sk-x",
            messages: [
                {role: "system", content: "S"},
                {role: "user", content: "Q"},
            ],
        });
        expect(reply).toBe("ok");
        expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
        expect(calls[0].headers.Authorization).toBe("Bearer sk-x");
        const body = calls[0].body as Record<string, unknown>;
        expect(body.model).toBe("gpt-4o-mini");
        expect((body.messages as unknown[]).length).toBe(2);
    });

    it("OpenAI 500 -> ApiError", async () => {
        nextResponse = () =>
            new Response(JSON.stringify({error: {message: "rate limit"}}), {
                status: 429,
            });
        await expect(
            aiComplete({
                provider: "openai",
                model: "gpt-x",
                apiKey: "k",
                messages: [{role: "user", content: "x"}],
            }),
        ).rejects.toMatchObject({status: 429, detail: /OpenAI: rate limit/});
    });
});

describe("geminiComplete", () => {
    it("folds the system message into the first user turn and uses query-param auth", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({
                    candidates: [
                        {content: {parts: [{text: "ok"}]}, finishReason: "STOP"},
                    ],
                }),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );
        const reply = await aiComplete({
            provider: "gemini",
            model: "gemini-2.0-flash",
            apiKey: "AIza-key",
            messages: [
                {role: "system", content: "S"},
                {role: "user", content: "Q"},
            ],
        });
        expect(reply).toBe("ok");
        expect(calls[0].url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIza-key",
        );
        const body = calls[0].body as Record<string, unknown>;
        const contents = body.contents as Array<{role: string; parts: Array<{text: string}>}>;
        expect(contents).toHaveLength(1);
        expect(contents[0].role).toBe("user");
        expect(contents[0].parts[0].text).toContain("S");
        expect(contents[0].parts[0].text).toContain("Q");
    });

    it("Gemini 404 -> ApiError", async () => {
        nextResponse = () =>
            new Response(JSON.stringify({error: {message: "Model not found"}}), {
                status: 404,
            });
        await expect(
            aiComplete({
                provider: "gemini",
                model: "gemini-x",
                apiKey: "k",
                messages: [{role: "user", content: "x"}],
            }),
        ).rejects.toMatchObject({status: 404, detail: /Gemini: Model not found/});
    });
});


// --- aiStream (v1.6.0 / Phase 19B-2) ---------------------------------------

function sseBodyResponse(frames: string[], status = 200): Response {
    // Build an SSE wire body and feed it through a ReadableStream
    // so the reader exercises the partial-frame buffering on its
    // way out.
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
        status,
        headers: {"Content-Type": "text/event-stream"},
    });
}

describe("aiStream — Anthropic", () => {
    it("emits each content_block_delta as a chunk in order", async () => {
        nextResponse = () =>
            sseBodyResponse([
                'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
                'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}',
                'event: message_stop\ndata: {"type":"message_stop"}',
            ]);
        const chunks: string[] = [];
        await aiStream({
            provider: "anthropic",
            model: "claude-haiku-4-5",
            apiKey: "k",
            messages: [{role: "user", content: "ping"}],
            onChunk: (d) => chunks.push(d),
        });
        expect(chunks).toEqual(["Hi", " there"]);
        const body = calls[0].body as Record<string, unknown>;
        expect(body.stream).toBe(true);
        expect(calls[0].headers["x-api-key"]).toBe("k");
    });

    it("ignores non-content_block_delta events (message_start, ping)", async () => {
        nextResponse = () =>
            sseBodyResponse([
                'event: message_start\ndata: {"type":"message_start"}',
                'event: ping\ndata: {"type":"ping"}',
                'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"real"}}',
            ]);
        const chunks: string[] = [];
        await aiStream({
            provider: "anthropic",
            model: "claude-haiku-4-5",
            apiKey: "k",
            messages: [{role: "user", content: "ping"}],
            onChunk: (d) => chunks.push(d),
        });
        expect(chunks).toEqual(["real"]);
    });

    it("Anthropic 401 -> ApiError with parsed detail", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({error: {message: "invalid x-api-key"}}),
                {status: 401},
            );
        await expect(
            aiStream({
                provider: "anthropic",
                model: "claude-haiku-4-5",
                apiKey: "bad",
                messages: [{role: "user", content: "x"}],
                onChunk: () => {},
            }),
        ).rejects.toMatchObject({
            status: 401,
            detail: /Anthropic: invalid x-api-key/,
        });
    });
});

describe("aiStream — OpenAI", () => {
    it("emits delta.content for each chunk and stops on [DONE]", async () => {
        nextResponse = () =>
            sseBodyResponse([
                'data: {"choices":[{"delta":{"role":"assistant"}}]}',
                'data: {"choices":[{"delta":{"content":"Hi"}}]}',
                'data: {"choices":[{"delta":{"content":" GPT"}}]}',
                'data: [DONE]',
            ]);
        const chunks: string[] = [];
        await aiStream({
            provider: "openai",
            model: "gpt-4o",
            apiKey: "sk-x",
            messages: [{role: "user", content: "ping"}],
            onChunk: (d) => chunks.push(d),
        });
        expect(chunks).toEqual(["Hi", " GPT"]);
        const body = calls[0].body as Record<string, unknown>;
        expect(body.stream).toBe(true);
        expect(calls[0].headers["Authorization"]).toBe("Bearer sk-x");
    });

    it("drops role-only and null-content deltas", async () => {
        nextResponse = () =>
            sseBodyResponse([
                'data: {"choices":[{"delta":{"role":"assistant","content":null}}]}',
                'data: {"choices":[{"delta":{"content":"only this"}}]}',
                'data: [DONE]',
            ]);
        const chunks: string[] = [];
        await aiStream({
            provider: "openai",
            model: "gpt-4o",
            apiKey: "k",
            messages: [{role: "user", content: "x"}],
            onChunk: (d) => chunks.push(d),
        });
        expect(chunks).toEqual(["only this"]);
    });

    it("OpenAI 429 -> ApiError", async () => {
        nextResponse = () =>
            new Response(JSON.stringify({error: {message: "rate limit"}}), {
                status: 429,
            });
        await expect(
            aiStream({
                provider: "openai",
                model: "gpt-4o",
                apiKey: "k",
                messages: [{role: "user", content: "x"}],
                onChunk: () => {},
            }),
        ).rejects.toMatchObject({
            status: 429,
            detail: /OpenAI: rate limit/,
        });
    });
});

describe("aiStream — Gemini", () => {
    it("emits each candidate part.text as a chunk", async () => {
        nextResponse = () =>
            sseBodyResponse([
                'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}',
                'data: {"candidates":[{"content":{"parts":[{"text":" gem"}]}}]}',
            ]);
        const chunks: string[] = [];
        await aiStream({
            provider: "gemini",
            model: "gemini-2.0-flash",
            apiKey: "AIza-x",
            messages: [{role: "user", content: "ping"}],
            onChunk: (d) => chunks.push(d),
        });
        expect(chunks).toEqual(["Hi", " gem"]);
        // ``alt=sse`` query param + streamGenerateContent endpoint.
        expect(calls[0].url).toContain(":streamGenerateContent");
        expect(calls[0].url).toContain("alt=sse");
    });

    it("Gemini 400 -> ApiError", async () => {
        nextResponse = () =>
            new Response(JSON.stringify({error: {message: "Bad model"}}), {
                status: 400,
            });
        await expect(
            aiStream({
                provider: "gemini",
                model: "gemini-x",
                apiKey: "k",
                messages: [{role: "user", content: "x"}],
                onChunk: () => {},
            }),
        ).rejects.toMatchObject({status: 400, detail: /Gemini: Bad model/});
    });
});
