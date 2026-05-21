/**
 * Browser-direct model discovery tests (v1.11.0 / Phase 24B).
 *
 * Mocks ``fetch`` to verify each provider's URL + headers and
 * the parse + filter pipeline. Per-provider auth errors collapse
 * to ApiError; the sessionStorage cache short-circuits identical
 * calls.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {ApiError} from "../api/client";
import {
    clearModelCache,
    fetchAnthropicModels,
    fetchAvailableModels,
    fetchGeminiModels,
    fetchOpenAiModels,
} from "./model-discovery";

interface MockCall {
    url: string;
    method: string;
    headers: Record<string, string>;
}

let calls: MockCall[];
let nextResponse: () => Response;

beforeEach(() => {
    calls = [];
    nextResponse = () => new Response("{}", {status: 200});
    clearModelCache();
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as URL).toString();
        calls.push({
            url,
            method: (init?.method ?? "GET").toUpperCase(),
            headers: (init?.headers as Record<string, string>) ?? {},
        });
        return nextResponse();
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
    clearModelCache();
});

// --- Anthropic -------------------------------------------------------

describe("fetchAnthropicModels", () => {
    it("returns [] for empty key without calling the network", async () => {
        const models = await fetchAnthropicModels("");
        expect(models).toEqual([]);
        expect(calls).toHaveLength(0);
    });

    it("sends correct headers and parses the response", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({
                    data: [
                        {id: "claude-opus-4-20250514", display_name: "Claude Opus 4"},
                        {id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4"},
                    ],
                }),
                {status: 200},
            );
        const models = await fetchAnthropicModels("sk-ant-fake");
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("https://api.anthropic.com/v1/models");
        expect(calls[0].headers["x-api-key"]).toBe("sk-ant-fake");
        expect(calls[0].headers["anthropic-version"]).toBe("2023-06-01");
        expect(calls[0].headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
        expect(models).toEqual([
            {
                id: "claude-opus-4-20250514",
                name: "Claude Opus 4",
                context_window: 200000,
                description: null,
            },
            {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                context_window: 200000,
                description: null,
            },
        ]);
    });

    it("throws ApiError on 401", async () => {
        nextResponse = () => new Response("{}", {status: 401});
        await expect(fetchAnthropicModels("bad")).rejects.toBeInstanceOf(ApiError);
    });

    it("throws ApiError on 500", async () => {
        nextResponse = () => new Response("{}", {status: 500});
        await expect(fetchAnthropicModels("bad")).rejects.toBeInstanceOf(ApiError);
    });

    it("caches results across calls with the same key", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({data: [{id: "claude-x", display_name: "Claude X"}]}),
                {status: 200},
            );
        await fetchAnthropicModels("sk-ant-fake");
        await fetchAnthropicModels("sk-ant-fake");
        expect(calls).toHaveLength(1);
    });

    it("does not cache across different keys", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({data: [{id: "claude-x", display_name: "Claude X"}]}),
                {status: 200},
            );
        await fetchAnthropicModels("key-a");
        await fetchAnthropicModels("key-b");
        expect(calls).toHaveLength(2);
    });
});

// --- OpenAI ----------------------------------------------------------

describe("fetchOpenAiModels", () => {
    it("filters embedding, audio, dall-e, moderation, deprecated families", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({
                    data: [
                        {id: "gpt-4o"},
                        {id: "gpt-4o-mini"},
                        {id: "text-embedding-3-small"},
                        {id: "whisper-1"},
                        {id: "tts-1"},
                        {id: "dall-e-3"},
                        {id: "o1-preview"},
                        {id: "gpt-3.5-turbo"},
                        {id: "babbage-002"},
                        {id: "text-moderation-stable"},
                    ],
                }),
                {status: 200},
            );
        const models = await fetchOpenAiModels("sk-fake");
        const ids = models.map((m) => m.id);
        expect(ids).toContain("gpt-4o");
        expect(ids).toContain("gpt-4o-mini");
        expect(ids).toContain("o1-preview");
        expect(ids).toContain("gpt-3.5-turbo");
        expect(ids).not.toContain("text-embedding-3-small");
        expect(ids).not.toContain("whisper-1");
        expect(ids).not.toContain("tts-1");
        expect(ids).not.toContain("dall-e-3");
        expect(ids).not.toContain("babbage-002");
        expect(ids).not.toContain("text-moderation-stable");
    });

    it("sends Bearer Authorization header", async () => {
        nextResponse = () => new Response(JSON.stringify({data: []}), {status: 200});
        await fetchOpenAiModels("sk-fake");
        expect(calls[0].url).toBe("https://api.openai.com/v1/models");
        expect(calls[0].headers.Authorization).toBe("Bearer sk-fake");
    });

    it("infers context windows for common families", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({
                    data: [{id: "gpt-4o-mini"}, {id: "gpt-3.5-turbo"}, {id: "o1-mini"}],
                }),
                {status: 200},
            );
        const models = await fetchOpenAiModels("sk-fake");
        const byId = Object.fromEntries(models.map((m) => [m.id, m]));
        expect(byId["gpt-4o-mini"].context_window).toBe(128000);
        expect(byId["gpt-3.5-turbo"].context_window).toBe(16384);
        expect(byId["o1-mini"].context_window).toBe(200000);
    });

    it("returns [] for empty key", async () => {
        expect(await fetchOpenAiModels("")).toEqual([]);
    });

    it("throws ApiError on auth failure", async () => {
        nextResponse = () => new Response("{}", {status: 401});
        await expect(fetchOpenAiModels("bad")).rejects.toBeInstanceOf(ApiError);
    });
});

// --- Gemini ----------------------------------------------------------

describe("fetchGeminiModels", () => {
    it("filters embedding + aqa + vision, strips models/ prefix", async () => {
        nextResponse = () =>
            new Response(
                JSON.stringify({
                    models: [
                        {
                            name: "models/gemini-2.0-flash",
                            displayName: "Gemini 2.0 Flash",
                            description: "Fast multimodal.",
                            supportedGenerationMethods: ["generateContent"],
                            inputTokenLimit: 1048576,
                        },
                        {
                            name: "models/embedding-001",
                            supportedGenerationMethods: ["embedContent"],
                        },
                        {
                            name: "models/aqa",
                            supportedGenerationMethods: ["generateAnswer"],
                        },
                    ],
                }),
                {status: 200},
            );
        const models = await fetchGeminiModels("gemini-key");
        expect(models).toHaveLength(1);
        expect(models[0].id).toBe("gemini-2.0-flash");
        expect(models[0].name).toBe("Gemini 2.0 Flash");
        expect(models[0].context_window).toBe(1048576);
        expect(models[0].description).toBe("Fast multimodal.");
    });

    it("passes the key as a query param", async () => {
        nextResponse = () => new Response(JSON.stringify({models: []}), {status: 200});
        await fetchGeminiModels("gemini-key");
        expect(calls[0].url).toContain("?key=gemini-key");
    });

    it("returns [] for empty key", async () => {
        expect(await fetchGeminiModels("")).toEqual([]);
    });

    it("throws ApiError on 403", async () => {
        nextResponse = () => new Response("{}", {status: 403});
        await expect(fetchGeminiModels("bad")).rejects.toBeInstanceOf(ApiError);
    });
});

// --- Dispatch --------------------------------------------------------

describe("fetchAvailableModels", () => {
    it("dispatches anthropic / openai / gemini correctly", async () => {
        nextResponse = () => new Response(JSON.stringify({data: [], models: []}), {status: 200});
        await fetchAvailableModels("anthropic", "k-a");
        await fetchAvailableModels("openai", "k-o");
        await fetchAvailableModels("gemini", "k-g");
        expect(calls[0].url).toContain("anthropic.com");
        expect(calls[1].url).toContain("openai.com");
        expect(calls[2].url).toContain("googleapis.com");
    });
});
