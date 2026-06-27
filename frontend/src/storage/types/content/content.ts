/**
 * Content-loader namespace + lesson content schema.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type { AiValidationResult } from "../../../lib/content/validation/content-validation-types";

export interface ContentSetEntry {
  source: string;
  branch: string;
  id: string;
  /** Title in the learner's SOURCE language (what they read in
   *  the browser, e.g. "Französisch A1 für Deutschsprachige"). */
  title: string;
  /** Optional title in the TARGET language (native script, e.g.
   *  "Français A1"), shown as a secondary label. */
  title_native?: string | null;
  /** Legacy alias for {@link target_language} — kept so existing
   *  UI reading ``entry.language`` stays correct (Phase 60 /
   *  v1.44.0). Always equal to ``target_language``. */
  language: string;
  /** BCP-47 code of the language the learner is LEARNING. */
  target_language: string;
  /** BCP-47 code of the language the learner ALREADY SPEAKS
   *  (the language the card backs / notes / theory are written
   *  in). Defaults to ``"en"`` for pre-v1.44.0 content. */
  source_language: string;
  level: string;
  domain: string;
  version: string;
  lesson_count: number;
  description: string | null;
  tags: string[];
  cover_image: string | null;
  cached_version: string | null;
  update_available: boolean;
  /** Optional set-level book (#769). When present, the lesson's "Vertiefe
   *  das Thema" section auto-inserts it as the first media item. */
  book?: ContentSetBook | null;
}

/** A set's manifest-level book block surfaced to the lesson media section
 *  (#769). Mirrors the manifest \`sets[].book\` shape. */
export interface ContentSetBook {
  title: string;
  author?: string | null;
  url?: string | null;
  asin?: string | null;
}

export interface ContentSetSource {
  source: string;
  branch: string;
}

/** Per-set download progress (EXP-034 / DIS-06): ``current`` lessons cached
 *  of ``total``. ``total`` is known once the set manifest is read. */
export interface ContentDownloadProgress {
  current: number;
  total: number;
}

export interface ContentSetsList {
  sets: ContentSetEntry[];
  sources: ContentSetSource[];
}

export interface ContentLessonList {
  set_id: string;
  source: string;
  version: string | null;
  lessons: string[];
}

/**
 * Lesson shape mirrored from the backend's
 * ``adaptive_learner_content_loader.schema.Lesson``. The
 * viewer (Phase 44) renders these directly. Optional fields
 * stay nullable / optional so the type-checker matches the
 * Pydantic JSON output exactly.
 */
export interface ContentLessonStep {
  id: string;
  type: "theory" | "exercise";
  title?: string | null;
  body?: string | null;
  exercise?: ContentLessonExercise | null;
  /** Schema v1.4 (#139) — optional external example link rendered under
   *  a theory step's content (article / video / visualisation). */
  example_url?: string | null;
  /** Display text for {@link example_url}; the viewer falls back to a
   *  localized "View example" label when empty. */
  example_label?: string | null;
  /** #709 — EXERCISE steps only: an explicit reference to the theory step
   *  this exercise practices, by the theory step's id (preferred) or
   *  title. The "Re-read theory" backlink resolves it exactly, falling
   *  back to the term-overlap heuristic (#634/#635) when absent or
   *  unresolvable. Additive; old lessons omit it. */
  theory_ref?: string | null;
  /** #673 — set ONLY on synthesised SRS review steps
   *  ({@link synthesizeReviewLesson}). Carries the source lesson_id the
   *  reviewed element belongs to, so the review recorder can address the
   *  exact stored ``ElementError`` row. Without it the lesson_id had to be
   *  parsed back out of the hyphen-joined step id, which mangled it for any
   *  exercise_id / element_key containing a hyphen or space (almost all of
   *  them) — producing a phantom row instead of rescheduling the real one,
   *  so the "N due" badge never dropped. Absent on real content lessons. */
  review_lesson_id?: string | null;
}

