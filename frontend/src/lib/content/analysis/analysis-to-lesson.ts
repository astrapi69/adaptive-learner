/**
 * Analysis-to-lesson generator (Phase 59A / v1.42.0).
 *
 * Turns a chat-import ``ConversationAnalysisResult`` into a valid
 * ``ContentLesson`` (schema v1.1) the existing LessonViewer renders
 * unmodified. Deterministic + offline — no AI calls, no
 * ``Math.random``, no ``Date.now``: the same analysis always yields
 * byte-identical output (pinned by tests). This bridges the
 * AI-powered chat import with the content-only lesson system: once
 * generated, the lesson plays fully offline.
 *
 * The mapping is driven by what the analysis ACTUALLY contains
 * (audited against ``ConversationAnalysisResult`` — the spec's
 * ``key_concepts`` / ``rules_learned`` fields do not exist):
 *
 *   Theory steps:
 *     - topic + summary (+ recommended_focus)  -> overview step
 *     - suggested_curriculum                    -> one step per entry
 *     - subtopics                               -> one "topics" step
 *                                                  (theory bodies are
 *                                                  required, so the
 *                                                  subtopics become a
 *                                                  bulleted list rather
 *                                                  than empty steps)
 *     - strengths                               -> "what you can do" step
 *     - weaknesses                              -> "what we work on" step
 *     - error_patterns                          -> "common mistakes" step
 *
 *   Exercises (from ``vocabulary[]`` — the only structured data):
 *     - word + translation       -> matching (groups of N pairs)
 *     - word                      -> free_text (prompt word, accept translation)
 *     - example (when present)    -> cloze (blank the word in the example)
 *     - example (when present)    -> word_tiles (split the example)
 *
 * Quality scales with analysis richness:
 *   - < minVocabForExercises vocab -> theory-only study guide
 *   - 4-9 vocab                     -> matching + free_text
 *   - 10+ vocab with examples       -> all four exercise types
 *
 * The module is i18n-naive (like ``synthesizeReviewLesson`` and the
 * adaptive generator): the caller passes already-localised
 * ``labels``. ``DEFAULT_ANALYSIS_LESSON_LABELS`` (English) is the
 * test + fallback set.
 */

import type {
  ContentLesson,
  ContentLessonCard,
  ContentLessonExercise,
  ContentLessonStep,
} from "../../../storage/types";
import type {
  ConversationAnalysisResult,
  VocabularyEntry,
} from "../../../types/domain";
import {
  buildCloze,
  buildFreeText,
  buildMatching,
  buildWordTiles,
  selectExercises,
  type GeneratorCard,
} from "../exercise-generator";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Localised strings. ``{word}`` in a prompt template is replaced
 *  with the vocabulary word. */
export interface AnalysisLessonLabels {
  fallbackTitle: string;
  focusLabel: string;
  topicsTitle: string;
  strengthsTitle: string;
  weaknessesTitle: string;
  errorPatternsTitle: string;
  matchingPrompt: string;
  freeTextPrompt: string;
  clozePrompt: string;
  wordTilesPrompt: string;
}

export const DEFAULT_ANALYSIS_LESSON_LABELS: AnalysisLessonLabels = {
  fallbackTitle: "Imported lesson",
  focusLabel: "Focus",
  topicsTitle: "Topics",
  strengthsTitle: "What you already know",
  weaknessesTitle: "What we'll work on",
  errorPatternsTitle: "Common mistakes",
  matchingPrompt: "Match each word with its translation.",
  freeTextPrompt: "Translate: {word}",
  clozePrompt: "Fill in the missing word.",
  wordTilesPrompt: "Arrange the words into the sentence ({word}).",
};

export interface AnalysisLessonConfig {
  /** Vocabulary pairs per matching exercise. Default 4. */
  matchingGroupSize: number;
  /** Cap on emitted exercise steps. Default 12. */
  maxExercises: number;
  /** Below this many vocab entries, emit a theory-only lesson. */
  minVocabForExercises: number;
}

export const DEFAULT_ANALYSIS_LESSON_CONFIG: AnalysisLessonConfig = {
  matchingGroupSize: 4,
  maxExercises: 12,
  minVocabForExercises: 4,
};

