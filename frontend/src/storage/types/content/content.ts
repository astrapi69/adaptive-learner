/**
 * Content-loader namespace + lesson content schema.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type { AiValidationResult } from "../../../lib/content/validation/content-validation-types";
import type {
  Card as GeneratedCard,
  CardTokenRole as GeneratedCardTokenRole,
  ClozeBlank as GeneratedClozeBlank,
  Direction as GeneratedDirection,
  Exercise as GeneratedExercise,
  InlineExample as GeneratedInlineExample,
  Lesson as GeneratedLesson,
  LessonResource as GeneratedLessonResource,
  LessonStep as GeneratedLessonStep,
  MediaType as GeneratedMediaType,
  TokenRole as GeneratedTokenRole,
} from "./lesson-schema.generated";

/**
 * Lifecycle status of a downloaded set in "Meine Inhalte" (#1300).
 * ``active`` is the default (clean working list); ``deferred`` parks a
 * set for later; ``completed`` marks it done. A destructive delete is a
 * separate action, not a status. Stored per-set in Dexie (see
 * ``ContentSetRow.status``); in API mode it is not persisted and every
 * set reads back as ``active``.
 */
export type SetStatus = "active" | "deferred" | "completed";

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
  /** ISO-8601 timestamp of when this set was downloaded/cached, or ``null``
   *  when not downloaded or unknown. Drives the "most recently downloaded
   *  first" ordering of the personal Learning Path (#1211). Surfaced in
   *  Dexie mode (from ``ContentSetRow.downloaded_at``); API mode has no
   *  per-set download time, so it stays ``null`` there. */
  downloaded_at?: string | null;
  /** #1300 — lifecycle status in "Meine Inhalte" (active / deferred /
   *  completed). Absent on pre-#1300 cached rows and in API mode; the
   *  storage layer + UI treat a missing value as ``"active"``. */
  status?: SetStatus;
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
 * Lesson content types — the consumer-facing surface (``Content*``)
 * for the App-authoritative lesson schema (EXP-039).
 *
 * SINGLE SOURCE OF TRUTH: the Pydantic models in
 * ``adaptive_learner_content_loader.schema``. ``make sync-schema``
 * derives ``schema/lesson.schema.json`` and, from it,
 * ``lesson-schema.generated.ts``. The ``Content*`` names below are
 * thin aliases of those generated types so the ~147 consumers keep
 * their import names while the field SHAPES come entirely from the
 * generated artefact — there is no parallel hand-maintained mirror
 * that can drift.
 *
 * The only adaptation is nullability: several collection fields have a
 * Pydantic default (``cards`` / ``card_ids`` / ``distractors`` /
 * ``tags`` = ``default_factory=list``; ``estimated_minutes`` = 10), so
 * in the VALIDATION JSON-Schema — and therefore in the generated TS —
 * they are optional. But ``Lesson.model_dump`` always emits them, so a
 * parsed lesson (every lesson the viewer ever sees) always carries
 * them. ``RequireKeys`` re-marks exactly those fields required for the
 * consumer view; it derives the value type from the generated type via
 * indexed access, so a field rename in the model surfaces as a compile
 * error here rather than drifting silently.
 */

/** Make the keys ``K`` of ``T`` required + non-null, deriving each value
 *  type from ``T`` (drift-safe: ``K extends keyof T``). */
type RequireKeys<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};

/** Card content kind (schema v1.3). Null/absent is treated as "text". */
export type ContentCardMediaType = NonNullable<GeneratedMediaType>;

/** EXP-018 / Phase 62 / v1.46.0 — drill direction. ``target_to_source``
 *  (default) is receptive (show target, recognise source);
 *  ``source_to_target`` is productive. ``both`` / ``random`` defer the
 *  choice to the renderer / adaptive generator. */
export type ContentExerciseDirection = GeneratedDirection;

/** Phase 52I / v1.35.0 / P-130 — closed grammatical-role enum.
 *  Annotates tokens inside a card's ``front`` so the cloze generator can
 *  pick a semantically-meaningful blank. */
export type ContentLessonCardTokenRoleName = GeneratedTokenRole;

/** Phase 52I / v1.35.0 / P-130 — one ``{token, role}`` annotation. */
export type ContentLessonCardTokenRole = GeneratedCardTokenRole;

/** Phase 52D / v1.35.0 / P-127 — one blank inside a CLOZE exercise's
 *  ``sentence``. */
export type ContentLessonClozeBlank = GeneratedClozeBlank;

/** Schema v1.5 (#1326) — one inline worked example on a theory step or an
 *  exercise. ``content`` is plain text, or syntax-highlighted code when
 *  ``language`` is set. Distinct from the ``example_url`` external-link
 *  variant (#139). */
export type ContentLessonExample = GeneratedInlineExample;

/** EXP-029 / MED-05 — one lesson-level supplementary-media entry (the raw
 *  shape stored in the content JSON). Optional + additive, so pre-EXP-029
 *  lessons load unchanged. Validated by ``parseLessonResources`` before
 *  display. */
export type ContentLessonResource = GeneratedLessonResource;

/** The smallest learnable unit. ``tags`` is always present at runtime
 *  (``default_factory=list``). */
export type ContentLessonCard = RequireKeys<GeneratedCard, "tags">;

/** One exercise step. ``card_ids`` + ``distractors`` are always present at
 *  runtime (``default_factory=list``). */
export type ContentLessonExercise = RequireKeys<GeneratedExercise, "card_ids" | "distractors">;

/** One step in the lesson sequence. Re-wires ``exercise`` to the
 *  consumer-facing {@link ContentLessonExercise}. */
export type ContentLessonStep = Omit<GeneratedLessonStep, "exercise"> & {
  exercise?: ContentLessonExercise | null;
};

/** One lesson in a content set. ``estimated_minutes`` (default 10),
 *  ``cards`` + ``steps`` are always present at runtime; ``cards`` /
 *  ``steps`` are re-wired to the consumer-facing element types. */
export type ContentLesson = Omit<GeneratedLesson, "cards" | "steps" | "estimated_minutes"> & {
  cards: ContentLessonCard[];
  estimated_minutes: NonNullable<GeneratedLesson["estimated_minutes"]>;
  steps: ContentLessonStep[];
};

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
  /** #1300 — set the lifecycle status of a downloaded set
   *  (active / deferred / completed) in "Meine Inhalte". Dexie mode
   *  persists it on the cached row(s); API mode is a no-op (the field
   *  is browser-local). Idempotent. */
  setSetStatus(source: string, setId: string, status: SetStatus): Promise<void>;
  /** #1351 — bulk variants for the "Meine Inhalte" multi-select bar.
   *  Dexie mode runs them as ONE transaction (batch, not N round-trips);
   *  API mode deletes sequentially and treats status as a no-op (the
   *  status field is browser-local). Idempotent. */
  deleteSets(refs: { source: string; setId: string }[]): Promise<void>;
  setSetsStatus(
    refs: { source: string; setId: string }[],
    status: SetStatus,
  ): Promise<void>;
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
 * ``components/exercises/shell/exercise-control`` re-exports it for the
 * renderers.
 */
