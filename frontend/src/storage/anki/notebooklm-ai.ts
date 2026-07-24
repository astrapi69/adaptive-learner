/**
 * Browser-direct NotebookLM AI generators for Dexie mode (#902).
 *
 * Ports the backend ``adaptive_learner_notebooklm`` study-guide +
 * active-recall-question prompts so Dexie-mode users (GitHub Pages / PWA) can
 * generate them with their own API key — the same way analysis, the AI
 * content-check, sessions, and Anki extraction (#807) already call providers
 * browser-direct.
 *
 * Before this change the Dexie path threw "requires API mode" unconditionally,
 * which is wrong when the user HAS a key: the gate should be "is a key
 * configured?", not "is the backend reachable?".
 */

import { aiComplete } from "../ai/ai-providers";
import { getDb } from "../dexie/db";
import { resolveDexieAiConfig, type DexieAiConfig } from "./anki-extraction";
import type {
  StudyQuestionDifficulty,
  StudyQuestionType,
} from "../types";

const _MAX_CONTEXT_CHARS = 30_000;
const _TRANSCRIPT_CLIP = 8000;

const _ALLOWED_TYPES = new Set<StudyQuestionType>([
  "open",
  "fill_blank",
  "explain",
  "compare",
]);
const _ALLOWED_DIFFICULTIES = new Set<StudyQuestionDifficulty>([
  "easy",
  "medium",
  "hard",
]);

// ---------------------------------------------------------------------------
// Study guide — prompt + parser (ports study_guide_generator.py)
// ---------------------------------------------------------------------------

const _STUDY_GUIDE_HEADER = `You are a study guide author. Produce a comprehensive Markdown study guide for the project below.

Structure:
1. Title (H1) - the project's topic.
2. Overview (H2) - one paragraph: goal + timeframe + level.
3. Key Concepts (H2) - H3 per concept, 1-2 paragraph summary each.
4. Common Mistakes (H2) - bullet list with brief corrections.
5. Practice Exercises (H2) - 5-10 exercises across difficulty levels.
6. Vocabulary (H2) - IF the project is a language-learning one; otherwise omit. Table of word | translation | example.
7. Further Study (H2) - 3-5 next-step suggestions.

Rules:
- Output Markdown ONLY. No prose framing, no JSON, no code fences around the whole thing.
- Use short paragraphs (NotebookLM-optimised).
- Use H2 for sections, H3 for sub-concepts.
- Cite content from the project - don't invent topics that aren't there.

Project data follows:

`;

/** One vocabulary entry pulled from an analyzed conversation. */
interface VocabEntry {
  word: string;
  translation: string;
  example: string;
}

/** Project context assembled for the study-guide prompt. */
export interface StudyGuideContext {
  topic: string;
  goal: string;
  timeframe: string;
  daily_minutes: number | string;
  profile: Record<string, number>;
  vocabulary: VocabEntry[];
  sessions: { method: string; started_at: string | null; messages: string }[];
}

/** Render the study-guide prompt with the project context clipped to
 *  ``_MAX_CONTEXT_CHARS`` (oldest sessions truncated first). */
export function buildStudyGuidePrompt(ctx: StudyGuideContext): string {
  const pieces: string[] = [
    `Topic: ${ctx.topic || "unknown"}`,
    `Goal: ${ctx.goal || "unknown"}`,
    `Timeframe: ${ctx.timeframe || "unknown"}`,
    `Daily minutes: ${ctx.daily_minutes || "unknown"}`,
  ];
  const profileKeys = Object.keys(ctx.profile);
  if (profileKeys.length > 0) {
    pieces.push("\nLearning profile (method weights):");
    for (const k of profileKeys) pieces.push(`  - ${k}: ${ctx.profile[k]}`);
  }
  if (ctx.vocabulary.length > 0) {
    pieces.push("\nVocabulary entries (from analyzed conversations):");
    for (const v of ctx.vocabulary.slice(0, 50)) {
      const example = v.example ? ` - ${v.example}` : "";
      pieces.push(`  - ${v.word || "?"} → ${v.translation || "?"}${example}`);
    }
  }
  if (ctx.sessions.length > 0) {
    pieces.push("\nRecent sessions (newest first):");
    let running = pieces.join("\n");
    for (const sess of ctx.sessions) {
      const header = `\n=== Session ${sess.started_at ?? "?"} (${sess.method || "?"}) ===`;
      const block = `${header}\n${sess.messages ?? ""}`;
      if (running.length + block.length > _MAX_CONTEXT_CHARS) {
        const remaining = _MAX_CONTEXT_CHARS - running.length;
        if (remaining < 200) break;
        pieces.push(block.slice(0, remaining) + "\n[...truncated...]");
        break;
      }
      pieces.push(block);
      running += block;
    }
  }
  return _STUDY_GUIDE_HEADER + pieces.join("\n");
}

