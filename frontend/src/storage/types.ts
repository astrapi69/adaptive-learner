/**
 * Storage abstraction layer (Phase 10A).
 *
 * ``IStorageService`` is the implementation-agnostic contract that
 * pages and components consume. Two implementations satisfy it:
 *
 *   - ``ApiStorage`` (10A): delegates to the FastAPI backend via
 *     ``api/client.ts``. Existing behaviour, unchanged.
 *   - ``DexieStorage`` (10B-10E): stores everything in IndexedDB
 *     via Dexie.js, calls AI providers directly from the browser.
 *
 * Pages MUST import from the storage layer (`getStorage()`), not
 * from ``api/client.ts`` directly. The factory in
 * ``storage/index.ts`` picks the right backend based on build-time
 * configuration and runtime preference.
 *
 * The method names mirror the ``api.*`` namespaces 1:1 so that
 * ApiStorage can be a thin pass-through. The argument lists are
 * the same as the existing api/client; the return shapes are the
 * same domain types from ``types/domain.ts``.
 */

import type { AIProvider, LearningMethod } from "../lib/constants";
import type { AiValidationResult } from "../lib/content/ai-content-validator";
import type {
  ApiKeySetBody,
  CurriculumCreateBody,
  CurriculumUpdateBody,
  LearningProjectCreateBody,
  LearningProjectUpdateBody,
  LessonCreateBody,
  LessonUpdateBody,
  SessionMessageBody,
  SessionRatingBody,
  SessionStartBody,
  SettingsPatchBody,
  SubjectCreateBody,
  SubjectUpdateBody,
  TagCreateBody,
  TagUpdateBody,
  TopicCreateBody,
  TopicUpdateBody,
  UserCreateBody,
  UserUpdateBody,
} from "../api/client";
import type {
  AssessmentEvaluatePayload,
  AssessmentQuestion,
  Curriculum,
  LearningProfile,
  LearningProject,
  LearningSession,
  LearningTopic,
  Lesson,
  ProgressCommit,
  ProgressSummary,
  SessionEndResult,
  SessionMessage,
  SessionMessageExchangeResult,
  SessionRating,
  SessionStartResult,
  SpacedRecommendation,
  Subject,
  SwitchRecommendation,
  Tag,
  ToolRecommendation,
  User,
  UserSettings,
} from "../types/domain";

export interface IUsersNamespace {
  create(body: UserCreateBody): Promise<User>;
  get(userId: string): Promise<User>;
  update(userId: string, body: UserUpdateBody): Promise<User>;
  projects: {
    list(userId: string): Promise<LearningProject[]>;
    create(
      userId: string,
      body: LearningProjectCreateBody,
    ): Promise<LearningProject>;
  };
  /**
   * Recover the most recent locally-known user identity, or null
   * when storage carries no recoverable trace (Phase 41B).
   *
   * - ``ApiStorage``: reads ~/.config/adaptive_learner/identity.yaml
   *   via ``GET /api/identity``. Returns null on 404.
   * - ``DexieStorage``: queries the most recent ``users`` row and
   *   its currently-active ``projects`` row. Returns null when the
   *   users table is empty.
   *
   * The caller (Landing.tsx) verifies the returned ``userId`` still
   * exists in the relevant backend before restoring localStorage.
   */
  findMostRecent(): Promise<RecoveryHint | null>;
}

/**
 * Recovery hint returned by :meth:`IUsersNamespace.findMostRecent`
 * (Phase 41B). The shape matches what ``Landing.tsx`` needs to
 * restore localStorage after a browser data wipe: which user, which
 * project they were on, which UI language. Wire-format conversion
 * (``active_project_id`` -> ``projectId``) happens inside each
 * storage implementation so Landing.tsx is mode-agnostic.
 */
export interface RecoveryHint {
  userId: string;
  projectId: string | null;
  language: string | null;
}

export interface IProjectsNamespace {
  get(projectId: string): Promise<LearningProject>;
  update(
    projectId: string,
    body: LearningProjectUpdateBody,
  ): Promise<LearningProject>;
}

export interface AvailableModel {
  id: string;
  name: string;
  context_window: number | null;
  description: string | null;
}

/** Outcome of a live API-key test (Phase 65). ``kind`` is a stable
 *  machine code the UI maps to a localized message. */
export type ApiKeyTestKind =
  | "ok"
  | "invalid"
  | "rate_limit"
  | "network"
  | "error"
  | "no_key";

export interface ApiKeyTestResult {
  success: boolean;
  kind: ApiKeyTestKind;
}