export interface GenerateAnalysisLessonOpts {
  labels?: AnalysisLessonLabels;
  /** Deterministic lesson id. Defaults to ``analysis-{topic-slug}``
   *  so the same analysis always produces the same id. */
  id?: string;
  config?: Partial<AnalysisLessonConfig>;
}

export interface GeneratedLessonSummary {
  theorySteps: number;
  exercises: number;
  exerciseTypeCounts: Record<string, number>;
  estimatedMinutes: number;
  vocabularyCount: number;
  /** True when too little vocabulary existed to build exercises. */
  theoryOnly: boolean;
}

// ---------------------------------------------------------------------------
// Language-pair + level derivation (EXP-018 follow-up bugfix)
// ---------------------------------------------------------------------------

/** Sharing-validator minimums (mirror of ``content-validator.ts``).
 *  A saved analysis lesson must clear these to be shareable; the
 *  Save-as-Lesson modal gates on them so the flow never produces an
 *  unshareable lesson. */
export const MIN_SHAREABLE_EXERCISES = 5;
export const MIN_SHAREABLE_EXERCISE_TYPES = 2;

/** Map of language NAME fragments (English + native + common
 *  adjective forms) to BCP-47 codes, used to guess the TARGET
 *  language from a free-text analysis topic. Order matters only for
 *  readability; matching is substring, longest-key-first. */
const LANGUAGE_NAME_TO_CODE: ReadonlyArray<[string, string]> = [
  ["französisch", "fr"],
  ["française", "fr"],
  ["francais", "fr"],
  ["français", "fr"],
  ["french", "fr"],
  ["spanisch", "es"],
  ["español", "es"],
  ["espanol", "es"],
  ["spanish", "es"],
  ["deutsch", "de"],
  ["allemand", "de"],
  ["alemán", "de"],
  ["german", "de"],
  ["englisch", "en"],
  ["anglais", "en"],
  ["inglés", "en"],
  ["english", "en"],
  ["italienisch", "it"],
  ["italiano", "it"],
  ["italian", "it"],
  ["portugiesisch", "pt"],
  ["português", "pt"],
  ["portuguese", "pt"],
  ["griechisch", "el"],
  ["greek", "el"],
  ["türkçe", "tr"],
  ["türkisch", "tr"],
  ["turkish", "tr"],
  ["japanisch", "ja"],
  ["japanese", "ja"],
  ["日本語", "ja"],
  ["mandarin", "zh"],
  ["chinese", "zh"],
  ["中文", "zh"],
  ["russisch", "ru"],
  ["russian", "ru"],
  ["русский", "ru"],
  ["niederländisch", "nl"],
  ["dutch", "nl"],
  ["arabisch", "ar"],
  ["arabic", "ar"],
  ["العربية", "ar"],
];

/** Best-effort guess of the TARGET (learned) language from an
 *  analysis topic, e.g. "French Grammar" -> "fr",
 *  "Grammaire française" -> "fr". Returns null when no known
 *  language name is present (the caller then asks the user). */
export function detectTargetLanguage(topic: string | undefined): string | null {
  if (!topic) return null;
  const hay = topic.toLowerCase();
  // Longest key first so "français" wins before a hypothetical "fr".
  const sorted = [...LANGUAGE_NAME_TO_CODE].sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [name, code] of sorted) {
    if (hay.includes(name)) return code;
  }
  return null;
}

/** Map an analysis ``user_level`` (beginner/intermediate/advanced)
 *  to a CEFR level the content system accepts. */
export function cefrFromAnalysisLevel(
  level: "beginner" | "intermediate" | "advanced" | undefined,
): string {
  switch (level) {
    case "advanced":
      return "C1";
    case "intermediate":
      return "B1";
    case "beginner":
    default:
      return "A1";
  }
}

/** True when a generated lesson clears the sharing-validator
 *  minimums (>= 5 exercises across >= 2 types). This is the stricter
 *  CONTRIBUTION gate (a lesson must clear it to be shared to the
 *  content repo); it does NOT gate local saving — see
 *  ``isSaveableLesson``. */
export function isShareableLesson(summary: GeneratedLessonSummary): boolean {
  return (
    summary.exercises >= MIN_SHAREABLE_EXERCISES &&
    Object.keys(summary.exerciseTypeCounts).length >=
      MIN_SHAREABLE_EXERCISE_TYPES
  );
}

