/**
 * AIX-01 (EXP-036) — prompt builder for AI exercise generation.
 *
 * Turns a lesson's theory steps (prose, no structured cards) into a
 * single prompt that instructs an LLM to emit schema-aware exercises as
 * a JSON ``cards[]`` array. This is the half of EXP-036 that *only* an
 * LLM can do — reading prose and extracting practiseable concepts; the
 * defensive parser (``exercise-generation-parser.ts``) turns the model's
 * reply back into validated cards.
 *
 * Library-grade: pure string building, no app-state / network imports.
 * The exercise types are bound to the App-authoritative schema: the
 * ``ALLOWED_EXERCISE_TYPES`` list below is checked at compile time against
 * the generated ``ExerciseType`` (``schema/lesson.schema.json`` ->
 * ``lesson-schema.generated.ts``, EXP-039 Direction A), so a new schema type
 * fails this file until the prompt is updated. There is deliberately no
 * ``multiple_choice`` (it is not a schema type; MC is expressed via a
 * ``cloze`` in select mode). See EXP-036 §4.3 + EXP-039.
 *
 * EXP-041 (Refs #1222): the prompt couples exercise type to learning goal
 * ("suitability beats variety") so the model stops choosing an exact-match
 * type (``word_tiles``) for free definitions/explanations, which would mark
 * a correct-but-differently-worded learner answer as wrong.
 */

import type { ExerciseType as SchemaExerciseType } from "learn-content-engine";

/** A single theory step fed to the generator as context. */
export interface TheoryStep {
  /** Stable step id (used only for traceability, not sent verbatim). */
  id: string;
  /** Optional heading. */
  title?: string | null;
  /** The prose body the exercises are derived from. */
  body?: string | null;
}

/** Options that shape the generated prompt. */
export interface ExercisePromptOptions {
  /** Target language for the exercises. When omitted it is derived from
   *  the theory text (and the model is also told to match it). */
  language?: string;
  /** Upper bound on the number of cards requested. Default 8. */
  maxCards?: number;
  /** AIX-05 — user feedback from a regeneration ("make them harder",
   *  "wrong language", free text). When present, the prompt asks for a
   *  DIFFERENT set that addresses it. */
  feedback?: string;
  /** AIX-05 — questions from the previous generation the model must NOT
   *  repeat (so a regeneration is genuinely fresh). */
  avoidQuestions?: string[];
}

/** The five exercise types the schema accepts. NO ``multiple_choice``. */
export const ALLOWED_EXERCISE_TYPES = [
  "matching",
  "picture_choice",
  "free_text",
  "word_tiles",
  "cloze",
] as const;

export type GeneratedExerciseType = (typeof ALLOWED_EXERCISE_TYPES)[number];

/** Compile-time guard (EXP-039): the prompt's exercise-type list and the
 *  schema-generated ``ExerciseType`` must be mutually exhaustive. If the
 *  Pydantic ``ExerciseType`` enum gains/loses a value (and the schema +
 *  generated types are re-synced), this assignment stops compiling until
 *  ``ALLOWED_EXERCISE_TYPES`` is updated. Erased at runtime. */
type _ExerciseTypesInSyncWithSchema = [
  GeneratedExerciseType extends SchemaExerciseType ? true : never,
  SchemaExerciseType extends GeneratedExerciseType ? true : never,
];
const _exerciseTypesInSync: _ExerciseTypesInSyncWithSchema = [true, true];
void _exerciseTypesInSync;

const DEFAULT_MAX_CARDS = 8;

/**
 * Very small language hint: real umlauts / ß or common German function
 * words point to German, otherwise English. Only a hint — the prompt
 * also tells the model to write in the same language as the theory, so a
 * miss degrades to "model decides", never to a wrong hard constraint.
 */
export function detectLanguageHint(text: string): string {
  const sample = text.toLowerCase();
  if (/[äöüß]/.test(sample)) return "de";
  const germanStopwords = [
    " der ",
    " die ",
    " das ",
    " und ",
    " nicht ",
    " mit ",
    " ist ",
    " ein ",
    " eine ",
    " wird ",
  ];
  const hits = germanStopwords.filter((w) => sample.includes(w)).length;
  return hits >= 2 ? "de" : "en";
}

/** Join the theory steps into the context block. */
function theoryContext(steps: TheoryStep[]): string {
  return steps
    .map((step, index) => {
      const heading = step.title?.trim() ? step.title.trim() : `Step ${index + 1}`;
      const body = (step.body ?? "").trim();
      return `### ${heading}\n${body}`;
    })
    .join("\n\n");
}

/** Number of exercises to request: at least one per 2-3 theory steps,
 *  capped at ``maxCards`` (and never below 3 so a "mix of >= 3 types" is
 *  achievable). */
