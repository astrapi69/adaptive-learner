/**
 * Browser-direct AI provider calls (Phase 10D).
 *
 * Each provider has its own HTTP shape; ``aiComplete`` dispatches
 * to the right one based on the active provider key. The Dexie
 * storage mode uses these clients straight from the user's
 * browser — no backend required.
 *
 * Cross-origin notes:
 *   - **Anthropic**: requires ``anthropic-dangerous-direct-browser-access: true``.
 *     This is Anthropic's explicit opt-in for browser callers and
 *     bypasses the CORS preflight rejection that the default
 *     setting enforces.
 *   - **OpenAI**: CORS is open by default; just include the
 *     ``Authorization: Bearer ${key}`` header.
 *   - **Gemini**: the v1beta REST endpoint accepts the API key
 *     as a query parameter (``?key=...``), no Authorization
 *     header. CORS is open.
 *
 * Errors are surfaced as ``ApiError`` (status + detail) so the
 * existing toast / GitHub-Issue mechanism on the frontend
 * doesn't need to branch.
 */

import {ApiError} from "../../api/client";
import type {AIProvider} from "../../lib/constants";

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/**
 * Default per-provider model. Mirrors the backend
 * ``DEFAULT_MODELS`` map in ``ai_orchestration.py``. Picked for
 * the cheap-and-fast tier — chat sessions don't need the high-
 * end model. A per-user override on UserSettings replaces these.
 */
/**
 * Default per-provider model. Picked for cost-effective use in
 * the cheap-and-fast tier; a per-user override on UserSettings
 * replaces these for power users.
 *
 * Anthropic default bumped 2026-05-20 from
 * ``claude-3-5-haiku-latest`` to ``claude-haiku-4-5-20251001``
 * after the v0.9.0 conversation-analysis launch surfaced
 * Haiku-3.5 unreliability at structured JSON output (preamble
 * text, midstream commentary, prose-wrapped JSON). Haiku 4.5
 * follows the system-prompt format instructions much more
 * tightly. The defensive ``extractJsonObject`` parser handles
 * the remaining edge cases.
 */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
    anthropic: "claude-haiku-4-5-20251001",
    openai: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
};

interface AiCompleteOptions {
    provider: AIProvider;
    model: string;
    apiKey: string;
    messages: ChatMessage[];
    /**
     * Hard cap on the assistant's reply length. ``256`` is enough
     * for the step-evaluator JSON; the learning route bumps this
     * to ``1024`` for the chat reply.
     */
    maxTokens?: number;
    /**
     * Optional AbortSignal — aborts the underlying ``fetch``. Used
     * by the import-page "Cancel" control so a long analysis can be
     * stopped without burning the rest of the provider call.
     */
    signal?: AbortSignal;
}

/** Assistant text plus the provider's response id, when available.
 *  The id anchors the EXP-033 AI-validation signature (AIV-09). */
export interface AiCompletion {
    text: string;
    /** Provider response id (OpenAI ``chatcmpl-…`` / Anthropic ``msg_…`` /
     *  Gemini ``responseId``), or undefined if the provider omitted it. */
    responseId?: string;
}

/**
 * Provider-agnostic entry point. Returns the assistant text on
 * success; throws ``ApiError`` on transport / auth / provider
 * failure so the caller renders a precise message in the toast.
 */
export async function aiComplete(opts: AiCompleteOptions): Promise<string> {
    return (await aiCompleteWithMeta(opts)).text;
}

/**
 * Like {@link aiComplete} but also returns the provider response id
 * (EXP-033 / AIV-09 signature). Same error semantics.
 */
export async function aiCompleteWithMeta(
    opts: AiCompleteOptions,
): Promise<AiCompletion> {
    const maxTokens = opts.maxTokens ?? 1024;
    switch (opts.provider) {
        case "anthropic":
            return anthropicComplete(
                opts.model,
                opts.apiKey,
                opts.messages,
                maxTokens,
                opts.signal,
            );
        case "openai":
            return openaiComplete(
                opts.model,
                opts.apiKey,
                opts.messages,
                maxTokens,
                opts.signal,
            );
        case "gemini":
            return geminiComplete(
                opts.model,
                opts.apiKey,
                opts.messages,
                maxTokens,
                opts.signal,
            );
    }
}

// ---- Anthropic --------------------------------------------------------

interface AnthropicResponse {
    id?: string;
    content?: Array<{type: string; text?: string}>;
    error?: {message?: string; type?: string};
}

async function anthropicComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    signal?: AbortSignal,
): Promise<AiCompletion> {
    // Anthropic separates ``system`` from ``messages``. Pull the
    // first system message out (the prompt orchestrator only
    // ever emits one) and pass it as a top-level field.
    const systemMessages = messages.filter((m) => m.role === "system");
    const conv = messages.filter((m) => m.role !== "system");
    const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages: conv.map((m) => ({role: m.role, content: m.content})),
    };
    if (systemMessages.length > 0) {
        body.system = systemMessages.map((m) => m.content).join("\n\n");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
        signal,
    });
    const json = (await response.json().catch(() => ({}))) as AnthropicResponse;
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new ApiError(response.status, `Anthropic: ${detail}`, "anthropic");
    }
    const first = json.content?.find((c) => c.type === "text");
    if (!first?.text) {
        throw new ApiError(502, "Anthropic returned no text content", "anthropic");
    }
    return {text: first.text, responseId: json.id};
}

