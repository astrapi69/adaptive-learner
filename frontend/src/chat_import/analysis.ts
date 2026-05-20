/**
 * Conversation analysis engine (Phase 12D).
 *
 * Browser-direct AI call that turns an imported conversation
 * into a structured 'ConversationAnalysisResult'. Mirrors the
 * step-evaluator pattern (storage/step-evaluator.ts) for the
 * JSON-parse contract:
 *
 *   - Always returns a result; 'fallback_used=true' when the
 *     model output couldn't be parsed.
 *   - Strips markdown code fences before JSON.parse.
 *   - Clamps enum-shaped fields to the schema's expected values.
 *
 * Chunking: when the transcript exceeds 'MAX_CHUNK_CHARS' (a
 * proxy for token count — ~4 chars per token is the standard
 * rule of thumb), the engine splits messages into windows with
 * 2-message overlap so each chunk carries enough surrounding
 * context. Results merge field-by-field; the chunk summaries
 * land in 'chunk_summaries' so the UI can show per-segment
 * detail.
 */

import {aiComplete, resolveModel} from "../storage/ai-providers";
import type {AIProvider, LearningMethod} from "../lib/constants";
import {extractJsonObject} from "../lib/extract-json";
import type {
    AnalysisSuggestedLesson,
    ConversationAnalysisResult,
} from "../types/domain";
import type {NormalizedMessage} from "./types";

const VALID_METHODS: LearningMethod[] = [
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
];

const VALID_LEVELS: ConversationAnalysisResult["user_level"][] = [
    "beginner",
    "intermediate",
    "advanced",
];

/**
 * Characters-per-chunk threshold. ~16000 chars ≈ 4000 tokens
 * input, leaving room for the system prompt + response budget
 * on a 16k-token-context model. Older Claude / Gemini models
 * with 8k contexts would still split fine because the chunk
 * carries only the transcript, not the full prompt scaffold.
 */
export const MAX_CHUNK_CHARS = 16_000;

const SYSTEM_PROMPT = [
    "You are an analysis assistant for an adaptive learning system.",
    "The user pastes or imports a transcript of a learning-related",
    "conversation they had with an AI. Your job is to extract",
    "structured learning insights from it.",
    "",
    "OUTPUT FORMAT (MUST follow exactly):",
    "",
    "1. Your response MUST start with the character `{` and end with `}`.",
    "2. NO text before the opening `{`. No 'Here is...', no 'Sure...',",
    "   no 'I'll analyze...', no preamble of any kind.",
    "3. NO text after the closing `}`. No explanations, no offers to",
    "   provide more detail, no follow-up commentary.",
    "4. NO markdown code fences (no ``` or ```json).",
    "5. NO comments inside the JSON (// or /* */ are forbidden).",
    "6. The response must be parseable by JSON.parse() as a single object.",
    "",
    "Failure to follow these rules breaks the calling system. If you",
    "include ANY characters before `{` or after `}` the parser fails",
    "and the user sees an error instead of analysis.",
    "",
    "JSON SCHEMA:",
    "",
    "  {",
    '    "topic":               <string, the dominant subject>,',
    '    "subtopics":           [<string>, ...],',
    '    "user_level":          "beginner" | "intermediate" | "advanced",',
    '    "strengths":           [<string>, ...],',
    '    "weaknesses":          [<string>, ...],',
    '    "error_patterns":      [<string>, ...],',
    '    "recommended_method":  "deductive" | "inductive" | "error_based"',
    '                           | "dialogic" | "contextual" | "ai_adaptive",',
    '    "recommended_focus":   <string, one-sentence action>,',
    '    "suggested_curriculum": [',
    '      {"title": <string>, "description": <string>, "priority": <int 1-5>},',
    "      ...",
    "    ],",
    '    "summary":             <string, 1-2 sentences for the UI header>',
    "  }",
    "",
    "If you cannot determine a value for an optional field, OMIT the",
    "field entirely. Do NOT insert null, empty strings, or placeholder",
    "text.",
    "",
    "FIELD SEMANTICS:",
    "- 'strengths': what the user already grasps. Concrete, not",
    "  generic praise.",
    "- 'weaknesses': recurring gaps, confusions, or unfinished",
    "  threads in the conversation.",
    "- 'error_patterns': specific repeated mistakes the user made",
    "  (not the same as weaknesses — these are observable errors).",
    "- 'recommended_method': the six-method learning model:",
    "    deductive   — rule then examples",
    "    inductive   — examples then rule",
    "    error_based — fix mistakes as the path to insight",
    "    dialogic    — back-and-forth questioning",
    "    contextual  — anchor in the user's real-world situation",
    "    ai_adaptive — user steers the AI, self-directed",
    "- 'suggested_curriculum': 2-5 lesson stubs the user could",
    "  tackle next. 'priority' 1 = highest.",
    "",
    "Be specific. 'User struggled with concepts' is useless;",
    "'User confused inductive reasoning with abductive reasoning,",
    "treating any inference-from-examples as induction' is useful.",
    "",
    "If a section is genuinely empty, return an empty array — don't",
    "invent material.",
    "",
    "REMINDER: start your response with `{`. End with `}`. Nothing else.",
].join("\n");