/** Phase 52D / v1.35.0 / P-127 — one blank inside a CLOZE
 * exercise's ``sentence``. Mirror of ``schema.ClozeBlank``. */
export interface ContentLessonClozeBlank {
  accept: string[];
  hint?: string | null;
  placeholder?: string | null;
}

/** EXP-018 / Phase 62 / v1.46.0 — drill direction. Mirror of the
 *  Python ``Exercise.direction`` Literal. ``target_to_source``
 *  (default) is receptive (show target, recognise source);
 *  ``source_to_target`` is productive (show source, produce
 *  target). ``both`` / ``random`` defer the choice to the
 *  renderer / adaptive generator. */
export type ContentExerciseDirection = "source_to_target" | "target_to_source" | "both" | "random";

export interface ContentLessonExercise {
  id: string;
  type:
    | "matching"
    | "picture_choice"
    | "free_text"
    | "word_tiles"
    | "cloze"
    | "multiple_choice";
  prompt: string;
  card_ids: string[];
  /** EXP-018 / Phase 62 — drill direction; defaults to
   *  ``"target_to_source"`` (receptive) when omitted. */
  direction?: ContentExerciseDirection | null;
  pairs?: Array<{ left: string; right: string }> | null;
  images?: Array<{ src: string; label: string; is_correct?: string }> | null;
  accept?: string[] | null;
  tiles?: string[] | null;
  accept_orderings?: number[][] | null;
  distractors: string[];
  hint?: string | null;
  /** Phase 52D / v1.35.0 — CLOZE: sentence with visible ``___``
   *  markers at each blank position. */
  sentence?: string | null;
  /** Phase 52D / v1.35.0 — CLOZE: per-marker metadata in
   *  left-to-right order. ``blanks.length === sentence
   *  .count("___")`` enforced upstream. */
  blanks?: ContentLessonClozeBlank[] | null;
  /** Phase 52D / v1.35.0 — CLOZE: render mode. Default
   *  ``"type"`` when omitted. ``"select"`` requires
   *  non-empty ``distractors``. */
  cloze_mode?: "type" | "select" | null;
  /** Schema v1.5 / #890 — MULTIPLE_CHOICE: the answer options shown
   *  to the learner (>= 2), in authored order. */
  options?: string[] | null;
  /** Schema v1.5 / #890 — MULTIPLE_CHOICE: 0-based indices into
   *  ``options`` that are correct (>= 1, in range, no duplicates).
   *  Exactly one => single-select (radio); two or more =>
   *  multi-select (checkboxes). The renderer derives the select mode
   *  from the count. */
  correct_options?: number[] | null;
}

/** Phase 52I / v1.35.0 / P-130 — closed grammatical-role enum
 * mirror. Annotates tokens inside a card's ``front`` so the
 * cloze generator can pick a semantically-meaningful blank.
 * Adding a role is a minor schema bump. */
export type ContentLessonCardTokenRoleName =
  | "article"
  | "verb"
  | "noun"
  | "adjective"
  | "preposition"
  | "gender_marker"
  | "tense_marker";

export interface ContentLessonCardTokenRole {
  token: string;
  role: ContentLessonCardTokenRoleName;
}

export interface ContentLessonCard {
  id: string;
  front: string;
  back: string;
  notes?: string | null;
  image?: string | null;
  audio?: string | null;
  tags: string[];
  /** Phase 52I / v1.35.0 / P-130 — optional token-role
   * annotations on ``front``. Absent → cloze generator
   * falls back to a positional heuristic. */
  token_roles?: ContentLessonCardTokenRole[] | null;
  // --- Schema v1.2 -> v1.3: technical / programming content. All
  // optional + backward compatible. media_type "code"/"formula" drives
  // syntax-highlighted rendering + a monospace exercise input.
  /** Code / formula the card teaches (Python snippet, Excel formula …). */
  code_snippet?: string | null;
  /** Highlighter language hint ("python", "sql", "excel", …). */
  code_language?: string | null;
  /** What ``code_snippet`` produces, shown in an "Output:" block. */
  expected_output?: string | null;
  /** Progressive hint revealed on request. */
  hint?: string | null;
  /** Optional 1-5 difficulty scale. */
  difficulty?: number | null;
  /** "text" (default when null) | "code" | "formula" | "diagram". */
  media_type?: ContentCardMediaType | null;
}

