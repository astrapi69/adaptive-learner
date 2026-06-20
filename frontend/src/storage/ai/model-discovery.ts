/**
 * Browser-direct provider model discovery (v1.11.0 / Phase 24B).
 *
 * Mirrors ``backend/app/services/model_discovery.py`` for Dexie
 * mode, where the user's API key lives in IndexedDB and the
 * picker has no backend to call. Each provider's ``/models``
 * endpoint allows browser-direct GET; the same CORS allowances
 * as ``ai-providers.ts`` apply (Anthropic needs the
 * dangerous-direct-browser-access header).
 *
 * Caching:
 *   sessionStorage keyed by ``(provider, sha256(api_key))`` with
 *   a 1-hour TTL. Per-tab cache; survives page reloads inside a
 *   tab but is dropped when the tab closes — which is fine for
 *   a "freshness vs. rate-limit" trade-off in a single-user
 *   browser context.
 *
 * Error semantics:
 *   - Missing api key → empty list.
 *   - Auth / network / parse failure → throws ``ApiError`` so
 *     the toast / fallback machinery on the picker triggers.
 */

import {ApiError} from "../../api/client";
import type {AIProvider} from "../../lib/constants";

export interface ModelInfo {
    id: string;
    name: string;
    context_window: number | null;
    description: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_PREFIX = "adaptive-learner.model-discovery.";

interface CacheEntry {
    models: ModelInfo[];
    expiresAt: number;
}

async function sha256Hex(input: string): Promise<string> {
    // The crypto.subtle API is available in every modern browser
    // we target (and in happy-dom for tests via the polyfill).
    if (typeof crypto !== "undefined" && crypto.subtle) {
        const encoded = new TextEncoder().encode(input);
        const buf = await crypto.subtle.digest("SHA-256", encoded);
        return Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 16);
    }
    // Fallback: a non-cryptographic but stable hash that still
    // partitions the cache reliably per key.
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return `fb${(hash >>> 0).toString(16)}`;
}

function cacheStore(): Storage | null {
    try {
        if (typeof sessionStorage !== "undefined") {
            return sessionStorage;
        }
    } catch {
        // Some browser configurations throw on storage access (e.g.
        // private mode in older Safari). Fall through to no-cache.
    }
    return null;
}

async function cacheKey(provider: AIProvider, apiKey: string): Promise<string> {
    return `${CACHE_PREFIX}${provider}.${await sha256Hex(apiKey)}`;
}

async function cacheGet(provider: AIProvider, apiKey: string): Promise<ModelInfo[] | null> {
    const store = cacheStore();
    if (!store) return null;
    const key = await cacheKey(provider, apiKey);
    const raw = store.getItem(key);
    if (!raw) return null;
    try {
        const entry = JSON.parse(raw) as CacheEntry;
        if (typeof entry.expiresAt !== "number" || entry.expiresAt < Date.now()) {
            store.removeItem(key);
            return null;
        }
        return entry.models;
    } catch {
        store.removeItem(key);
        return null;
    }
}

async function cachePut(
    provider: AIProvider,
    apiKey: string,
    models: ModelInfo[],
): Promise<void> {
    const store = cacheStore();
    if (!store) return;
    const key = await cacheKey(provider, apiKey);
    try {
        store.setItem(
            key,
            JSON.stringify({models, expiresAt: Date.now() + CACHE_TTL_MS} satisfies CacheEntry),
        );
    } catch {
        // Storage quota or serialization failure; ignore so the
        // picker still works without a cache.
    }
}

export function clearModelCache(): void {
    const store = cacheStore();
    if (!store) return;
    const removable: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
            removable.push(k);
        }
    }
    for (const k of removable) store.removeItem(k);
}

// --- Filtering (mirrors backend) ----------------------------------------

const OPENAI_EXCLUDE_SUBSTRINGS = [
    "embedding",
    "whisper",
    "tts",
    "dall-e",
    "moderation",
    "search",
    "babbage",
    "davinci-002",
    "audio",
    "image",
    "transcribe",
    "realtime",
];

const GEMINI_EXCLUDE_SUBSTRINGS = ["embedding", "aqa", "vision"];

function isChatModelOpenAi(id: string): boolean {
    const lowered = id.toLowerCase();
    if (OPENAI_EXCLUDE_SUBSTRINGS.some((token) => lowered.includes(token))) {
        return false;
    }
    return (
        lowered.startsWith("gpt-") ||
        lowered.startsWith("o1") ||
        lowered.startsWith("o3")
    );
}

