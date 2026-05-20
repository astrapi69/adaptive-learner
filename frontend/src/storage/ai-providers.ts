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

import {ApiError} from "../api/client";
import type {AIProvider} from "../lib/constants";

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
}

/**
 * Provider-agnostic entry point. Returns the assistant text on
 * success; throws ``ApiError`` on transport / auth / provider
 * failure so the caller renders a precise message in the toast.
 */
export async function aiComplete(opts: AiCompleteOptions): Promise<string> {
    const maxTokens = opts.maxTokens ?? 1024;
    switch (opts.provider) {
        case "anthropic":
            return anthropicComplete(opts.model, opts.apiKey, opts.messages, maxTokens);
        case "openai":
            return openaiComplete(opts.model, opts.apiKey, opts.messages, maxTokens);
        case "gemini":
            return geminiComplete(opts.model, opts.apiKey, opts.messages, maxTokens);
    }
}

// ---- Anthropic --------------------------------------------------------

interface AnthropicResponse {
    content?: Array<{type: string; text?: string}>;
    error?: {message?: string; type?: string};
}

async function anthropicComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
): Promise<string> {
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
    return first.text;
}

// ---- OpenAI -----------------------------------------------------------

interface OpenAiResponse {
    choices?: Array<{message?: {content?: string}}>;
    error?: {message?: string; type?: string};
}

async function openaiComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
): Promise<string> {
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
    return text;
}

// ---- Gemini -----------------------------------------------------------

interface GeminiResponse {
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
): Promise<string> {
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
    return text;
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