export interface AnalysisOptions {
    provider: AIProvider;
    apiKey: string;
    modelOverride: string | null;
    messages: NormalizedMessage[];
    /** Conversation title; passed to the AI as context. */
    title?: string;
    /** Override the chunk threshold (testing). */
    maxChunkChars?: number;
}

/**
 * Build the user-message body for one analysis call. Includes
 * the title (when present) plus the transcript in a labelled
 * format so the model knows who said what.
 */
export function buildAnalysisUserContent(
    messages: NormalizedMessage[],
    title?: string,
): string {
    const turns = messages.map((m) => {
        const label =
            m.role === "user" ? "Learner" : m.role === "assistant" ? "AI" : "(system)";
        return `${label}: ${m.content}`;
    });
    const transcript = turns.join("\n\n");
    const titleLine = title ? `Title: ${title}\n\n` : "";
    return (
        `${titleLine}--- transcript ---\n${transcript}\n--- end transcript ---\n\n` +
        `Return only the JSON analysis. No surrounding prose.`
    );
}

/**
 * Split the transcript into overlapping chunks. Each chunk
 * carries up to 'maxChars' characters; consecutive chunks
 * share the LAST two messages of the previous chunk so the
 * model sees enough context to keep the analysis coherent.
 */
export function chunkMessages(
    messages: NormalizedMessage[],
    maxChars: number = MAX_CHUNK_CHARS,
): NormalizedMessage[][] {
    if (messages.length === 0) return [];
    const chunks: NormalizedMessage[][] = [];
    let buffer: NormalizedMessage[] = [];
    let bufferSize = 0;
    for (const msg of messages) {
        const msgSize = msg.content.length + msg.role.length + 4;
        if (bufferSize + msgSize > maxChars && buffer.length > 0) {
            chunks.push(buffer);
            // Carry the last 2 messages as overlap so the next
            // chunk has surrounding context.
            const overlap = buffer.slice(-2);
            buffer = [...overlap];
            bufferSize = overlap.reduce(
                (sum, m) => sum + m.content.length + m.role.length + 4,
                0,
            );
        }
        buffer.push(msg);
        bufferSize += msgSize;
    }
    if (buffer.length > 0) chunks.push(buffer);
    return chunks;
}

function clampMethod(value: unknown): LearningMethod | undefined {
    if (typeof value !== "string") return undefined;
    const lc = value.trim().toLowerCase().replace(/[\s-]/g, "_");
    const match = VALID_METHODS.find((m) => m === lc);
    return match;
}

function clampLevel(value: unknown): ConversationAnalysisResult["user_level"] {
    if (typeof value !== "string") return undefined;
    const lc = value.trim().toLowerCase();
    const match = VALID_LEVELS.find((l) => l === lc);
    return match;
}

function asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out = value
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((s) => s.trim());
    return out.length > 0 ? out : undefined;
}

function asLessonArray(value: unknown): AnalysisSuggestedLesson[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out: AnalysisSuggestedLesson[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;
        const obj = entry as Record<string, unknown>;
        const title = typeof obj.title === "string" ? obj.title.trim() : "";
        const description =
            typeof obj.description === "string" ? obj.description.trim() : "";
        if (!title) continue;
        let priority = 3;
        if (typeof obj.priority === "number" && Number.isFinite(obj.priority)) {
            priority = Math.max(1, Math.min(5, Math.trunc(obj.priority)));
        }
        out.push({title, description, priority});
    }
    return out.length > 0 ? out : undefined;
}

/**
 * Strip code fences + extract a balanced ``{...}`` block, then
 * project it onto the ``ConversationAnalysisResult`` schema.
 * Returns ``null`` on any structural problem.
 *
 * Defensive against the common Haiku / GPT-4o-mini misbehaviours:
 *   - Preamble: ``Sure! Here is the analysis:\n{...}\nLet me know!``
 *   - Markdown fences: ``\`\`\`json\n{...}\n\`\`\```
 *   - Curly braces in surrounding prose: ``... {placeholder} ... {actual_json}``
 *   - Trailing commentary with its own braces
 */
export function parseAnalysisResponse(
    raw: string | null,
): ConversationAnalysisResult | null {
    if (typeof raw !== "string" || raw.trim() === "") return null;
    const obj = extractJsonObject(raw);
    if (obj === null) return null;
    const result: ConversationAnalysisResult = {};
    if (typeof obj.topic === "string" && obj.topic.trim()) {
        result.topic = obj.topic.trim();
    }
    const subtopics = asStringArray(obj.subtopics);
    if (subtopics) result.subtopics = subtopics;
    const level = clampLevel(obj.user_level);
    if (level) result.user_level = level;
    const strengths = asStringArray(obj.strengths);
    if (strengths) result.strengths = strengths;
    const weaknesses = asStringArray(obj.weaknesses);
    if (weaknesses) result.weaknesses = weaknesses;
    const errors = asStringArray(obj.error_patterns);
    if (errors) result.error_patterns = errors;
    const method = clampMethod(obj.recommended_method);
    if (method) result.recommended_method = method;
    if (
        typeof obj.recommended_focus === "string" &&
        obj.recommended_focus.trim()
    ) {
        result.recommended_focus = obj.recommended_focus.trim();
    }
    const lessons = asLessonArray(obj.suggested_curriculum);
    if (lessons) result.suggested_curriculum = lessons;
    if (typeof obj.summary === "string" && obj.summary.trim()) {
        result.summary = obj.summary.trim();
    }
    return result;
}

/**
 * Empty analysis with 'fallback_used: true'. The UI surfaces
 * a "we couldn't parse the response" hint when this is
 * returned so the user knows to retry or pick a different
 * provider.
 */
export function deterministicFallback(
    title?: string,
): ConversationAnalysisResult {
    return {
        topic: title?.trim() || "Unrecognised topic",
        summary:
            "The AI response could not be parsed into structured analysis. " +
            "You can re-run the analysis, or pick a different AI provider.",
        fallback_used: true,
    };
}

/**
 * Merge two analysis results. Used when chunking the transcript:
 * each chunk's analysis is folded into the running aggregate so
 * the final result reflects the whole conversation.
 *
 * Strategy:
 *   - Strings (topic, recommended_focus, summary): keep the
 *     first non-empty value (the earliest chunk's framing
 *     usually sets the top-level scope).
 *   - user_level: keep the highest seen level
 *     (beginner < intermediate < advanced) so a conversation
 *     that advances over time gets the right floor.
 *   - Arrays (subtopics, strengths, weaknesses, error_patterns,
 *     suggested_curriculum): concat + dedupe by canonical key.
 *   - recommended_method: keep the first seen.
 */