function isChatModelGemini(entry: {name?: string; supportedGenerationMethods?: string[]}): boolean {
    const name = (entry.name ?? "").toLowerCase();
    if (GEMINI_EXCLUDE_SUBSTRINGS.some((token) => name.includes(token))) {
        return false;
    }
    return (entry.supportedGenerationMethods ?? []).includes("generateContent");
}

function humanizeOpenAiName(id: string): string {
    let pretty = id.replace(/-/g, " ");
    if (pretty.startsWith("gpt ")) {
        pretty = "GPT-" + pretty.slice(4);
    }
    return pretty;
}

function openAiContextWindow(id: string): number | null {
    const lowered = id.toLowerCase();
    if (lowered.includes("gpt-4o") || lowered.includes("gpt-4.1")) return 128000;
    if (
        lowered.includes("gpt-4-turbo") ||
        lowered.startsWith("gpt-4-1106") ||
        lowered.startsWith("gpt-4-0125")
    ) {
        return 128000;
    }
    if (lowered.startsWith("gpt-4")) return 8192;
    if (lowered.startsWith("gpt-3.5")) return 16384;
    if (lowered.startsWith("o1") || lowered.startsWith("o3")) return 200000;
    return null;
}

// --- Provider calls -----------------------------------------------------

interface AnthropicModelsResponse {
    data?: Array<{id?: string; display_name?: string}>;
    error?: {message?: string};
}

export async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) return [];
    const cached = await cacheGet("anthropic", apiKey);
    if (cached) return cached;
    const response = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        },
    });
    const json = (await response.json().catch(() => ({}))) as AnthropicModelsResponse;
    if (response.status === 401 || response.status === 403) {
        throw new ApiError(response.status, "Anthropic: Invalid API key.", "anthropic");
    }
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new ApiError(response.status, `Anthropic: ${detail}`, "anthropic");
    }
    const models: ModelInfo[] = (json.data ?? [])
        .filter((entry): entry is {id: string; display_name?: string} => typeof entry.id === "string" && entry.id.length > 0)
        .map((entry) => ({
            id: entry.id,
            name: entry.display_name ?? entry.id,
            context_window: 200000,
            description: null,
        }));
    await cachePut("anthropic", apiKey, models);
    return models;
}

interface OpenAiModelsResponse {
    data?: Array<{id?: string}>;
    error?: {message?: string};
}

export async function fetchOpenAiModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) return [];
    const cached = await cacheGet("openai", apiKey);
    if (cached) return cached;
    const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {Authorization: `Bearer ${apiKey}`},
    });
    const json = (await response.json().catch(() => ({}))) as OpenAiModelsResponse;
    if (response.status === 401 || response.status === 403) {
        throw new ApiError(response.status, "OpenAI: Invalid API key.", "openai");
    }
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new ApiError(response.status, `OpenAI: ${detail}`, "openai");
    }
    const models: ModelInfo[] = (json.data ?? [])
        .map((entry) => entry.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .filter(isChatModelOpenAi)
        .map((id) => ({
            id,
            name: humanizeOpenAiName(id),
            context_window: openAiContextWindow(id),
            description: null,
        }))
        .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    await cachePut("openai", apiKey, models);
    return models;
}

interface GeminiModelsResponse {
    models?: Array<{
        name?: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
        inputTokenLimit?: number;
    }>;
    error?: {message?: string};
}

export async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) return [];
    const cached = await cacheGet("gemini", apiKey);
    if (cached) return cached;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {method: "GET"});
    const json = (await response.json().catch(() => ({}))) as GeminiModelsResponse;
    if (response.status === 401 || response.status === 403) {
        throw new ApiError(response.status, "Gemini: Invalid API key.", "gemini");
    }
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new ApiError(response.status, `Gemini: ${detail}`, "gemini");
    }
    const models: ModelInfo[] = (json.models ?? [])
        .filter(isChatModelGemini)
        .map((entry) => {
            const fullName = entry.name ?? "";
            const id = fullName.startsWith("models/") ? fullName.slice("models/".length) : fullName;
            return {
                id,
                name: entry.displayName ?? id,
                context_window: typeof entry.inputTokenLimit === "number" ? entry.inputTokenLimit : null,
                description: entry.description ?? null,
            };
        })
        .filter((m) => m.id.length > 0);
    await cachePut("gemini", apiKey, models);
    return models;
}

export async function fetchAvailableModels(
    provider: AIProvider,
    apiKey: string,
): Promise<ModelInfo[]> {
    if (provider === "anthropic") return fetchAnthropicModels(apiKey);
    if (provider === "openai") return fetchOpenAiModels(apiKey);
    if (provider === "gemini") return fetchGeminiModels(apiKey);
    throw new ApiError(400, `Unsupported provider: ${provider}`, String(provider));
}