/** Minimum total steps for a generated lesson to be worth saving
 *  offline. A single step of any kind is enough — a lone theory step
 *  with no exercises (a grammar note, a technical explanation, an AI
 *  summary) is a legitimate knowledge lesson. This is deliberately
 *  looser than ``isShareableLesson``: saving locally and contributing
 *  to the content repo are separate concerns (#795). */
export const MIN_SAVEABLE_STEPS = 1;

/** True when a generated lesson is worth saving offline: it carries at
 *  least one step of any type. Theory-only knowledge lessons (grammar,
 *  technical topics, AI explanations) are saveable even with 0
 *  exercises. The Save-as-Lesson modal gates the Save button on this. */
export function isSaveableLesson(summary: GeneratedLessonSummary): boolean {
  return summary.theorySteps + summary.exercises >= MIN_SAVEABLE_STEPS;
}

// ---------------------------------------------------------------------------
// Slug + text helpers
// ---------------------------------------------------------------------------

/** Reduce arbitrary text to a slug-safe token (the schema's
 *  ``^[a-z0-9]+(-[a-z0-9]+)*$``). Returns "" when nothing survives. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function clampLen(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item.trim()}`).join("\n");
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function vocabCardId(index: number): string {
  return `vocab-${index}`;
}

function buildCards(vocabulary: VocabularyEntry[]): ContentLessonCard[] {
  return vocabulary.map((entry, i) => ({
    id: vocabCardId(i),
    front: clampLen(entry.word.trim(), 500),
    back: clampLen(entry.translation.trim(), 500),
    notes: entry.example ? clampLen(entry.example.trim(), 2000) : null,
    tags: uniq(
      (entry.tags ?? [])
        .map(slugify)
        .filter((t) => t.length > 0 && t.length <= 40),
    ).slice(0, 20),
  }));
}

// ---------------------------------------------------------------------------
// Theory steps
// ---------------------------------------------------------------------------

function overviewStep(
  analysis: ConversationAnalysisResult,
  title: string,
  labels: AnalysisLessonLabels,
): ContentLessonStep {
  const parts: string[] = [`# ${title}`];
  if (analysis.summary) parts.push(analysis.summary.trim());
  if (analysis.recommended_focus) {
    parts.push(
      `**${labels.focusLabel}:** ${analysis.recommended_focus.trim()}`,
    );
  }
  // Theory body must be non-empty; the title heading guarantees that
  // even when summary + focus are absent.
  return {
    id: "theory-overview",
    type: "theory",
    title,
    body: parts.join("\n\n"),
  };
}

function studyPlanSteps(
  analysis: ConversationAnalysisResult,
): ContentLessonStep[] {
  const plan = analysis.suggested_curriculum ?? [];
  return plan
    .filter((entry) => entry.title?.trim())
    .map((entry, i) => ({
      id: `theory-plan-${i}`,
      type: "theory" as const,
      title: clampLen(entry.title.trim(), 200),
      body:
        entry.description?.trim() || `# ${clampLen(entry.title.trim(), 180)}`,
    }));
}

function listStep(
  id: string,
  title: string,
  items: string[] | undefined,
): ContentLessonStep | null {
  const clean = (items ?? []).map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return {
    id,
    type: "theory",
    title,
    body: `## ${title}\n\n${bulletList(clean)}`,
  };
}

function buildTheorySteps(
  analysis: ConversationAnalysisResult,
  title: string,
  labels: AnalysisLessonLabels,
): ContentLessonStep[] {
  const steps: ContentLessonStep[] = [overviewStep(analysis, title, labels)];
  steps.push(...studyPlanSteps(analysis));
  const topics = listStep(
    "theory-topics",
    labels.topicsTitle,
    analysis.subtopics,
  );
  if (topics) steps.push(topics);
  const strengths = listStep(
    "theory-strengths",
    labels.strengthsTitle,
    analysis.strengths,
  );
  if (strengths) steps.push(strengths);
  const weaknesses = listStep(
    "theory-weaknesses",
    labels.weaknessesTitle,
    analysis.weaknesses,
  );
  if (weaknesses) steps.push(weaknesses);
  const errors = listStep(
    "theory-errors",
    labels.errorPatternsTitle,
    analysis.error_patterns,
  );
  if (errors) steps.push(errors);
  return steps;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function resolveConfig(
  overrides: Partial<AnalysisLessonConfig> | undefined,
): AnalysisLessonConfig {
  return { ...DEFAULT_ANALYSIS_LESSON_CONFIG, ...(overrides ?? {}) };
}

function lessonId(
  analysis: ConversationAnalysisResult,
  override?: string,
): string {
  if (override) {
    const slug = slugify(override);
    if (slug) return slug;
  }
  const topicSlug = slugify(analysis.topic ?? "");
  return topicSlug ? `analysis-${topicSlug}` : "analysis-lesson";
}

function estimateMinutes(theory: number, exercises: number): number {
  return Math.max(1, Math.round(theory + exercises * 1.5));
}

/** Generate a schema-valid offline lesson from a chat analysis.
 *  Deterministic: same analysis + opts -> identical lesson. The
 *  returned lesson is validated before return (throws on any
 *  invariant violation). */
