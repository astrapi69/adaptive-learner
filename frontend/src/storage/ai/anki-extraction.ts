/**
 * Browser-direct Anki card extraction for Dexie mode (#807).
 *
 * Ports the backend ``adaptive_learner_anki.card_extraction`` prompt +
 * tolerant JSON parser so Dexie-mode users (GitHub Pages / PWA) can extract
 * flashcards from a transcript with their own API key — the same way
 * analysis, the AI content-check, and sessions already call providers
 * browser-direct. Works for ANY material: language vocabulary AND knowledge
 * concepts (Ansible / IT / psychology), not just ``analysis.vocabulary``.
 */

import type { AIProvider } from "../../lib/constants";
import { aiComplete, resolveModel } from "./ai-providers";
import { getDb } from "../db/db";

/** One parsed flashcard candidate. Shape matches the vocabulary-derived
 *  cards so persistence is uniform. */
export interface ExtractedCard {
  card_type: "basic" | "cloze";
  front: string;
  back: string;
  tags: string[];
}

/** Resolved browser-direct AI config, or ``null`` when no key is set. */
export interface DexieAiConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

const EXTRACTION_PROMPT = `You are a flashcard generator. Read the following learning material and extract up to {limit} high-value flashcards.

Output STRICT JSON only — an array of objects with this shape:
[
  {"type": "basic", "front": "Q", "back": "A", "tags": ["t1"]},
  {"type": "cloze", "front": "Sentence with {{c1::blank}}", "back": "extra info or empty", "tags": []}
]

Rules:
- type is "basic" or "cloze" only.
- Cloze cards use Anki's {{c1::word}} syntax in the front field.
- Tags are short lowercase words; lists may be empty.
- Skip trivial recall (definitions everyone already knows).
- Prefer concepts the learner struggled with or asked about.
- Output the array only — no prose, no markdown fences.

Material:
{content}`;

/** Render the extraction prompt with the material clipped to ~8000 chars
 *  (≈ 2000 tokens, fits any modern context with room for the response). */
export function buildExtractionPrompt(content: string, limit = 8): string {
  return EXTRACTION_PROMPT.replace("{limit}", String(limit)).replace(
    "{content}",
    content.slice(0, 8000),
  );
}

/**
 * Tolerant parser for an AI-emitted card array. Strips a ```json fence,
 * skips malformed rows, and returns ``[]`` on any parse failure (the caller
 * treats that as "no cards extracted" rather than an error). Mirrors the
 * backend ``parse_response``.
 */
export function parseExtractedCards(raw: string | null | undefined): ExtractedCard[] {
  if (!raw) return [];
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: ExtractedCard[] = [];
  for (const row of data) {
    if (typeof row !== "object" || row === null) continue;
    const bag = row as Record<string, unknown>;
    const card_type = String(bag.type ?? "basic").toLowerCase();
    if (card_type !== "basic" && card_type !== "cloze") continue;
    const front = String(bag.front ?? "").trim();
    if (!front) continue;
    const back = String(bag.back ?? "").trim();
    const rawTags = Array.isArray(bag.tags) ? bag.tags : [];
    const tags = rawTags
      .filter((t): t is string | number => typeof t === "string" || typeof t === "number")
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
    out.push({ card_type, front, back, tags });
  }
  return out;
}

/** Resolve the user's active provider + key + model from IndexedDB, or
 *  ``null`` when no active provider / key is configured (the caller then
 *  falls back or reports "API key required"). */
export async function resolveDexieAiConfig(
  userId: string,
): Promise<DexieAiConfig | null> {
  const db = getDb();
  const settings = await db.userSettings.where("user_id").equals(userId).first();
  if (!settings) return null;
  const bag = settings as unknown as Record<string, unknown>;
  const provider = bag.active_provider as AIProvider | undefined;
  if (!provider) return null;
  const apiKey = bag[`api_key_${provider}`];
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) return null;
  const override = (bag[`model_override_${provider}`] as string | null) ?? null;
  return { provider, model: resolveModel(provider, override), apiKey };
}

/** Browser-direct AI extraction: run ``content`` through the provider and
 *  return the parsed cards (possibly empty). Throws only on a provider/network
 *  error (surfaced by the caller). */
export async function aiExtractCards(
  config: DexieAiConfig,
  content: string,
): Promise<ExtractedCard[]> {
  const raw = await aiComplete({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    messages: [{ role: "user", content: buildExtractionPrompt(content) }],
    maxTokens: 1500,
  });
  return parseExtractedCards(raw);
}