/** Metadata about a stored last-known-good key backup (Phase 65).
 *  Never carries the key itself. */
export interface ApiKeyBackupInfo {
  has: boolean;
  tested_at: string | null;
}

export interface ISettingsNamespace {
  get(userId: string): Promise<UserSettings>;
  update(userId: string, body: SettingsPatchBody): Promise<UserSettings>;
  setApiKey(userId: string, body: ApiKeySetBody): Promise<UserSettings>;
  deleteApiKey(userId: string, provider: AIProvider): Promise<UserSettings>;
  getApp(): Promise<Record<string, unknown>>;
  /**
   * Phase 65 — live API-key test. Fires a minimal provider call and
   * classifies the result. When ``key`` is given, tests THAT key
   * (pre-save); otherwise tests the currently-stored key. Never
   * saves. Both modes: ApiStorage hits the backend endpoint,
   * DexieStorage calls the provider browser-direct.
   */
  testApiKey(
    userId: string,
    body: { provider: AIProvider; key?: string },
  ): Promise<ApiKeyTestResult>;
  /**
   * Phase 65 — rollback cache. ``backupApiKey`` caches a tested-good
   * key as the last-known-good backup (called by the save flow after
   * a successful test); ``getApiKeyBackup`` returns its metadata (no
   * key); ``restoreApiKeyBackup`` restores it as the active key.
   * Both modes: ApiStorage hits the backend (Fernet-encrypted DB row),
   * DexieStorage uses an IndexedDB table.
   */
  backupApiKey(
    userId: string,
    body: { provider: AIProvider; key: string },
  ): Promise<UserSettings>;
  getApiKeyBackup(
    userId: string,
    provider: AIProvider,
  ): Promise<ApiKeyBackupInfo>;
  restoreApiKeyBackup(
    userId: string,
    provider: AIProvider,
  ): Promise<UserSettings>;
  /**
   * v1.11.0 / Phase 24 — provider model discovery. Returns
   * the chat-capable models the user has access to from the
   * provider's official models endpoint. Returns ``[]`` when
   * no API key for the provider is configured. Throws
   * ``ApiError`` on auth / network failure.
   */
  getAvailableModels(
    userId: string,
    provider: AIProvider,
  ): Promise<AvailableModel[]>;
}

export interface IAssessmentNamespace {
  questions(lang: string): Promise<AssessmentQuestion[]>;
  evaluate(body: AssessmentEvaluatePayload): Promise<LearningProfile>;
  profile(projectId: string): Promise<LearningProfile>;
}

export interface StreamMessageHandlers {
  onStart?: (userMessage: SessionMessage) => void;
  onChunk: (delta: string) => void;
  onDone: (result: SessionMessageExchangeResult) => void;
  signal?: AbortSignal;
}

export interface ISessionNamespace {
  start(body: SessionStartBody): Promise<SessionStartResult>;
  message(
    sessionId: string,
    body: SessionMessageBody,
  ): Promise<SessionMessageExchangeResult>;
  /**
   * v1.6.0 / Phase 19 — streaming variant of ``message``. Same
   * input + same exchange result, but the assistant text streams
   * back via the ``onChunk`` callback as it arrives. ``onDone``
   * fires once with the full exchange (assistant message + step
   * eval + topic transition + timings) when the stream closes.
   */
  streamMessage(
    sessionId: string,
    body: SessionMessageBody,
    handlers: StreamMessageHandlers,
  ): Promise<void>;
  rate(sessionId: string, body: SessionRatingBody): Promise<SessionRating>;
  end(sessionId: string): Promise<SessionEndResult>;
  switchRecommendation(sessionId: string): Promise<SwitchRecommendation>;
  acceptSwitch(
    sessionId: string,
    body: { to_method: LearningMethod; reason: string },
  ): Promise<LearningSession>;
  /**
   * Phase 36 Bug 4 — return the most recent active session
   * started from the given imported conversation, or ``null`` if
   * none. ImportDetail uses this to flip "Start session" into
   * "Continue session" before the user clicks.
   */
  getActiveForConversation(
    conversationId: string,
  ): Promise<LearningSession | null>;
  /**
   * Phase 38 Bug 7 — return a session record by ID. Used by the
   * Session route's resume path (``?session=<id>``): the page
   * fetches the existing session + its messages instead of
   * calling ``start()`` and creating a new one.
   */
  get(sessionId: string): Promise<LearningSession>;
  /**
   * Phase 38 Bug 7 — return the chat history for a session
   * (oldest-first; the system-prompt message lands as the
   * first entry). Used by the resume path so SessionChat
   * remounts with the prior conversation visible.
   */
  getMessages(sessionId: string): Promise<SessionMessage[]>;
}