/** Card content kind (schema v1.3). Null/absent is treated as "text". */
export type ContentCardMediaType = "text" | "code" | "formula" | "diagram";

/** EXP-029 / MED-05 — one lesson-level supplementary-media entry (the raw
 *  shape stored in the content JSON). Mirrors a ``media.yaml`` resource minus
 *  ``domain`` (inherited from the parent set). Optional + additive, so
 *  pre-EXP-029 lessons load unchanged. Validated by ``parseLessonResources``
 *  before display. */
export interface ContentLessonResource {
  type: string;
  title: string;
  url: string;
  language?: string | null;
  level?: string | null;
  duration?: string | null;
  description?: string | null;
  author?: string | null;
  free?: boolean | null;
  partnership?: boolean | null;
  tags?: string[] | null;
}

export interface ContentLesson {
  id: string;
  title: string;
  description?: string | null;
  /** Optional BCP-47 code of the language taught (Phase 60 /
   *  v1.44.0). The parent set is authoritative; this lets an
   *  exported standalone lesson carry its own pair. */
  target_language?: string | null;
  /** Optional BCP-47 code of the language the learner already
   *  speaks (the language the card backs / notes / theory are
   *  written in). */
  source_language?: string | null;
  /** Optional content domain (schema v1.3). Mirrors the parent
   *  set's ``domain`` ("language" default, or "psychology" /
   *  "programming" / ...). The parent set is authoritative. */
  domain?: string | null;
  estimated_minutes: number;
  cards: ContentLessonCard[];
  steps: ContentLessonStep[];
  /** Phase 64B / content schema 1.3 (additive) — when set, this
   *  lesson is a community VARIATION of another lesson (same topic,
   *  different exercises or perspective). Holds the original
   *  lesson's id. Absent for ordinary lessons. */
  variation_of?: string | null;
  /** Phase 64B — the author's short note on how this variation
   *  differs from the original ("Mehr Übungen zum Präteritum"). */
  variation_note?: string | null;
  /** Phase 64C-2 (schema 1.3, additive) — optional author credit set
   *  when the learner opts in while sharing. Shown as a subtle credit
   *  line in the viewer + in the GitHub submission. */
  contributed_by?: string | null;
  /** ISO-8601 timestamp the lesson was contributed. */
  contributed_at?: string | null;
  /** EXP-029 / MED-05 (additive) — optional lesson-specific supplementary
   *  media (videos / podcasts / articles / …). Surfaced in the
   *  "Vertiefe das Thema" section after the lesson summary, above the
   *  broader domain-level media from ``media.yaml``. Validated by
   *  ``parseLessonResources``. */
  resources?: ContentLessonResource[] | null;
}

/**
 * Content-Loader namespace. ApiStorage delegates to
 * ``/api/plugins/content-loader/*``; DexieStorage runs the
 * GitHub fetcher + IndexedDB cache client-side so GH Pages
 * users get the same surface without a backend.
 *
 * ``listSets`` MUST tolerate offline gracefully: a failed
 * upstream fetch returns the cached sets (if any) instead
 * of throwing — the Set Browser stays usable on a flaky
 * connection.
 */