export function mergeAnalyses(
    base: ConversationAnalysisResult,
    next: ConversationAnalysisResult,
): ConversationAnalysisResult {
    const out: ConversationAnalysisResult = {...base};
    if (!out.topic && next.topic) out.topic = next.topic;
    if (!out.summary && next.summary) out.summary = next.summary;
    if (!out.recommended_focus && next.recommended_focus)
        out.recommended_focus = next.recommended_focus;
    if (!out.recommended_method && next.recommended_method)
        out.recommended_method = next.recommended_method;
    if (next.user_level) {
        const order = ["beginner", "intermediate", "advanced"] as const;
        const current = out.user_level
            ? order.indexOf(out.user_level)
            : -1;
        const incoming = order.indexOf(next.user_level);
        if (incoming > current) out.user_level = next.user_level;
    }
    out.subtopics = mergeStrings(out.subtopics, next.subtopics);
    out.strengths = mergeStrings(out.strengths, next.strengths);
    out.weaknesses = mergeStrings(out.weaknesses, next.weaknesses);
    out.error_patterns = mergeStrings(out.error_patterns, next.error_patterns);
    out.suggested_curriculum = mergeLessons(
        out.suggested_curriculum,
        next.suggested_curriculum,
    );
    return out;
}

function mergeStrings(a?: string[], b?: string[]): string[] | undefined {
    const items = [...(a ?? []), ...(b ?? [])];
    if (items.length === 0) return undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
        const key = item.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
        }
    }
    return out;
}

function mergeLessons(
    a?: AnalysisSuggestedLesson[],
    b?: AnalysisSuggestedLesson[],
): AnalysisSuggestedLesson[] | undefined {
    const items = [...(a ?? []), ...(b ?? [])];
    if (items.length === 0) return undefined;
    const seen = new Set<string>();
    const out: AnalysisSuggestedLesson[] = [];
    for (const item of items) {
        const key = item.title.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
        }
    }
    return out;
}

/**
 * End-to-end analysis. Splits the transcript if necessary,
 * fires one AI call per chunk, merges the results. Always
 * returns a result — provider errors collapse to the
 * deterministic fallback so callers don't need to wrap.
 */
export async function analyzeConversation(
    opts: AnalysisOptions,
): Promise<ConversationAnalysisResult> {
    const maxChars = opts.maxChunkChars ?? MAX_CHUNK_CHARS;
    const chunks = chunkMessages(opts.messages, maxChars);
    if (chunks.length === 0) {
        return deterministicFallback(opts.title);
    }
    const chunkResults: ConversationAnalysisResult[] = [];
    for (const chunk of chunks) {
        const userContent = buildAnalysisUserContent(chunk, opts.title);
        let raw: string;
        try {
            raw = await aiComplete({
                provider: opts.provider,
                model: resolveModel(opts.provider, opts.modelOverride),
                apiKey: opts.apiKey,
                messages: [
                    {role: "system", content: SYSTEM_PROMPT},
                    {role: "user", content: userContent},
                ],
                maxTokens: 1500,
            });
        } catch (err) {
            // Surface the provider error message as part of the
            // fallback so the user knows what went wrong.
            const detail =
                err instanceof Error ? err.message : "unknown AI error";
            const fb = deterministicFallback(opts.title);
            fb.summary = `${fb.summary} (provider: ${detail})`;
            chunkResults.push(fb);
            continue;
        }
        const parsed = parseAnalysisResponse(raw);
        if (parsed) {
            chunkResults.push(parsed);
        } else {
            chunkResults.push(deterministicFallback(opts.title));
        }
    }
    let merged = chunkResults[0];
    for (let i = 1; i < chunkResults.length; i++) {
        merged = mergeAnalyses(merged, chunkResults[i]);
    }
    if (chunks.length > 1) {
        merged.chunk_summaries = chunkResults
            .map((r, idx) =>
                r.summary ? `Chunk ${idx + 1}: ${r.summary}` : `Chunk ${idx + 1}`,
            )
            .filter(Boolean);
    }
    return merged;
}
