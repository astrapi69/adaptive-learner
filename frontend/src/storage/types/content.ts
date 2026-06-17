/**
 * Content-loader namespace + lesson content schema.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type { AiValidationResult } from "../../lib/content/content-validation-types";

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
}

export interface ContentSetSource {
  source: string;
  branch: string;
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
  type: "matching" | "picture_choice" | "free_text" | "word_tiles" | "cloze";
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
  downloadSet(source: string, setId: string): Promise<ContentSetEntry>;
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