export interface IContentLoaderNamespace {
  listSets(): Promise<ContentSetsList>;
  /** Download + cache ONE set's lessons + assets (per-set download,
   *  EXP-034 / DIS-06 — not a whole-repo sync). ``onProgress`` is fired as
   *  each lesson is fetched so the UI can show "lesson N of M"; Dexie mode
   *  emits it, API mode (atomic server-side) ignores it. */
  downloadSet(
    source: string,
    setId: string,
    onProgress?: (progress: ContentDownloadProgress) => void,
  ): Promise<ContentSetEntry>;
  listLessons(source: string, setId: string): Promise<ContentLessonList>;
  getLesson(source: string, setId: string, filename: string): Promise<ContentLesson>;
  /** Phase 54 / v1.37.0 — fetch one cached asset by relative
   *  path (e.g. ``img/sunrise.png``). Returns ``null`` when
   *  the asset isn't cached so the asset resolver hook can
   *  fall back to a placeholder SVG or text-only display
   *  without throwing.
   *
   *  ApiStorage routes to the backend proxy endpoint added in
   *  Phase 54F; DexieStorage reads the asset bytes out of
   *  IndexedDB (stored as part of ``contentSetFiles`` during
   *  ``downloadSet``).
   *
   *  The caller is responsible for ``URL.createObjectURL``
   *  on the returned Blob and the matching
   *  ``URL.revokeObjectURL`` on component unmount. The
   *  ``useAsset`` hook in Phase 54B handles that contract. */
  getAsset(source: string, setId: string, assetPath: string): Promise<Blob | null>;
  /** Phase 59B / v1.42.0 — persist a user-generated set (from a
   *  chat analysis, an adaptive lesson, or an imported file) into
   *  the SAME cache as downloaded sets, marked ``source:
   *  "user-generated"``. Overwrites any existing set with the same
   *  ``set_id``. Returns the stored entry so "My Lessons" can show
   *  it immediately. API mode writes the filesystem cache; Dexie
   *  mode writes IndexedDB — no new tables. */
  saveUserSet(input: SaveUserSetInput): Promise<ContentSetEntry>;
  /** Phase 59C / v1.42.0 — delete a cached set (used by My Lessons
   *  to remove a user-generated lesson). Idempotent. */
  deleteSet(source: string, setId: string): Promise<void>;
  /** Phase 60 / v1.44.0 — OPT-IN AI content validation. Sends the
   *  lesson content to the user's configured AI provider and
   *  returns a structured review (translation / distractor /
   *  grammar / level issues + a quality score). Dexie mode calls
   *  the provider browser-direct; API mode routes through the
   *  backend (which resolves the key server-side). Supplementary
   *  to the rule-based gate — callers treat a thrown error as
   *  non-fatal. */
  aiValidate(input: AiValidateInput): Promise<AiValidationResult>;
  /** EXP-033 / AIV-02 — set-wide, batched, PER-CARD AI content check.
   *  Distinct from {@link aiValidate} (per-lesson, aggregate shape): this
   *  flattens the set's cards, sends them in batches of 10 to the user's
   *  configured provider, and returns a card-keyed result + the provider
   *  response ids (for the AIV-09 signature).
   *
   *  Dexie mode runs the batches browser-direct (resolving the key from
   *  IndexedDB) and reports per-batch progress via ``onProgress``. API mode
   *  has no client-side key and EXP-033 ships no server route, so the API
   *  implementation throws — callers gate the trigger to Dexie mode + a
   *  configured key. */
  aiValidateCards(input: AiValidateCardsInput): Promise<AiValidateCardsResult>;
  /** EXP-033 / AIV-04 — read the cached AI content-check report for a set,
   *  or null when none exists. Dexie reads IndexedDB; API mode returns
   *  null (the check runs client-side only). */
  getAiValidationCache(
    source: string,
    setId: string,
  ): Promise<AiValidationCacheRecord | null>;
  /** EXP-033 / AIV-04 — persist a report so it can be re-shown without a
   *  new API call. Dexie writes IndexedDB; API mode is a no-op. */
  saveAiValidationCache(record: AiValidationCacheRecord): Promise<void>;
}

