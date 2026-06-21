/**
 * Browser-direct pronunciation AI for Dexie mode (#903).
 *
 * Ports the backend ``adaptive_learner_session.pronunciation`` phrase generator
 * + judge so Dexie-mode users (GitHub Pages / PWA) can practise with their own
 * API key — the same browser-direct pattern as the study guide (#902) and Anki
 * extraction (#807). Both calls are plain text completions: the gate is "is a
 * key configured?", not "is the backend reachable?".
 */

import { aiComplete } from "../../storage/ai/ai-providers";
import type { DexieAiConfig } from "../../storage/anki/anki-extraction";
import type { PronunciationVerdict } from "../../storage/types";

// ---------------------------------------------------------------------------
// Phrase generator — prompt + parser (ports pronunciation.generate_phrase)
// ---------------------------------------------------------------------------

const PHRASE_PROMPT = `You are a pronunciation coach. Generate ONE short phrase in {language} for the learner to practice pronouncing aloud.

Rules:
- {level} difficulty.
- 3 to 10 words.
- Use common, conversational vocabulary that highlights {focus}.
- Output JSON ONLY: {"phrase": "..."} — no prose, no markdown.

{previous_clause}`;

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function levelLabel(level: string): string {
  return LEVEL_LABELS[level.toLowerCase()] ?? "Beginner";
}

/** Render the phrase-generator prompt; avoids the learner's last 5 phrases. */
export function buildPhrasePrompt(args: {
  language: string;
  level?: string;
  focus?: string;
  previous?: string[];
}): string {
  const recent = (args.previous ?? []).slice(-5);
  const previousClause =
    recent.length > 0
      ? `Avoid these phrases the learner just practised: ${recent.join("; ")}`
      : "";
  return PHRASE_PROMPT.replace("{language}", args.language)
    .replace("{level}", levelLabel(args.level ?? "beginner"))
    .replace("{focus}", args.focus ?? "common sounds")
    .replace("{previous_clause}", previousClause);
}

/** Tolerantly parse the ``{"phrase": "..."}`` JSON; ``null`` on failure. */
export function parsePhrase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const phrase = String((data as Record<string, unknown>).phrase ?? "").trim();
  return phrase || null;
}

// ---------------------------------------------------------------------------
// Judge — prompt + parser (ports pronunciation.judge_attempt)
// ---------------------------------------------------------------------------

const JUDGE_PROMPT = `You are a pronunciation coach scoring one attempt.

Target phrase (in {language}): {target}
What the learner said (auto-transcribed; may have STT errors): {actual}

Return strict JSON only — no prose, no markdown fences:
{
  "matches": true,
  "score": 0.85,
  "feedback": "Short tip (1 sentence).",
  "missed_sounds": ["h", "r"]
}

Score guidance: 1.0 = identical, 0.9 = minor differences, 0.7 = recognisable, 0.5 = several errors, 0.3 = barely. matches=true iff score >= 0.7.

Be kind. The transcription may add noise — judge by ear, not by exact text.`;

export function buildJudgePrompt(args: {
  target: string;
  actual: string;
  language: string;
}): string {
  return JUDGE_PROMPT.replace("{language}", args.language)
    .replace("{target}", args.target)
    .replace("{actual}", args.actual);
}

/** Tolerantly parse the judge verdict; ``null`` on failure. Coerces
 *  out-of-range / wrong-typed fields the way the backend parser does. */
export function parseJudge(
  raw: string | null | undefined,
): PronunciationVerdict | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const bag = data as Record<string, unknown>;

  let score = 0;
  const rawScore = bag.score;
  if (typeof rawScore === "number") score = rawScore;
  else if (typeof rawScore === "string") score = Number.parseFloat(rawScore) || 0;
  score = Math.max(0, Math.min(1, score));

  const rawMatches = bag.matches;
  let matches: boolean;
  if (typeof rawMatches === "boolean") matches = rawMatches;
  else if (typeof rawMatches === "string")
    matches = ["true", "yes", "1"].includes(rawMatches.trim().toLowerCase());
  else matches = score >= 0.7;

  const feedback = String(bag.feedback ?? "").trim();
  const rawMissed = Array.isArray(bag.missed_sounds) ? bag.missed_sounds : [];
  const missed_sounds = rawMissed
    .filter((m): m is string | number => typeof m === "string" || typeof m === "number")
    .map((m) => String(m).trim())
    .filter((m) => m.length > 0);

  return { matches, score, feedback, missed_sounds };
}

// ---------------------------------------------------------------------------
// Browser-direct calls
// ---------------------------------------------------------------------------

/** Generate one practice phrase browser-direct; ``null`` on AI/parse failure. */
export async function generatePhrase(
  config: DexieAiConfig,
  args: { language: string; level?: string; focus?: string; previous?: string[] },
): Promise<string | null> {
  const raw = await aiComplete({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    messages: [{ role: "user", content: buildPhrasePrompt(args) }],
    maxTokens: 200,
  });
  return parsePhrase(raw);
}

/** Judge one attempt browser-direct; ``null`` on empty input or AI/parse failure. */
export async function judgeAttempt(
  config: DexieAiConfig,
  args: { target: string; actual: string; language: string },
): Promise<PronunciationVerdict | null> {
  if (!args.target.trim() || !args.actual.trim()) return null;
  const raw = await aiComplete({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    messages: [{ role: "user", content: buildJudgePrompt(args) }],
    maxTokens: 300,
  });
  return parseJudge(raw);
}