// ---- OpenAI -----------------------------------------------------------

interface OpenAiResponse {
    id?: string;
    choices?: Array<{message?: {content?: string}}>;
    error?: {message?: string; type?: string};
}

async function openaiComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    signal?: AbortSignal,
): Promise<AiCompletion> {
    const body = {
        model,
        max_tokens: maxTokens,
        messages: messages.map((m) => ({role: m.role, content: m.content})),
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
    });
    const json = (await response.json().catch(() => ({}))) as OpenAiResponse;
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new ApiError(response.status, `OpenAI: ${detail}`, "openai");
    }
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.length === 0) {
        throw new ApiError(502, "OpenAI returned no text content", "openai");
    }
    return {text, responseId: json.id};
}

// ---- Gemini -----------------------------------------------------------

interface GeminiResponse {
    responseId?: string;
    candidates?: Array<{
        content?: {parts?: Array<{text?: string}>};
        finishReason?: string;
    }>;
    error?: {message?: string};
}

async function geminiComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    signal?: AbortSignal,
): Promise<AiCompletion> {
    // Gemini doesn't have a separate system field; we fold any
    // ``system`` messages into the first ``user`` part. Roles map
    // user -> "user", assistant -> "model".
    const systemMessages = messages.filter((m) => m.role === "system");
    const conv = messages.filter((m) => m.role !== "system");
    const contents = conv.map((m, idx) => {
        const role = m.role === "assistant" ? "model" : "user";
        const prefix =
            idx === 0 && systemMessages.length > 0 && m.role === "user"
                ? `${systemMessages.map((s) => s.content).join("\n\n")}\n\n`
                : "";
        return {role, parts: [{text: prefix + m.content}]};
    });
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            contents,
            generationConfig: {maxOutputTokens: maxTokens},
        }),
        signal,
    });
    const json = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new ApiError(response.status, `Gemini: ${detail}`, "gemini");
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || text.length === 0) {
        throw new ApiError(502, "Gemini returned no text content", "gemini");
    }
    return {text, responseId: json.responseId};
}

// ---- Streaming dispatch (v1.6.0 / Phase 19B-2) ----------------------------

interface AiStreamOptions extends AiCompleteOptions {
    /** Called for every text delta as it arrives from the provider. */
    onChunk: (delta: string) => void;
    /** Optional AbortSignal — aborts the underlying fetch. */
    signal?: AbortSignal;
}

/**
 * Browser-direct streaming variant of :func:`aiComplete`.
 *
 * All three provider APIs (Anthropic, OpenAI, Gemini) expose a
 * Server-Sent-Events-style streaming response that emits text
 * deltas as the model generates. The dispatcher routes by
 * provider and parses each provider's SSE / JSON-lines shape
 * into bare text deltas the caller can append to a UI bubble.
 *
 * Resolves when the stream ends (provider closes the connection
 * or sends ``[DONE]`` for OpenAI). Rejects on transport / auth
 * / parse failures, surfaced as ``ApiError`` so the existing
 * toast plumbing renders the right detail.
 */
export async function aiStream(opts: AiStreamOptions): Promise<void> {
    const maxTokens = opts.maxTokens ?? 1024;
    switch (opts.provider) {
        case "anthropic":
            return anthropicStream(
                opts.model,
                opts.apiKey,
                opts.messages,
                maxTokens,
                opts.onChunk,
                opts.signal,
            );
        case "openai":
            return openaiStream(
                opts.model,
                opts.apiKey,
                opts.messages,
                maxTokens,
                opts.onChunk,
                opts.signal,
            );
        case "gemini":
            return geminiStream(
                opts.model,
                opts.apiKey,
                opts.messages,
                maxTokens,
                opts.onChunk,
                opts.signal,
            );
    }
}

/**
 * Read the SSE-style body of a fetch response line by line.
 * Calls ``onFrame`` for every blank-line-separated frame's
 * ``data: ...`` content (one or more lines joined). Returns when
 * the stream closes.
 */
async function readEventStream(
    response: Response,
    onFrame: (data: string) => void,
): Promise<void> {
    if (!response.body) {
        throw new ApiError(502, "Provider returned empty body", "");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    try {
        while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, {stream: true});
            let separator = buffer.indexOf("\n\n");
            while (separator !== -1) {
                const frame = buffer.slice(0, separator);
                buffer = buffer.slice(separator + 2);
                // Concatenate every ``data:`` line in this frame.
                // Strip the optional single leading space per spec.
                const dataLines: string[] = [];
                for (const line of frame.split(/\r?\n/)) {
                    if (line.startsWith("data:")) {
                        const raw = line.slice(5);
                        dataLines.push(raw.startsWith(" ") ? raw.slice(1) : raw);
                    }
                }
                if (dataLines.length > 0) {
                    onFrame(dataLines.join("\n"));
                }
                separator = buffer.indexOf("\n\n");
            }
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {
            /* may already be released after abort */
        }
    }
}