/** Strip an outer ```markdown fence if the model wrapped its output. */
export function parseStudyGuide(raw: string | null | undefined): string {
  if (!raw) return "";
  const stripped = raw.trim();
  const fence = stripped.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/);
  return fence ? fence[1].trim() : stripped;
}

// ---------------------------------------------------------------------------
// Study questions — prompt + parser (ports question_generator.py)
// ---------------------------------------------------------------------------

const _QUESTION_PROMPT = `You are an active-recall question generator for a self-learner.

Read the following learning material and produce {limit} high-value study questions.

Output STRICT JSON only - an array of objects with this shape:
[
  {
    "question": "What is the difference between X and Y?",
    "expected_answer": "X is ... while Y is ...",
    "type": "compare",
    "difficulty": "medium",
    "topic": "short topic tag"
  }
]

Rules:
- "type" is one of: "open", "fill_blank", "explain", "compare"
- "difficulty" is one of: "easy", "medium", "hard" (pick per question)
- Prefer concepts the learner asked about or struggled with.
- For "fill_blank" the question MUST contain ___ (3 underscores).
- Keep "expected_answer" concise (1-3 sentences).
- Each "topic" is 1-3 words (e.g. "subjunctive mood", "for-loop syntax").
- Skip trivial recall.
- Output the array only - no prose, no markdown fences.

Material:
{content}`;

/** One parsed question candidate. */
export interface GeneratedQuestion {
  question: string;
  expected_answer: string;
  question_type: StudyQuestionType;
  difficulty: StudyQuestionDifficulty;
  topic: string;
}

export function buildQuestionPrompt(content: string, limit = 8): string {
  return _QUESTION_PROMPT.replace("{limit}", String(limit)).replace(
    "{content}",
    content.slice(0, _TRANSCRIPT_CLIP),
  );
}

/** Tolerant parser: strips a ```json fence, returns ``[]`` on parse failure,
 *  coerces out-of-range fields instead of dropping the row. Mirrors the
 *  backend ``question_generator.parse_response``. */