/** A cached set-wide AI content-check report (EXP-033 / AIV-04). */
export interface AiValidationCacheRecord {
  source: string;
  set_id: string;
  /** The set's ``cached_version`` when the check ran (invalidation). */
  set_version: string | null;
  /** AIV-09 content hash of the checked cards (null until AIV-08/09). */
  content_hash: string | null;
  results: import("../../../lib/ai/validation/content-validator").ValidationResult[];
  response_ids: string[];
  provider: string;
  model: string;
  card_count: number;
  issue_count: number;
  /** ISO timestamp the check completed. */
  checked_at: string;
  /** EXP-033 / AIV-09 signature, or null for pre-signature caches. */
  signature?: import("../../../lib/ai/validation/validation-signature").AiValidationSignature | null;
}

/** Input for the EXP-033 set-wide per-card AI check (AIV-02). */
export interface AiValidateCardsInput {
  /** Resolves the AI provider + key (IndexedDB settings, Dexie only). */
  user_id: string;
  source_language: string;
  target_language: string;
  level: string;
  /** Flattened cards to check (caller flattens across the set's lessons
   *  and applies the 500-card cap). Each item needs at least
   *  ``{id, front, back}``; ``notes`` is optional. */
  cards: import("../../../lib/ai/validation/content-validator").ValidationCard[];
  /** Per-batch progress callback (Dexie, client-side). */
  onProgress?: (progress: { current: number; total: number }) => void;
  /** Abort the run mid-batch. */
  signal?: AbortSignal;
}

/** Result of the EXP-033 set-wide per-card AI check (AIV-02). */
export interface AiValidateCardsResult {
  results: import("../../../lib/ai/validation/content-validator").ValidationResult[];
  /** Provider response ids, gathered across batches (AIV-09 signature). */
  response_ids: string[];
  /** Provider slug ("openai" | "anthropic" | "gemini"). */
  provider: string;
  /** Effective model used. */
  model: string;
  checked_cards: number;
  issue_count: number;
}

/** Input for the opt-in AI content validation (Phase 60). */
export interface AiValidateInput {
  /** Resolves the AI provider + key (server-side in API mode,
   *  IndexedDB settings in Dexie mode). */
  user_id: string;
  title: string;
  title_native?: string | null;
  target_language: string;
  source_language: string;
  level: string;
  lessons: ContentLesson[];
}

/** Phase 59B / v1.42.0 — the source marker for user-generated sets.
 *  "My Lessons" = ``listSets()`` filtered to this source. */
export const USER_GENERATED_SOURCE = "user-generated";

/** Origin of a user-generated lesson, surfaced in My Lessons and
 *  stored in the set's ``domain`` field. */
export type UserLessonOrigin = "analysis" | "adaptive" | "imported";

export interface SaveUserSetInput {
  /** Stable slug-safe set id (e.g. the conversation id). Re-saving
   *  with the same id overwrites. */
  set_id: string;
  title: string;
  /** Optional title in the target language (native script). */
  title_native?: string | null;
  /** Legacy: the target language. When ``target_language`` is
   *  omitted the storage layer falls back to this. */
  language: string;
  /** BCP-47 code of the language taught. Defaults to
   *  ``language`` when omitted. */
  target_language?: string;
  /** BCP-47 code of the language the learner already speaks.
   *  Defaults to ``"en"`` when omitted. */
  source_language?: string;
  level: string;
  origin: UserLessonOrigin;
  description?: string | null;
  /** One or more schema-valid lessons. Stored as
   *  ``lessons/{lesson.id}.json`` so the existing viewer +
   *  ``getLesson`` / ``listLessons`` paths work unchanged. */
  lessons: ContentLesson[];
}

// --- LessonProgress (Phase 44 / EXP-002 / P-109) ---------------------------

/**
 * The raw user answer for an exercise, persisted alongside the
 * step score so a revisited (locked) step can re-render the
 * exact post-check visual without redoing the exercise
 * (BUG P1 / Problem 2). Discriminated by exercise type.
 *
 * Lives in the storage layer because it is a persistence shape;
 * ``components/exercises/exercise-control`` re-exports it for the
 * renderers.
 */