export interface ITrackingNamespace {
  progress(projectId: string): Promise<ProgressSummary>;
  commits(projectId: string): Promise<ProgressCommit[]>;
}

// --- Content-Loader (Phase 43 / EXP-002) -----------------------------------

/**
 * One row in the Set Browser. Mirrors the backend's
 * ``SetEntryResponse`` 1:1 so the wire shape stays in lockstep
 * across ApiStorage + DexieStorage.
 */
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
export type ContentExerciseDirection =
  | "source_to_target"
  | "target_to_source"
  | "both"
  | "random";

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
  getLesson(
    source: string,
    setId: string,
    filename: string,
  ): Promise<ContentLesson>;
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
  getAsset(
    source: string,
    setId: string,
    assetPath: string,
  ): Promise<Blob | null>;
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
export type RawAnswer =
  | {kind: "matching"; matches: [number, number][]}
  | {kind: "picture_choice"; selected: number}
  | {kind: "free_text"; input: string}
  | {kind: "word_tiles"; placed: number[]}
  | {kind: "cloze"; inputs: string[]};

export interface LessonStepResult {
  step_id: string;
  correct: number;
  total: number;
  attempts?: number;
  /** Phase 52C / v1.35.0 — the user's text-form answer for the
   *  step, when applicable. Free-text + word-tiles populate
   *  it; matching + picture-choice leave it undefined. Powers
   *  the lesson-summary token-diff display. */
  user_answer?: string | null;
  /** BUG P1 / Problem 2 — the raw user answer, persisted so a
   *  revisited (locked) step re-renders the exact post-check
   *  visual instead of a fresh re-answerable exercise. */
  raw_answer?: RawAnswer | null;
}

export interface LessonProgressUpsertBody {
  source: string;
  set_id: string;
  lesson_filename: string;
  step_result?: LessonStepResult;
  time_spent_seconds_delta?: number;
  mark_completed?: boolean;
  /** Phase 63A — flip the row to ``paused`` and stamp
   *  ``paused_at``. ``step_results`` stay intact for the resume. */
  mark_paused?: boolean;
  /** Phase 63A — flip the row to ``abandoned`` and stamp
   *  ``abandoned_at``. ``step_results`` are cleared; ElementErrors
   *  from completed steps stay in their own table. */
  mark_abandoned?: boolean;
  /** Phase 63C — flip a ``paused`` row back to ``in_progress`` and
   *  clear ``paused_at`` so the viewer can resume from the saved
   *  ``step_results``. */
  mark_resumed?: boolean;
  /** Phase 63C — discard ``step_results`` + score and reset
   *  ``status`` to ``in_progress`` from any prior state. Used by
   *  the resume-dialog "Start Over" path. */
  mark_restarted?: boolean;
}

/**
 * One stored step result inside ``LessonProgress.step_results``.
 * Mirrors what the backend service writes per step.
 */
export interface LessonStepResultStored {
  correct: number;
  total: number;
  attempts: number;
  completed_at: string;
  /** Phase 52C / v1.35.0 — see ``LessonStepResult.user_answer``.
   *  Old rows without this field surface as ``undefined`` and the
   *  summary falls back to the canonical-answer-only line. */
  user_answer?: string | null;
  /** BUG P1 / Problem 2 — see ``LessonStepResult.raw_answer``.
   *  Old rows (completed before this shipped) lack it; the
   *  viewer falls back to a compact "completed" panel for those
   *  on revisit instead of an exact reconstruction. */
  raw_answer?: RawAnswer | null;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  source: string;
  set_id: string;
  lesson_filename: string;
  /** Phase 63A — lifecycle widened from in_progress|completed. */
  status: "in_progress" | "paused" | "abandoned" | "completed";
  /** Map of step_id → result. Parsed JSON; never a string. */
  step_results: Record<string, LessonStepResultStored>;
  score_correct: number;
  score_total: number;
  time_spent_seconds: number;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Phase 63A — set on pause, cleared on resume + completion. */
  paused_at: string | null;
  /** Phase 63A — set on abandon, cleared on completion. */
  abandoned_at: string | null;
}

/**
 * Per-user × per-lesson progress tracking. Parallel to the
 * session-plugin's ``ITrackingNamespace`` (sessions stay
 * separate from content-loader lessons in v1.28.0; Phase 46
 * unifies them when SRS lands).
 */
export interface ILessonProgressNamespace {
  list(userId: string): Promise<LessonProgress[]>;
  get(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
  ): Promise<LessonProgress | null>;
  upsert(
    userId: string,
    body: LessonProgressUpsertBody,
  ): Promise<LessonProgress>;
}