export function generateLessonFromAnalysis(
  analysis: ConversationAnalysisResult,
  opts: GenerateAnalysisLessonOpts = {},
): ContentLesson {
  const labels = opts.labels ?? DEFAULT_ANALYSIS_LESSON_LABELS;
  const config = resolveConfig(opts.config);
  const vocabulary = (analysis.vocabulary ?? []).filter(
    (entry) => entry.word?.trim() && entry.translation?.trim(),
  );
  const title = clampLen(
    (analysis.topic ?? labels.fallbackTitle).trim() || labels.fallbackTitle,
    200,
  );

  const cards = buildCards(vocabulary);
  const theorySteps = buildTheorySteps(analysis, title, labels);

  const exerciseSteps: ContentLessonStep[] = [];
  if (vocabulary.length >= config.minVocabForExercises) {
    // Normalise vocabulary to the shared generator's card shape. The
    // ``vocab-${i}`` ids match ``buildCards`` so card_ids resolve.
    const genCards: GeneratorCard[] = vocabulary.map((entry, i) => ({
      id: vocabCardId(i),
      front: entry.word,
      back: entry.translation,
      example: entry.example,
    }));
    const buckets = [
      buildMatching(genCards, config.matchingGroupSize, labels.matchingPrompt),
      buildFreeText(genCards, labels.freeTextPrompt),
      buildCloze(genCards, labels.clozePrompt),
      buildWordTiles(genCards, labels.wordTilesPrompt),
    ];
    const chosen = selectExercises(buckets, config.maxExercises);
    chosen.forEach((exercise, i) => {
      exerciseSteps.push({
        id: `step-ex-${i}-${exercise.id}`,
        type: "exercise",
        title: null,
        body: null,
        exercise,
      });
    });
  }

  const steps = [...theorySteps, ...exerciseSteps];
  const lesson: ContentLesson = {
    id: lessonId(analysis, opts.id),
    title,
    description: analysis.summary
      ? clampLen(analysis.summary.trim(), 500)
      : analysis.recommended_focus
        ? clampLen(analysis.recommended_focus.trim(), 500)
        : null,
    estimated_minutes: estimateMinutes(
      theorySteps.length,
      exerciseSteps.length,
    ),
    cards,
    steps,
  };

  validateGeneratedLesson(lesson);
  return lesson;
}

