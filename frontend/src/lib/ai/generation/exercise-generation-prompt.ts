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
 * fails this file until the prompt is updated. ``multiple_choice`` (#2353,
 * a native schema type since engine 1.6 / #1525) IS generated: the RULES,
 * TYPE FIELDS and example below all cover it, so the constant and the prompt
 * text stay in sync (the #2353 fix for the half-integrated state where the
 * constant listed the type but nothing produced it). See EXP-036 §4.3 +
 * EXP-039. Its multi-select case (``multiple: true``, "select all that
 * apply") has no cloze-select equivalent, so it is a genuine sixth type,
 * not a restatement of cloze.
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
  /** #2356 — whether image assets are available for this generation. When
   *  ``false`` (e.g. the Markdown book-text path), ``picture_choice`` is NOT
   *  offered: the model cannot supply image ``src`` values, so an AI
   *  picture_choice card is always dropped downstream. Defaults to ``true``
   *  (unchanged behaviour for the card-based paths). */
  hasAssets?: boolean;
  /** #2510 — the exercise types the user selected for this generation (core
   *  ``matching`` etc. + text-extension ``ext:al-*``). When present, the prompt
   *  offers ONLY these types (hard allow-list); when absent, today's full mix
   *  is requested. Asset-bound types the caller cannot fulfil (picture_choice
   *  without assets) are already filtered by ``hasAssets``. */
  types?: readonly string[];
}

/** The six core exercise types the schema accepts and this generator can
 *  produce. Kept in lock-step with the schema ``ExerciseType`` by the
 *  compile-time guard below, and with the prompt text + parser by the
 *  guard tests (#2353). */
export const ALLOWED_EXERCISE_TYPES = [
  "matching",
  "picture_choice",
  "free_text",
  "word_tiles",
  "cloze",
  "multiple_choice",
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

const READING_COMPREHENSION = "ext:al-reading-comprehension";
const GRADED_QUIZ = "ext:al-graded-quiz";
const CATEGORIZATION = "ext:al-categorization";
const ERROR_CORRECTION = "ext:al-error-correction";

/** The four text-only extension types this generator can request (#2355). The
 *  media extensions (dictation, image-description) need assets and are out of
 *  scope here (see extension-cards.ts). Kept local so the prompt stays
 *  library-grade; the parser's own TEXT_EXTENSION_TYPES is the runtime gate. */
export const TEXT_EXTENSION_TYPES: readonly string[] = [
  READING_COMPREHENSION,
  GRADED_QUIZ,
  CATEGORIZATION,
  ERROR_CORRECTION,
];

/** Per-ext-type EXTENSION TYPES shape lines (#2510), so a deselected ext type's
 *  field spec is omitted from the prompt rather than listed but forbidden. */
const EXT_SHAPE_LINES: Record<string, string[]> = {
  [READING_COMPREHENSION]: [
    "- ext:al-reading-comprehension: question, passage (the text to read),",
    "                   questions[] of {prompt, type ('multiple_choice' with",
    "                   options[] of {text, correct} >= 2 incl. >= 1 correct, OR",
    "                   'free_text' with accept[] >= 1)}",
  ],
  [GRADED_QUIZ]: [
    "- ext:al-graded-quiz: question, questions[] like reading-comprehension but",
    "                   each also carries points (> 0); optional pass_threshold",
    "                   (0-100). At most ONE, an end-of-lesson summary.",
  ],
  [CATEGORIZATION]: [
    "- ext:al-categorization: question, categories[] (>= 2 of {name, items[] >= 1});",
    "                   every item belongs to exactly one category, names unique",
  ],
  [ERROR_CORRECTION]: [
    "- ext:al-error-correction: question, tokens[] (the sentence, one word per",
    "                   entry, >= 2), error_index (0-based index of the wrong",
    "                   token), accept[] (>= 1 correction, none equal to the wrong",
    "                   token)",
  ],
};

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

/** The types the prompt may offer, after applying the user's selection and
 *  the asset gate. ``selected`` is null when no selection was given. */
interface AllowedTypes {
  selected: Set<string> | null;
  allowedCore: string[];
  allowedExt: string[];
}

/** Resolve the offered core + extension types from the options + asset gate. */
function resolveAllowedTypes(
  options: ExercisePromptOptions,
  hasAssets: boolean,
): AllowedTypes {
  const selected =
    options.types && options.types.length > 0 ? new Set(options.types) : null;
  const baseCore = hasAssets
    ? ["matching", "picture_choice", "free_text", "word_tiles", "cloze", "multiple_choice"]
    : ["matching", "free_text", "word_tiles", "cloze", "multiple_choice"];
  const allowedCore = selected ? baseCore.filter((t) => selected.has(t)) : baseCore;
  const allowedExt = selected
    ? TEXT_EXTENSION_TYPES.filter((t) => selected.has(t))
    : [...TEXT_EXTENSION_TYPES];
  return {selected, allowedCore, allowedExt};
}

/** The RULES enumeration lines derived from the allowed types. */
interface SelectionRuleLines {
  selectionLine: string[];
  varietyLines: string[];
  coreLines: string[];
  extIntroLines: string[];
}

/** Build the RULES-section lines: the hard allow-list, the variety demand
 *  (softened for a narrow selection), and the core + extension type offers. */
function buildSelectionRuleLines(
  selected: Set<string> | null,
  allowedCore: string[],
  allowedExt: string[],
): SelectionRuleLines {
  const allowedAll = [...allowedCore, ...allowedExt];
  const coreLines =
    allowedCore.length > 0
      ? [
          `- Core types: ${allowedCore.join(", ")}.`,
          "  These should make up the bulk of the set.",
        ]
      : [];
  const extIntroLines =
    allowedExt.length > 0
      ? [
          "- You MAY also use the richer TEXT extension types (see EXTENSION TYPES",
          `  below) when a concept genuinely fits one: ${allowedExt.join(", ")}. Use`,
          "  no other type name.",
        ]
      : [];
  const selectionLine = selected
    ? [`- Use ONLY these exercise types, no others: ${allowedAll.join(", ")}.`]
    : [];
  const varietyLines =
    !selected || allowedAll.length >= 3
      ? [
          "- Produce at least 3 DIFFERENT exercise types across the set - but only",
          "  types that suit each concept (suitability beats variety; see TYPE",
          "  SELECTION below).",
        ]
      : [
          "- Use the allowed exercise types; repeat a fitting type rather than",
          "  forcing an unfitting one (suitability beats variety; see TYPE",
          "  SELECTION below).",
        ];
  return {selectionLine, varietyLines, coreLines, extIntroLines};
}

/** TYPE SELECTION extension-routing hints, one block per selectable ext type,
 *  emitted only for selected types so a deselected type is never suggested. */
function buildExtRoutingLines(allowedExt: string[]): string[] {
  const routing: Record<string, string[]> = {
    [READING_COMPREHENSION]: [
      "- A passage the learner must READ and then answer several questions about",
      "  -> ext:al-reading-comprehension (ONE per lesson at most).",
    ],
    [CATEGORIZATION]: [
      "- Terms/examples that group into named categories -> ext:al-categorization.",
    ],
    [ERROR_CORRECTION]: [
      "- A single sentence with ONE wrong word to spot and fix ->",
      "  ext:al-error-correction.",
    ],
    [GRADED_QUIZ]: [
      "- A short scored summary of the lesson's key facts -> ext:al-graded-quiz",
      "  (at most ONE, as an end-of-lesson summary; never one per small point).",
    ],
  };
  // Emit in the canonical TEXT_EXTENSION_TYPES order, filtered to the selection.
  return TEXT_EXTENSION_TYPES.filter((t) => allowedExt.includes(t)).flatMap(
    (t) => routing[t],
  );
}

/** The EXTENSION TYPES shape block for the selected ext types (empty if none). */
function buildExtShapeBlock(allowedExt: string[]): string[] {
  if (allowedExt.length === 0) return [];
  return [
    "",
    "EXTENSION TYPES (optional, text-only; use sparingly - see the caps above)",
    ...allowedExt.flatMap((t) => EXT_SHAPE_LINES[t]),
  ];
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
  // #2356 — asset-dependent type set: without images, picture_choice cannot be
  // filled (the model supplies no image src), so it is not offered at all.
  const hasAssets = options.hasAssets ?? true;

  // #2510 — the user's type selection restricts the offered types to a hard
  // allow-list (absent -> today's full mix). The line assembly is split into
  // helpers so this builder stays under the complexity gate.
  const {selected, allowedCore, allowedExt} = resolveAllowedTypes(options, hasAssets);
  const {selectionLine, varietyLines, coreLines, extIntroLines} =
    buildSelectionRuleLines(selected, allowedCore, allowedExt);
  const extRouting = buildExtRoutingLines(allowedExt);
  const extBlock = buildExtShapeBlock(allowedExt);

  return [
    "You are an instructional designer. Read the THEORY below.",
    `Create ${want} exercises (at most ${maxCards}) that test understanding of it.`,
    ...regenerationBlock(options),
    "",
    "RULES",
    `- Write every exercise in the same language as the theory (${language}).`,
    "- Use ONLY content that appears in the theory. Invent nothing; do not",
    "  add facts, terms, or modules the text does not mention.",
    ...selectionLine,
    ...varietyLines,
    ...coreLines,
    ...extIntroLines,
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
    hasAssets
      ? "- A definition or fact with ONE correct answer -> cloze (blank the key\n  term) or picture_choice (recognise the concept). Do NOT model it as\n  word_tiles."
      : "- A definition or fact with ONE correct answer -> cloze (blank the key\n  term) or multiple_choice. Do NOT model it as word_tiles.",
    "- A free explanation, an 'in your own words' task, or a transfer/",
    "  comparison -> do NOT create an exact-match type (no word_tiles, no",
    hasAssets
      ? "  free_text expecting a full free-form text). Model such goals as cloze\n  or picture_choice instead."
      : "  free_text expecting a full free-form text). Model such goals as cloze\n  or multiple_choice instead.",
    "- A question with 2+ discrete answer options -> multiple_choice. Use",
    "  multiple: false when exactly ONE option is correct; use multiple: true",
    "  for 'select all that apply' (2+ correct options, graded by exact set).",
    "  Prefer multiple_choice over cloze when the options are self-contained",
    "  choices rather than a word missing from a sentence.",
    ...extRouting,
    "",
    "TYPE FIELDS",
    "- matching:        question, pairs[] (>= 3 of {left, right})",
    "- cloze:           question (contains ___), answer, distractors[]",
    "- free_text:       question, accepts[] (>= 1 acceptable answer), distractors[] (optional)",
    "- word_tiles:      question, answer (a short sentence/sequence, space-separated)",
    ...(hasAssets
      ? ["- picture_choice:  question, options[] (>= 3 of {label, is_correct})"]
      : []),
    "- multiple_choice: question, options[] (>= 2 of {text, is_correct}, unique",
    "                   texts, >= 1 correct), multiple (bool: false = one correct,",
    "                   true = select all correct)",
    ...extBlock,
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
        {
          type: "multiple_choice",
          question: "Which of these are Ansible modules?",
          options: [
            { text: "copy", is_correct: true },
            { text: "service", is_correct: true },
            { text: "banana", is_correct: false },
          ],
          multiple: true,
        },
      ],
    },
    null,
    2,
  );
}