/**
 * One element attempt — the unit the recording endpoint
 * consumes. Multiple attempts per exercise submit for
 * matching (one per pair); single attempt per submit for
 * picture-choice / free-text / word-tiles. The exercise-side
 * deriver (C9) builds these from ``(exercise, userInput)``.
 *
 * Phase 46B / EXP-007 / P-129.
 */
export interface ElementAttempt {
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  element_key: string;
  /** EXP-018 / Phase 62 — concrete drill direction this attempt
   *  belongs to. A recorded attempt is always one of the two
   *  concrete directions (the exercise-level ``"both"`` /
   *  ``"random"`` are resolved before recording). Omitted =
   *  receptive (``"target_to_source"``), the pre-62 default. */
  direction?: "source_to_target" | "target_to_source";
  element_type?: string;
  user_answer?: string;
  correct_answer?: string;
  correct: boolean;
}

/**
 * Server-side element-error payload. Identical shape on both
 * ApiStorage and DexieStorage so the review-queue UI in
 * Phase 46C can render either source uniformly.
 */
export interface ElementError {
  id: string;
  user_id: string;
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  element_key: string;
  /** EXP-018 / Phase 62 — drill direction this row tracks. Always
   *  present from the backend and DexieStorage (defaulted to
   *  ``"target_to_source"``); optional in the type so pre-62 test
   *  fixtures that predate the field still type-check. */
  direction?: string;
  element_type: string;
  user_answer: string;
  correct_answer: string;
  error_count: number;
  correct_streak: number;
  last_error_at: string | null;
  last_attempt_at: string;
  mastered: boolean;
  mastered_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One row of the SRS review queue (Phase 46C / P-129).
 * Mirrors the backend ``ReviewQueueItemOut`` schema 1:1.
 */
export interface ReviewQueueItem {
  id: string;
  user_id: string;
  set_id: string;
  lesson_id: string;
  exercise_id: string;
  element_key: string;
  /** EXP-018 / Phase 62 — drill direction of this queue item.
   *  The same element can appear twice (once per direction).
   *  Always present at runtime; optional for pre-62 fixtures. */
  direction?: string;
  element_type: string;
  user_answer: string;
  correct_answer: string;
  error_count: number;
  correct_streak: number;
  last_error_at: string | null;
  last_attempt_at: string;
  suggested_review_at: string;
  overdue: boolean;
}

/**
 * Element-error namespace on IStorageService. ApiStorage
 * delegates to /api/users/{user_id}/element-errors;
 * DexieStorage runs the transition matrix + SRS scheduling
 * client-side via ``element-errors-dexie.ts``.
 */
export interface IElementErrorsNamespace {
  list(
    userId: string,
    opts?: { setId?: string; includeMastered?: boolean },
  ): Promise<ElementError[]>;
  recordBulk(
    userId: string,
    attempts: readonly ElementAttempt[],
  ): Promise<ElementError[]>;
  /** Projected review queue: active (non-mastered)
   *  elements with computed suggested_review_at + overdue
   *  flag, sorted by urgency (overdue → error_count desc →
   *  last_error_at desc). */
  reviewQueue(
    userId: string,
    opts?: { setId?: string },
  ): Promise<ReviewQueueItem[]>;
}

// EXP-010 / Phase 56 — daily missions. ``getDaily`` assigns the
// day's missions on first call (deterministic) and re-evaluates
// live progress on every call; ``regenerate`` reshuffles today's
// set (Settings reset). Both work in API + Dexie mode.
export interface IMissionsNamespace {
  getDaily(
    userId: string,
    options?: MissionDailyOptions,
  ): Promise<MissionDailyResult>;
  regenerate(
    userId: string,
    options?: MissionDailyOptions,
  ): Promise<MissionDailyResult>;
}

export interface MissionDailyOptions {
  count?: number;
  difficultyMix?: import("../lib/missions/types").DifficultyMix;
  todayIso?: string;
}

export interface MissionDailyResult {
  missions: import("../lib/missions/types").DailyMission[];
  newlyCompleted: import("../lib/missions/types").DailyMission[];
}

/** Wire shape from the backend (snake_case ``newly_completed``);
 *  ApiStorage maps it to the camelCase ``MissionDailyResult``. */
export interface MissionDailyResultWire {
  missions: import("../lib/missions/types").DailyMission[];
  newly_completed: import("../lib/missions/types").DailyMission[];
}

export interface IToolsNamespace {
  recommendations(
    projectId: string,
    lang: string,
  ): Promise<ToolRecommendation[]>;
  spaced(projectId: string, lang: string): Promise<SpacedRecommendation[]>;
}

export interface ICurriculaNamespace {
  list(userId: string): Promise<Curriculum[]>;
  create(userId: string, body: CurriculumCreateBody): Promise<Curriculum>;
  get(curriculumId: string): Promise<Curriculum>;
  update(curriculumId: string, body: CurriculumUpdateBody): Promise<Curriculum>;
  remove(curriculumId: string): Promise<void>;
  /**
   * Phase 36 Bug 3 — return the curriculum auto-generated from
   * the given imported conversation, or ``null`` if none exists.
   * ImportDetail uses the answer to flip its "Create curriculum"
   * CTA into a "Go to curriculum" navigate.
   */
  getForConversation(conversationId: string): Promise<Curriculum | null>;
  listTopics(curriculumId: string): Promise<LearningTopic[]>;
  createTopic(
    curriculumId: string,
    body: TopicCreateBody,
  ): Promise<LearningTopic>;
  listLessons(curriculumId: string): Promise<Lesson[]>;
  createLesson(curriculumId: string, body: LessonCreateBody): Promise<Lesson>;
}

export interface ITopicsNamespace {
  get(topicId: string): Promise<LearningTopic>;
  update(topicId: string, body: TopicUpdateBody): Promise<LearningTopic>;
  remove(topicId: string): Promise<void>;
}

export interface ILessonsNamespace {
  get(lessonId: string): Promise<Lesson>;
  update(lessonId: string, body: LessonUpdateBody): Promise<Lesson>;
  remove(lessonId: string): Promise<void>;
}

export interface II18nNamespace {
  get(lang: string): Promise<Record<string, unknown>>;
}

export interface IPluginsNamespace {
  manifests(): Promise<Record<string, unknown>>;
  health(): Promise<Record<string, unknown>>;
  errors(): Promise<Record<string, string>>;
}

/**
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * Learning Repository render + ZIP export. Mirrors the
 * backend's ``/api/plugins/learning-repo/render`` +
 * ``/export-zip`` endpoints (v1.26.0 / Phase 42) so the
 * LearningRepo page works in BOTH storage modes.
 *
 * In Dexie mode, the renderer is the TypeScript port at
 * ``frontend/src/lib/learning-repo/`` (49B-D); the
 * implementation builds the RenderContext from IndexedDB
 * via ``loadDexieContext`` and writes the ZIP with JSZip
 * client-side.
 *
 * The ``persist`` endpoint (git commit + tag) is NOT in
 * this namespace by design: it needs a server-side
 * filesystem + git binary, so it stays on
 * ``api.learningRepo.persist`` only. The LearningRepo page
 * gates the "Persist to git" button on storage mode.
 */
export interface ILearningRepoNamespace {
  render(
    projectId: string,
    language?: string,
  ): Promise<{
    project_id: string;
    language: string;
    rendered_at: string;
    files: Record<string, string>;
  }>;
  exportZip(projectId: string, language?: string): Promise<Blob>;
}

/**
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * per-plugin settings round-trip. Mirrors the backend's
 * generic ``GET / PATCH /api/plugin-settings/{plugin_name}``
 * endpoints (v1.26.0 / Phase 42) so that every plugin's
 * user-visible settings UI can run in BOTH storage modes
 * without branching.
 *
 * Return shape is the API response 1:1: ``{plugin, settings}``.
 *
 * In Dexie mode, the ``pluginSettings`` IndexedDB table holds
 * one row per plugin name; the first ``get`` for a plugin that
 * has no row yet returns the bundled YAML defaults from
 * ``frontend/src/data/plugin-config/{name}.json`` (regenerated
 * from ``backend/config/plugins/*.yaml`` via
 * ``scripts/sync_plugin_config_to_frontend.py``). ``update``
 * upserts the merged settings into the table.
 */
export interface IPluginSettingsNamespace {
  get(pluginName: string): Promise<{
    plugin: string;
    settings: Record<string, unknown>;
  }>;
  update(
    pluginName: string,
    body: { settings: Record<string, unknown> },
  ): Promise<{ plugin: string; settings: Record<string, unknown> }>;
}

// --- Imports (v0.9.0 / Phase 12C) --------------------------------------

import type {
  BackupPayload,
  BackupStats,
  ImportedConversation,
  ImportedConversationDetail,
  ImportedConversationCreateBody,
  ImportedConversationUpdateBody,
  ImportedConversationAnalysis,
  RestoreSummary,
  SystemInfo,
} from "../types/domain";

export interface ISystemNamespace {
  info(): Promise<SystemInfo>;
}

/**
 * Backup namespace (v1.2.0 / Phase 15). Both storage modes
 * implement the same shape so the Settings UI doesn't branch.
 *
 * - In API mode: delegates to ``/api/backup/*``.
 * - In Dexie mode: runs the same logic browser-side using the
 *   IndexedDB tables directly. The wire format is identical so
 *   a backup created in either mode can be restored in either.
 */
export interface IBackupNamespace {
  export(userId: string): Promise<BackupPayload>;
  import(userId: string, payload: BackupPayload): Promise<RestoreSummary>;
  stats(userId: string): Promise<BackupStats & { user_id: string }>;
}

/**
 * Export namespace (v1.3.0 / Phase 16). Produces the structured
 * payload that ``lib/export/markdown-renderer`` and the PDF
 * renderer consume. Same shape in both storage modes.
 */
export interface IExportNamespace {
  progress(
    userId: string,
    lang: string,
  ): Promise<import("./export-builder").ProgressReport>;
  session(
    sessionId: string,
    lang: string,
  ): Promise<import("./export-builder").SessionDetail>;
  curriculum(
    curriculumId: string,
    lang: string,
  ): Promise<import("./export-builder").CurriculumOverview>;
}

// --- Taxonomy: Subjects + Tags (v1.9.0 / Phase 22) ---------------------

export interface ISubjectsNamespace {
  list(): Promise<Subject[]>;
  get(subjectId: string): Promise<Subject>;
  create(body: SubjectCreateBody): Promise<Subject>;
  update(subjectId: string, body: SubjectUpdateBody): Promise<Subject>;
  remove(subjectId: string): Promise<void>;
}

export interface ITagsNamespace {
  list(userId: string): Promise<Tag[]>;
  create(userId: string, body: TagCreateBody): Promise<Tag>;
  update(tagId: string, body: TagUpdateBody): Promise<Tag>;
  remove(tagId: string): Promise<void>;
}

export interface IProjectTaxonomyNamespace {
  listSubjects(projectId: string): Promise<Subject[]>;
  assignSubject(projectId: string, subjectId: string): Promise<Subject>;
  unassignSubject(projectId: string, subjectId: string): Promise<void>;
  listTags(projectId: string): Promise<Tag[]>;
  assignTag(projectId: string, tagId: string): Promise<Tag>;
  unassignTag(projectId: string, tagId: string): Promise<void>;
}

/**
 * Anki flashcard suggestion (Phase 30B / v1.17.0).
 *
 * AI-extracted candidate that the user reviews + accepts +
 * edits before .apkg export. Mirrors the backend
 * ``AnkiCardSuggestionOut`` schema.
 */
export interface AnkiCardSuggestion {
  id: string;
  user_id: string;
  session_id: string | null;
  conversation_id: string | null;
  project_id: string | null;
  card_type: "basic" | "cloze";
  front: string;
  back: string;
  tags: string[];
  accepted: boolean;
  rejected: boolean;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnkiCardCreateBody {
  session_id?: string | null;
  conversation_id?: string | null;
  project_id?: string | null;
  card_type?: "basic" | "cloze";
  front: string;
  back: string;
  tags?: string[];
  accepted?: boolean;
}

export interface AnkiCardUpdateBody {
  card_type?: "basic" | "cloze";
  front?: string;
  back?: string;
  tags?: string[];
  accepted?: boolean;
  rejected?: boolean;
}

export interface AnkiCardListFilters {
  projectId?: string;
  acceptedOnly?: boolean;
  includeRejected?: boolean;
}

/**
 * Study question (Phase 32B / v1.19.0) — AI-generated active-
 * recall flashcard candidate. User reviews, edits, deletes.
 */
export type StudyQuestionType = "open" | "fill_blank" | "explain" | "compare";
export type StudyQuestionDifficulty = "easy" | "medium" | "hard";

export interface StudyQuestion {
  id: string;
  user_id: string;
  project_id: string;
  session_id: string | null;
  question: string;
  expected_answer: string;
  question_type: StudyQuestionType;
  difficulty: StudyQuestionDifficulty;
  topic: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudyQuestionCreateBody {
  project_id: string;
  session_id?: string | null;
  question: string;
  expected_answer?: string;
  question_type?: StudyQuestionType;
  difficulty?: StudyQuestionDifficulty;
  topic?: string;
}

export interface StudyQuestionUpdateBody {
  question?: string;
  expected_answer?: string;
  question_type?: StudyQuestionType;
  difficulty?: StudyQuestionDifficulty;
  topic?: string;
}

export interface StudyQuestionListFilters {
  projectId?: string;
  difficulty?: StudyQuestionDifficulty;
  topic?: string;
}

export interface INotebookLMNamespace {
  listQuestions(
    userId: string,
    filters?: StudyQuestionListFilters,
  ): Promise<StudyQuestion[]>;
  createQuestion(
    userId: string,
    body: StudyQuestionCreateBody,
  ): Promise<StudyQuestion>;
  updateQuestion(
    questionId: string,
    body: StudyQuestionUpdateBody,
  ): Promise<StudyQuestion>;
  deleteQuestion(questionId: string): Promise<void>;
  generateFromSession(sessionId: string): Promise<StudyQuestion[]>;
  generateFromProject(projectId: string): Promise<StudyQuestion[]>;
  studyGuide(projectId: string): Promise<string>;
}

/**
 * Pronunciation practice (Phase 31C / v1.18.0).
 *
 * ``eligibility`` works in both storage modes — it just walks
 * the project's subject taxonomy looking for a ``Languages``
 * ancestor.
 *
 * ``phrase`` + ``judge`` require an active AI provider with a
 * stored API key; the API-mode path is the backend's
 * ``/plugins/session/pronunciation/*`` routes, and the
 * Dexie-mode path throws ``ApiError(501)`` for v1.18.0 (browser-
 * direct AI for pronunciation deferred to a polish patch). The
 * Pronunciation page surfaces a clear "switch to API mode"
 * hint when the throw fires.
 */
export interface PronunciationVerdict {
  matches: boolean;
  score: number;
  feedback: string;
  missed_sounds: string[];
}

export interface IPronunciationNamespace {
  eligibility(projectId: string): Promise<{ eligible: boolean }>;
  phrase(args: {
    project_id: string;
    language: string;
    level?: string;
    focus?: string;
    previous?: string[];
  }): Promise<{ phrase: string; language: string }>;
  judge(args: {
    project_id: string;
    target: string;
    actual: string;
    language: string;
  }): Promise<PronunciationVerdict>;
}

export interface IAnkiNamespace {
  list(
    userId: string,
    filters?: AnkiCardListFilters,
  ): Promise<AnkiCardSuggestion[]>;
  create(userId: string, body: AnkiCardCreateBody): Promise<AnkiCardSuggestion>;
  update(cardId: string, body: AnkiCardUpdateBody): Promise<AnkiCardSuggestion>;
  remove(cardId: string): Promise<void>;
  extractFromSession(sessionId: string): Promise<AnkiCardSuggestion[]>;
  extractFromConversation(
    conversationId: string,
  ): Promise<AnkiCardSuggestion[]>;
  markExported(cardIds: string[]): Promise<{ updated: number }>;
}

/**
 * Per-user XP / level state (Phase 29A / v1.16.0).
 *
 * ``state`` returns the current ``UserXP`` row plus derived
 * ``xp_into_level`` + ``xp_to_next_level`` so the dashboard
 * progress bar doesn't have to recompute the threshold curve.
 *
 * ``awardSession`` is invoked from session-end in Dexie mode
 * only — in API mode the gamification plugin's hook handles
 * the award server-side. Returns the breakdown so the floating
 * "+50 XP" animation can render without a follow-up roundtrip.
 *
 * ``awardAssessment`` / ``awardImport`` are flat earns from
 * the assessment + import flows; both modes call them.
 */
export interface XPState {
  user_id: string;
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_to_next_level: number;
  next_level_threshold: number;
  updated_at?: string;
}

export interface XPAwardResult {
  xp_earned: number;
  xp_total: number;
  level: number;
  level_up: boolean;
  multiplier: number;
  breakdown: Record<string, number>;
  reason: string;
}

/**
 * Badge catalog + earn state combined (Phase 29B). The frontend
 * receives the full catalog with per-user ``earned`` + ``earned_at``
 * fields so the showcase can render locked + unlocked badges in
 * one roundtrip.
 */
export interface BadgeWithProgress {
  key: string;
  name_key: string;
  description_key: string;
  icon: string;
  category: string;
  // Phase 57 / v1.40.0. ``tier`` is the user's earned tier when
  // earned, else the badge's locked ``base_tier``. ``tier_thresholds``
  // drives the next-tier progress bar for DYNAMIC badges.
  base_tier: string;
  tier: string;
  tier_thresholds: Record<
    string,
    { threshold: number; xp_bonus: number }
  > | null;
  earned: boolean;
  earned_at: string | null;
  progress: string | null;
}

/** A badge tier transition (Phase 57 / v1.40.0). ``old_tier`` is null
 *  on a dynamic badge's first earn. Drives the celebration bus. */
export interface BadgeTierUpgrade {
  key: string;
  old_tier: string | null;
  new_tier: string;
  xp_awarded: number;
}

/** Result of an evaluation pass: newly-earned badge keys + tier
 *  upgrades. Shared shape across ApiStorage + DexieStorage. */
export interface BadgeEvaluationResult {
  earned: string[];
  upgrades: BadgeTierUpgrade[];
}

export interface StreakStateOut {
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  freezes_available: number;
  weekend_mode: boolean;
  last_freeze_earned_on: string | null;
  last_freeze_used_on: string | null;
}

export interface HeatmapEntryOut {
  date: string;
  count: number;
}

export interface IGamificationNamespace {
  getState(userId: string): Promise<XPState>;
  awardAssessment(userId: string): Promise<XPAwardResult>;
  awardImport(userId: string): Promise<XPAwardResult>;
  listBadges(userId: string): Promise<BadgeWithProgress[]>;
  evaluateBadges(userId: string): Promise<BadgeEvaluationResult>;
  getStreak(userId: string): Promise<StreakStateOut>;
  getStreakHeatmap(userId: string, days?: number): Promise<HeatmapEntryOut[]>;
  setWeekendMode(userId: string, enabled: boolean): Promise<StreakStateOut>;
  /** Destructive: wipes XP, badges, streak. Used by Settings. */
  resetProgress(userId: string): Promise<{
    xp_deleted: number;
    badges_deleted: number;
    streak_deleted: number;
  }>;
}

export interface IImportsNamespace {
  list(userId: string): Promise<ImportedConversation[]>;
  create(
    userId: string,
    body: ImportedConversationCreateBody,
  ): Promise<ImportedConversation>;
  get(conversationId: string): Promise<ImportedConversationDetail>;
  update(
    conversationId: string,
    body: ImportedConversationUpdateBody,
  ): Promise<ImportedConversation>;
  remove(conversationId: string): Promise<void>;
  saveAnalysis(
    conversationId: string,
    analysis: ImportedConversationAnalysis,
  ): Promise<ImportedConversationDetail>;
  /**
   * Server-side analyze. API mode dispatches the analysis call
   * server-side because the user's cleartext API key never
   * leaves the backend. Dexie mode keeps the browser-direct
   * path (the cleartext key lives in the local Dexie row), so
   * this method throws there — callers must branch on
   * ``storage.mode``.
   */
  analyze(conversationId: string): Promise<ImportedConversationDetail>;
}

/**
 * Marker for the backing store. Pages don't typically need to
 * branch on this, but Settings (and a few tests) do.
 */
export type StorageMode = "api" | "dexie";

/**
 * The full storage contract. Mirrors ``api.*`` in api/client.ts;
 * every namespace's methods take the same arguments and return
 * the same domain types.
 */
export interface IStorageService {
  readonly mode: StorageMode;