async function anthropicStream(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    onChunk: (delta: string) => void,
    signal: AbortSignal | undefined,
): Promise<void> {
    // Same shape as anthropicComplete but ``stream: true`` flips
    // the response into SSE. Anthropic event types we read:
    //   - content_block_delta: ``{type, delta: {type, text}}``
    //   - everything else (message_start, ping, etc.): ignored.
    const systemMessages = messages.filter((m) => m.role === "system");
    const conv = messages.filter((m) => m.role !== "system");
    const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: conv.map((m) => ({role: m.role, content: m.content})),
    };
    if (systemMessages.length > 0) {
        body.system = systemMessages.map((m) => m.content).join("\n\n");
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!response.ok) {
        const txt = await response.text().catch(() => "");
        let detail = `HTTP ${response.status}`;
        try {
            const parsed = JSON.parse(txt) as {error?: {message?: string}};
            if (parsed?.error?.message) detail = parsed.error.message;
        } catch {
            /* not JSON */
        }
        throw new ApiError(response.status, `Anthropic: ${detail}`, "anthropic");
    }
    await readEventStream(response, (data) => {
        try {
            const event = JSON.parse(data) as {
                type?: string;
                delta?: {type?: string; text?: string};
            };
            if (event.type === "content_block_delta") {
                const text = event.delta?.text;
                if (typeof text === "string" && text.length > 0) {
                    onChunk(text);
                }
            }
        } catch {
            /* non-JSON keepalive */
        }
    });
}

async function openaiStream(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    onChunk: (delta: string) => void,
    signal: AbortSignal | undefined,
): Promise<void> {
    // OpenAI's SSE stream uses ``data: [DONE]`` as the end-of-
    // stream sentinel. Each non-sentinel frame is a JSON object
    // shaped ``{choices: [{delta: {content?: string}}]}``.
    const body = {
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: messages.map((m) => ({role: m.role, content: m.content})),
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!response.ok) {
        const txt = await response.text().catch(() => "");
        let detail = `HTTP ${response.status}`;
        try {
            const parsed = JSON.parse(txt) as {error?: {message?: string}};
            if (parsed?.error?.message) detail = parsed.error.message;
        } catch {
            /* not JSON */
        }
        throw new ApiError(response.status, `OpenAI: ${detail}`, "openai");
    }
    await readEventStream(response, (data) => {
        if (data === "[DONE]") return;
        try {
            const event = JSON.parse(data) as {
                choices?: Array<{delta?: {content?: string | null}}>;
            };
            const content = event.choices?.[0]?.delta?.content;
            if (typeof content === "string" && content.length > 0) {
                onChunk(content);
            }
        } catch {
            /* keepalive / non-JSON */
        }
    });
}

async function geminiStream(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    onChunk: (delta: string) => void,
    signal: AbortSignal | undefined,
): Promise<void> {
    // Gemini's ``streamGenerateContent`` endpoint returns
    // newline-delimited JSON objects rather than SSE. Each line
    // is a ``GenerateContentResponse``-shaped object that may
    // carry text in ``candidates[0].content.parts[*].text``.
    const systemMessages = messages.filter((m) => m.role === "system");
    const conv = messages.filter((m) => m.role !== "system");
    const contents = conv.map((m, idx) => {
        const role = m.role === "assistant" ? "model" : "user";
        const prefix =
            idx === 0 && systemMessages.length > 0 && m.role === "user"
                ? `${systemMessages.map((s) => s.content).join("\n\n")}\n\n`
                : "";
        return {role, parts: [{text: prefix + m.content}]};
    });
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:streamGenerateContent?alt=sse` +
        `&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            contents,
            generationConfig: {maxOutputTokens: maxTokens},
        }),
        signal,
    });
    if (!response.ok) {
        const txt = await response.text().catch(() => "");
        let detail = `HTTP ${response.status}`;
        try {
            const parsed = JSON.parse(txt) as {error?: {message?: string}};
            if (parsed?.error?.message) detail = parsed.error.message;
        } catch {
            /* not JSON */
        }
        throw new ApiError(response.status, `Gemini: ${detail}`, "gemini");
    }
    // ``alt=sse`` switches Gemini's stream to the same data-line
    // SSE wire shape Anthropic + OpenAI use; ``readEventStream``
    // covers all three.
    await readEventStream(response, (data) => {
        try {
            const event = JSON.parse(data) as {
                candidates?: Array<{
                    content?: {parts?: Array<{text?: string}>};
                }>;
            };
            const parts = event.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    const text = part?.text;
                    if (typeof text === "string" && text.length > 0) {
                        onChunk(text);
                    }
                }
            }
        } catch {
            /* keepalive / non-JSON */
        }
    });
}

/**
 * Resolve the effective model for a provider: a non-empty
 * override wins over the default. Mirrors the backend
 * ``resolve_model``.
 */
export function resolveModel(
    provider: AIProvider,
    override: string | null,
): string {
    if (typeof override === "string" && override.trim().length > 0) {
        return override.trim();
    }
    return DEFAULT_MODELS[provider];
}