export function summarizeGeneratedLesson(
  lesson: ContentLesson,
): GeneratedLessonSummary {
  const typeCounts: Record<string, number> = {};
  let exercises = 0;
  let theory = 0;
  for (const step of lesson.steps) {
    if (step.type === "theory") {
      theory += 1;
    } else if (step.exercise) {
      exercises += 1;
      const t = step.exercise.type;
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
  }
  return {
    theorySteps: theory,
    exercises,
    exerciseTypeCounts: typeCounts,
    estimatedMinutes: lesson.estimated_minutes,
    vocabularyCount: lesson.cards.length,
    theoryOnly: exercises === 0,
  };
}

// ---------------------------------------------------------------------------
// Validation (mirror of the backend Pydantic Lesson invariants)
// ---------------------------------------------------------------------------

/** Throws an Error on the first schema violation. Keeps the
 *  frontend honest without a Pydantic equivalent: the API-mode path
 *  re-validates with the real schema, this guards the Dexie path. */
export function validateGeneratedLesson(lesson: ContentLesson): void {
  const fail = (msg: string): never => {
    throw new Error(`generated lesson invalid: ${msg}`);
  };
  if (!SLUG_RE.test(lesson.id)) fail(`lesson id '${lesson.id}' not slug-safe`);
  if (!lesson.title || lesson.title.length > 200)
    fail("lesson title empty or >200 chars");
  if (lesson.estimated_minutes < 1) fail("estimated_minutes < 1");
  if (lesson.steps.length < 1) fail("lesson needs at least one step");

  const cardIds = validateCards(lesson.cards, fail);
  validateSteps(lesson.steps, cardIds, fail);
}

/** Validate every card (slug-safe + unique id, front + back present,
 *  slug-safe tags) and return the set of card ids for cross-reference
 *  checks in the step validation. */
function validateCards(
  cards: ContentLesson["cards"],
  fail: (msg: string) => never,
): Set<string> {
  const cardIds = new Set<string>();
  for (const card of cards) {
    if (!SLUG_RE.test(card.id)) fail(`card id '${card.id}' not slug-safe`);
    if (cardIds.has(card.id)) fail(`duplicate card id '${card.id}'`);
    cardIds.add(card.id);
    if (!card.front || !card.back) fail(`card '${card.id}' needs front + back`);
    for (const tag of card.tags) {
      if (!SLUG_RE.test(tag))
        fail(`card '${card.id}' tag '${tag}' not slug-safe`);
    }
  }
  return cardIds;
}

/** Validate every step: slug-safe + unique id, theory steps carry a
 *  body and no exercise, exercise steps carry an exercise (validated
 *  against ``cardIds``) and no body. */
function validateSteps(
  steps: ContentLesson["steps"],
  cardIds: Set<string>,
  fail: (msg: string) => never,
): void {
  const stepIds = new Set<string>();
  for (const step of steps) {
    if (!SLUG_RE.test(step.id)) fail(`step id '${step.id}' not slug-safe`);
    if (stepIds.has(step.id)) fail(`duplicate step id '${step.id}'`);
    stepIds.add(step.id);
    if (step.type === "theory") {
      if (!step.body) fail(`theory step '${step.id}' needs a body`);
      if (step.exercise)
        fail(`theory step '${step.id}' must not carry an exercise`);
    } else {
      const exercise = step.exercise;
      if (!exercise) {
        throw new Error(
          `generated lesson invalid: exercise step '${step.id}' needs an exercise`,
        );
      }
      if (step.body) fail(`exercise step '${step.id}' must not carry a body`);
      validateExercise(exercise, cardIds, fail);
    }
  }
}

function validateExercise(
  exercise: ContentLessonExercise,
  cardIds: Set<string>,
  fail: (msg: string) => never,
): void {
  if (!SLUG_RE.test(exercise.id))
    fail(`exercise id '${exercise.id}' not slug-safe`);
  if (!exercise.prompt) fail(`exercise '${exercise.id}' needs a prompt`);
  for (const cid of exercise.card_ids) {
    if (!cardIds.has(cid))
      fail(`exercise '${exercise.id}' references missing card '${cid}'`);
  }
  if (exercise.type === "matching") {
    if (!exercise.pairs || exercise.pairs.length === 0) {
      fail(`matching '${exercise.id}' needs pairs`);
    }
  } else if (exercise.type === "free_text") {
    if (!exercise.accept || exercise.accept.length === 0) {
      fail(`free_text '${exercise.id}' needs accept[]`);
    }
  } else if (exercise.type === "word_tiles") {
    if (!exercise.tiles || exercise.tiles.length < 2) {
      fail(`word_tiles '${exercise.id}' needs >= 2 tiles`);
    }
  } else if (exercise.type === "cloze") {
    if (!exercise.sentence) fail(`cloze '${exercise.id}' needs a sentence`);
    const markers = (exercise.sentence.match(/___/g) ?? []).length;
    const blanks = exercise.blanks?.length ?? 0;
    if (markers !== blanks) {
      fail(
        `cloze '${exercise.id}' marker/blank mismatch (${markers} vs ${blanks})`,
      );
    }
  }
}