  health(): Promise<{ status: string; version: string; debug: boolean }>;

  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  imports: IImportsNamespace;
  system: ISystemNamespace;
  backup: IBackupNamespace;
  export: IExportNamespace;
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  pronunciation: IPronunciationNamespace;
  notebooklm: INotebookLMNamespace;
  contentLoader: IContentLoaderNamespace;
  lessonProgress: ILessonProgressNamespace;
  elementErrors: IElementErrorsNamespace;
  pluginSettings: IPluginSettingsNamespace;
  learningRepo: ILearningRepoNamespace;
  missions: IMissionsNamespace;

  /**
   * Phase 41F Danger Zone reset. Wipes every piece of learner
   * state this storage backend owns:
   *
   * - ``ApiStorage``: POSTs ``{confirmation}`` to /api/reset.
   *   The backend truncates every SQLite table, clears
   *   ~/.config/adaptive_learner/identity.yaml, and scrubs
   *   ``ai.*`` from secrets.yaml (preserving secret_key).
   * - ``DexieStorage``: clears every store in the main IndexedDB
   *   DB plus the separate auto-backup ring. localStorage +
   *   sessionStorage are cleared by the calling component
   *   (DangerZoneSection), not here.
   *
   * Both implementations require the literal ``"RESET"`` token;
   * ApiStorage forwards it to the backend gate, DexieStorage
   * checks it locally and rejects with an ApiError(400) so the
   * UI's typed-confirm pattern is enforced uniformly across
   * modes.
   */
  reset(confirmation: string): Promise<{ reset: true; tables_cleared: number }>;
}