export function parseQuestions(raw: string | null | undefined): GeneratedQuestion[] {
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
  const out: GeneratedQuestion[] = [];
  for (const row of data) {
    if (typeof row !== "object" || row === null) continue;
    const bag = row as Record<string, unknown>;
    const question = String(bag.question ?? "").trim();
    if (!question) continue;
    const expected = String(bag.expected_answer ?? "").trim();
    let qtype = String(bag.type ?? "open").toLowerCase().trim() as StudyQuestionType;
    if (!_ALLOWED_TYPES.has(qtype)) qtype = "open";
    let difficulty = String(bag.difficulty ?? "medium")
      .toLowerCase()
      .trim() as StudyQuestionDifficulty;
    if (!_ALLOWED_DIFFICULTIES.has(difficulty)) difficulty = "medium";
    const topic = String(bag.topic ?? "").trim().slice(0, 200);
    out.push({
      question,
      expected_answer: expected,
      question_type: qtype,
      difficulty,
      topic,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dexie context assembly
// ---------------------------------------------------------------------------

async function _latestProfileWeights(
  projectId: string,
): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.learningProfiles
    .where("project_id")
    .equals(projectId)
    .toArray();
  if (rows.length === 0) return {};
  rows.sort((a, b) => b.assessed_at.localeCompare(a.assessed_at));
  const p = rows[0];
  return {
    deductive: p.deductive ?? 0,
    inductive: p.inductive ?? 0,
    error_based: p.error_based ?? 0,
    dialogic: p.dialogic ?? 0,
    contextual: p.contextual ?? 0,
    ai_adaptive: p.ai_adaptive ?? 0,
  };
}

async function _projectVocabulary(userId: string): Promise<VocabEntry[]> {
  const db = getDb();
  const convs = await db.importedConversations
    .where("user_id")
    .equals(userId)
    .filter((c) => c.analyzed === true)
    .toArray();
  const vocab: VocabEntry[] = [];
  for (const conv of convs) {
    const analysis = conv.analysis_result;
    if (!analysis || typeof analysis !== "object") continue;
    const entries = (analysis as Record<string, unknown>).vocabulary;
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      if (typeof e !== "object" || e === null) continue;
      const bag = e as Record<string, unknown>;
      const word = String(bag.word ?? "").trim();
      const translation = String(bag.translation ?? "").trim();
      if (!word || !translation) continue;
      vocab.push({ word, translation, example: String(bag.example ?? "").trim() });
    }
  }
  return vocab;
}

async function _sessionBody(sessionId: string): Promise<string> {
  const db = getDb();
  const msgs = await db.sessionMessages
    .where("session_id")
    .equals(sessionId)
    .sortBy("created_at");
  return msgs
    .filter((m) => m.content && m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

/** Assemble the full study-guide context for a project from IndexedDB, or
 *  ``null`` when the project doesn't exist. */
export async function assembleStudyGuideContext(
  projectId: string,
): Promise<{ ctx: StudyGuideContext; userId: string } | null> {
  const db = getDb();
  const project = await db.learningProjects.get(projectId);
  if (!project) return null;

  const sessionRows = await db.learningSessions
    .where("project_id")
    .equals(projectId)
    .filter((s) => s.status === "completed")
    .toArray();
  sessionRows.sort((a, b) => b.started_at.localeCompare(a.started_at));

  const sessions = [];
  for (const sess of sessionRows.slice(0, 10)) {
    sessions.push({
      method: sess.method,
      started_at: sess.started_at ?? null,
      messages: await _sessionBody(sess.id),
    });
  }

  return {
    userId: project.user_id,
    ctx: {
      topic: project.topic,
      goal: project.goal,
      timeframe: project.timeframe,
      daily_minutes: project.daily_minutes,
      profile: await _latestProfileWeights(projectId),
      vocabulary: await _projectVocabulary(project.user_id),
      sessions,
    },
  };
}

/** Combined transcript across a project's recent completed sessions, plus the
 *  owning ``user_id``. Returns ``null`` when the project doesn't exist. */
export async function assembleProjectTranscript(
  projectId: string,
  maxSessions = 5,
): Promise<{ transcript: string; userId: string } | null> {
  const db = getDb();
  const project = await db.learningProjects.get(projectId);
  if (!project) return null;
  const sessionRows = await db.learningSessions
    .where("project_id")
    .equals(projectId)
    .filter((s) => s.status === "completed")
    .toArray();
  sessionRows.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const sections: string[] = [];
  for (const sess of sessionRows.slice(0, maxSessions)) {
    const body = await _sessionBody(sess.id);
    if (!body) continue;
    sections.push(
      `=== Session (${sess.method}, started ${sess.started_at ?? "unknown"}) ===\n${body}`,
    );
  }
  return { transcript: sections.join("\n\n"), userId: project.user_id };
}

// ---------------------------------------------------------------------------
// Browser-direct AI calls
// ---------------------------------------------------------------------------

async function _runQuestions(
  config: DexieAiConfig,
  transcript: string,
  limit: number,
): Promise<GeneratedQuestion[]> {
  const raw = await aiComplete({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    messages: [{ role: "user", content: buildQuestionPrompt(transcript, limit) }],
    maxTokens: 2000,
  });
  return parseQuestions(raw);
}

/** Browser-direct study questions from a session transcript. Returns the
 *  parsed questions; throws on a missing key / empty material. */
export async function generateQuestionsFromSession(
  sessionId: string,
  config: DexieAiConfig,
  limit = 8,
): Promise<GeneratedQuestion[]> {
  const transcript = await _sessionBody(sessionId);
  if (!transcript.trim()) return [];
  return _runQuestions(config, transcript, limit);
}

/** Browser-direct study questions across a project's recent sessions. */
export async function generateQuestionsFromProject(
  transcript: string,
  config: DexieAiConfig,
  limit = 12,
): Promise<GeneratedQuestion[]> {
  if (!transcript.trim()) return [];
  return _runQuestions(config, transcript, limit);
}

/** Browser-direct study guide. Returns the Markdown body. */
export async function generateStudyGuide(
  ctx: StudyGuideContext,
  config: DexieAiConfig,
): Promise<string> {
  const raw = await aiComplete({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    messages: [{ role: "user", content: buildStudyGuidePrompt(ctx) }],
    maxTokens: 4000,
  });
  return parseStudyGuide(raw);
}

export { resolveDexieAiConfig };