export function recommendedCardCount(stepCount: number, maxCards: number): number {
  const perBlock = Math.ceil(stepCount / 2.5);
  return Math.max(3, Math.min(maxCards, perBlock));
}

/**
 * Build the exercise-generation prompt from theory steps.
 *
 * @param steps - The lesson's theory steps (prose context).
 * @param options - Language + card-count overrides.
 * @returns A single prompt string ready to send as the user message.
 */
export function buildExerciseGenerationPrompt(
  steps: TheoryStep[],
  options: ExercisePromptOptions = {},
): string {
  const maxCards = options.maxCards ?? DEFAULT_MAX_CARDS;
  const context = theoryContext(steps);
  const language = options.language ?? detectLanguageHint(context);
  const want = recommendedCardCount(steps.length, maxCards);

  return [
    "You are an instructional designer. Read the THEORY below.",
    `Create ${want} exercises (at most ${maxCards}) that test understanding of it.`,
    ...regenerationBlock(options),
    "",
    "RULES",
    `- Write every exercise in the same language as the theory (${language}).`,
    "- Use ONLY content that appears in the theory. Invent nothing; do not",
    "  add facts, terms, or modules the text does not mention.",
    "- Produce at least 3 DIFFERENT exercise types across the set — but only",
    "  types that suit each concept (suitability beats variety; see TYPE",
    "  SELECTION below).",
    "- Allowed types ONLY: matching, picture_choice, free_text, word_tiles,",
    "  cloze. There is no multiple_choice type.",
    "- No trivial questions, no verbatim quotes as the answer, and every",
    "  distractor must be plausible but unambiguously wrong.",
    "- A cloze sentence marks its single blank with ___ and has exactly one",
    "  correct answer.",
    "",
    "TYPE SELECTION (pick the type by learning goal, not just for variety)",
    "- SUITABILITY BEATS VARIETY: choose the type that fairly tests the",
    "  concept. Prefer repeating a fitting type over picking an unfitting one",
    "  only to add variety.",
    "- word_tiles ONLY for a sentence with ONE fixed, unambiguous word order",
    "  (sentence-building / translation drills). NEVER for free definitions or",
    "  explanations of abstract concepts: those have many correct wordings, so",
    "  the exact-match check would mark a correct learner answer as wrong.",
    "- A definition or fact with ONE correct answer -> cloze (blank the key",
    "  term) or picture_choice (recognise the concept). Do NOT model it as",
    "  word_tiles.",
    "- A free explanation, an 'in your own words' task, or a transfer/",
    "  comparison -> do NOT create an exact-match type (no word_tiles, no",
    "  free_text expecting a full free-form text). Model such goals as cloze",
    "  or picture_choice instead.",
    "",
    "TYPE FIELDS",
    "- matching:       question, pairs[] (>= 3 of {left, right})",
    "- cloze:          question (contains ___), answer, distractors[]",
    "- free_text:      question, accepts[] (>= 1 acceptable answer), distractors[] (optional)",
    "- word_tiles:     question, answer (a short sentence/sequence, space-separated)",
    "- picture_choice: question, options[] (>= 3 of {label, is_correct})",
    "",
    "OUTPUT",
    "Reply with JSON ONLY (no prose outside the JSON), shaped exactly:",
    exampleJson(),
    "",
    "THEORY",
    context,
  ].join("\n");
}

/** AIX-05 — the regeneration block: surfaces the user's feedback and the
 *  questions to avoid. Empty when this is a first generation. */
function regenerationBlock(options: ExercisePromptOptions): string[] {
  const feedback = options.feedback?.trim();
  const avoid = (options.avoidQuestions ?? [])
    .map((q) => q.trim())
    .filter(Boolean);
  if (!feedback && avoid.length === 0) return [];
  const lines = ["", "REGENERATION"];
  lines.push("- The previous attempt was unsatisfactory. Generate a DIFFERENT set.");
  if (feedback) lines.push(`- Address this feedback: ${feedback}`);
  if (avoid.length > 0) {
    lines.push("- Do NOT repeat any of these previous questions:");
    for (const question of avoid.slice(0, 20)) lines.push(`  * ${question}`);
  }
  return lines;
}

/** A compact, schema-correct example embedded in the prompt. */
function exampleJson(): string {
  return JSON.stringify(
    {
      cards: [
        {
          type: "matching",
          question: "Match each term to its definition.",
          pairs: [{ left: "Inventory", right: "List of managed hosts" }],
        },
        {
          type: "cloze",
          question: "hosts: ___ targets every host.",
          answer: "all",
          distractors: ["localhost", "webservers"],
        },
        {
          type: "free_text",
          question: "Explain what idempotence means here.",
          accepts: ["running it again changes nothing", "same result every run"],
          distractors: ["it runs faster each time"],
        },
      ],
    },
    null,
    2,
  );
}
