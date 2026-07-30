/**
 * DexieStorage — IStorageService backed by IndexedDB via Dexie.
 *
 * Phase 10B ships the storage shell: users, projects, settings,
 * curricula / topics / lessons CRUD all writeable. Assessment,
 * session, tracking and tools land in 10C / 10D / 10E.
 *
 * Notes on the design:
 *   - Every row is keyed by ``id`` (UUID). ``crypto.randomUUID()``
 *     supplies fresh ids on create. Timestamps come from
 *     ``nowIso()`` so future test-mocks can pin them.
 *   - Removed rows cascade by hand. Dexie has no built-in foreign
 *     keys; when a curriculum is removed we also drop its topics
 *     and lessons. The same applies to project / session removal
 *     once those routes exist.
 *   - UserSettings has one row per user. ``settings.get`` creates
 *     a default row on first call so the page never sees a 404.
 *   - Cleartext API keys land in ``userSettings.api_key_*``. The
 *     return shape strips them down to ``has_*_key: boolean`` to
 *     match the wire schema (the backend never returns cleartext
 *     either).
 *
 * Split (#1786): this file is the ``IStorageService`` COMPOSITION —
 * thin delegation maps plus the documented ``lessonProgress.upsert``
 * gamification wiring. Namespaces with real logic live in their
 * domain modules (``dexie/dexie-system``, ``dexie/dexie-plugin-
 * settings``, ``ai/pronunciation-dexie``, ``github/``,
 * ``learning-repo/``), following the #809 namespace-module split.
 */


import {
  createAnkiCard,
  deleteAnkiCard,
  extractFromConversationDexie,
  extractFromSessionDexie,
  listAnkiCards,
  markAnkiCardsExported,
  updateAnkiCard,
} from "./anki/anki";
import { evaluateBadgesForUser } from "./gamification/badges";
import {
  getDailyMissionsDexie,
  regenerateDailyMissionsDexie,
} from "./gamification/missions-dexie";
import { getDb } from "./dexie/db";
import {
  createDexieBackup,
  getDexieBackupStats,
  restoreDexieBackup,
} from "./backup/backup";
import {
  buildCurriculumOverview as dexieBuildCurriculumOverview,
  buildProgressReport as dexieBuildProgressReport,
  buildSessionDetail as dexieBuildSessionDetail,
} from "./backup/export-builder";
import {
  createStudyQuestion,
  deleteStudyQuestion,
  generateFromProjectDexie,
  generateFromSessionDexie,
  listStudyQuestions,
  studyGuideDexie,
  updateStudyQuestion,
} from "./anki/notebooklm";
import {
  aiValidateDexie,
  aiValidateCardsDexie,
  getAiValidationCacheDexie,
  saveAiValidationCacheDexie,
} from "./content/content-loader-dexie-ai";
import {
  deleteSetDexie,
  deleteSetsDexie,
  activeSourcesDexie,
  downloadSetDexie,
  getAssetDexie,
  getLessonDexie,
  listLessonsDexie,
  listSetsDexie,
  saveUserSetDexie,
} from "./content/content-loader-dexie";
import {
  getLessonProgressDexie,
  listLessonProgressDexie,
  upsertLessonProgressDexie,
} from "./lessons/lesson-progress-dexie";
import { awardLessonXpDexie } from "./gamification/lesson-xp-dexie";
import {
  computeReviewQueueDexie,
  listElementErrorsDexie,
  recordElementAttemptsDexie,
} from "./lessons/element-errors-dexie";
import { deleteLearningDataDexie } from "./lessons/orphan-data-dexie";
import type {
  IStorageService,
} from "./types";
import { dexiePronunciation } from "./ai/pronunciation-dexie";
import { dexieGamification } from "./gamification/dexie-gamification";
import { dexieCurricula, dexieLessons, dexieTopics } from "./dexie/dexie-curricula";
import { dexiePluginSettings } from "./dexie/dexie-plugin-settings";
import { dexieAssessment, dexieSession, dexieTools, dexieTracking } from "./dexie/dexie-session";
import { dexieSettings } from "./dexie/dexie-settings";
import { dexieI18n, dexieReset, dexieSystem } from "./dexie/dexie-system";
import { dexieProjectTaxonomy, dexieSubjects, dexieTags } from "./dexie/dexie-taxonomy";
import { dexieProjects, dexieUsers } from "./dexie/dexie-users";
import { dexieImports } from "./dexie/dexie-imports";
import { dexieGithub } from "./github";
import { dexieLearningRepo } from "./learning-repo";

// Row <-> wire mappers + requireRow/ensureSettings live in
// ./dexie-rows (#354), shared with the per-domain namespace modules.

// ---- Storage object ---------------------------------------------------

export const dexieStorage: IStorageService = {
  mode: "dexie",

  health: async () => ({
    status: "ok",
    version: "dexie-local",
    debug: false,
  }),

  i18n: dexieI18n,

  users: dexieUsers,
  projects: dexieProjects,
  settings: dexieSettings,
  assessment: dexieAssessment,
  session: dexieSession,
  tracking: dexieTracking,
  tools: dexieTools,
  curricula: dexieCurricula,
  topics: dexieTopics,
  lessons: dexieLessons,
  subjects: dexieSubjects,
  tags: dexieTags,
  projectTaxonomy: dexieProjectTaxonomy,

  plugins: {
    manifests: async () => ({}),
    health: async () => ({}),
    errors: async () => ({}),
  },

  // ---- Imported conversations (v0.9.0 / Phase 12C) ------------------

  imports: dexieImports,

  // ---- System info (v1.1.0 / Phase 14B) -----------------------------

  system: dexieSystem,

  // ---- Backup / restore (v1.2.0 / Phase 15B) -------------------------

  backup: {
    export: (userId) => createDexieBackup(userId, __APP_VERSION__),
    import: (userId, payload) => restoreDexieBackup(userId, payload),
    stats: (userId) => getDexieBackupStats(userId),
  },

  export: {
    progress: (userId, lang) => dexieBuildProgressReport(getDb(), userId, lang),
    session: (sessionId, lang) =>
      dexieBuildSessionDetail(getDb(), sessionId, lang),
    curriculum: (curriculumId, lang) =>
      dexieBuildCurriculumOverview(getDb(), curriculumId, lang),
  },

  gamification: dexieGamification,

  notebooklm: {
    listQuestions: (userId, filters) => listStudyQuestions(userId, filters),
    createQuestion: (userId, body) => createStudyQuestion(userId, body),
    updateQuestion: (questionId, body) => updateStudyQuestion(questionId, body),
    deleteQuestion: (questionId) => deleteStudyQuestion(questionId),
    generateFromSession: (sessionId) => generateFromSessionDexie(sessionId),
    generateFromProject: (projectId) => generateFromProjectDexie(projectId),
    studyGuide: (projectId) => studyGuideDexie(projectId),
  },

  pronunciation: dexiePronunciation,

  anki: {
    list: (userId, filters) => listAnkiCards(userId, filters),
    create: (userId, body) => createAnkiCard(userId, body),
    update: (cardId, body) => updateAnkiCard(cardId, body),
    remove: (cardId) => deleteAnkiCard(cardId),
    extractFromSession: (sessionId) => extractFromSessionDexie(sessionId),
    extractFromConversation: (conversationId) =>
      extractFromConversationDexie(conversationId),
    markExported: (cardIds) => markAnkiCardsExported(cardIds),
  },

  // --- LessonProgress (Phase 44 / EXP-002 / P-109) -------------------

  lessonProgress: {
    list: (userId) => listLessonProgressDexie(userId),
    get: (userId, source, setId, filename) =>
      getLessonProgressDexie(userId, source, setId, filename),
    // Phase 50D / v1.33.0 (D-DEXIE-GAMIFICATION) — detect the
    // in_progress -> completed transition and fire the
    // lesson-XP award (the Dexie-mode equivalent of the
    // backend gamification plugin's ``on_session_complete``
    // hook for content-lesson sessions). Errors from the
    // gamification side MUST NOT break a lesson completion —
    // log and continue, same pattern as the session-end XP
    // wiring at ``tracking.end``.
    upsert: async (userId, body) => {
      const before = await getLessonProgressDexie(
        userId,
        body.source,
        body.set_id,
        body.lesson_filename,
      );
      const wasCompleted = before?.status === "completed";
      const updated = await upsertLessonProgressDexie(userId, body);
      const justCompleted = updated.status === "completed" && !wasCompleted;
      if (justCompleted) {
        try {
          await awardLessonXpDexie(userId, updated);
          // Evaluate badges so lesson-gated badges
          // (first_lesson, lessons_10, etc.) fire after
          // the XP write. Phase 50E lands the badge
          // predicates themselves; until then this call
          // is a no-op for lesson keys but still updates
          // any other earned badges.
          await evaluateBadgesForUser(userId);
        } catch (err) {
          console.warn("gamification (lesson-complete) failed", err);
        }
      }
      return updated;
    },
  },

  // --- Element Errors (Phase 46B / EXP-007 / P-129) ---------------------

  elementErrors: {
    list: (userId, opts) => listElementErrorsDexie(userId, opts),
    recordBulk: (userId, attempts) =>
      recordElementAttemptsDexie(userId, attempts),
    reviewQueue: (userId, opts) => computeReviewQueueDexie(userId, opts),
  },

  // --- Learner-data maintenance (#1445) --------------------------------
  learningData: {
    deleteLearningData: (userId, deletion) =>
      deleteLearningDataDexie(userId, deletion),
  },

  // --- Daily missions (EXP-010 / Phase 56) -----------------------------
  missions: {
    getDaily: (userId, opts) => getDailyMissionsDexie(userId, opts),
    regenerate: (userId, opts) => regenerateDailyMissionsDexie(userId, opts),
  },

  // --- Content-Loader (Phase 43 / EXP-002) -----------------------------
  //
  // GH-Pages-shape: fetch from raw.githubusercontent.com,
  // cache in IndexedDB. The default source list lives in
  // ``content-loader-dexie.ts`` (Settings UI for editing
  // the sources ships later — v1.27.0 is read-only).
  contentLoader: {
    listSets: async () => listSetsDexie(await activeSourcesDexie()),
    downloadSet: async (source, setId, onProgress) =>
      downloadSetDexie(source, setId, await activeSourcesDexie(), onProgress),
    listLessons: (source, setId) => listLessonsDexie(source, setId),
    getLesson: (source, setId, filename) =>
      getLessonDexie(source, setId, filename),
    /** Phase 54 / v1.37.0 — read a cached asset blob from
     *  IndexedDB. Returns null when the set isn't cached
     *  OR the asset wasn't bundled with the download; the
     *  asset resolver hook (54B) interprets null as
     *  "fall back to placeholder SVG / text-only". */
    getAsset: (source, setId, assetPath) =>
      getAssetDexie(source, setId, assetPath),
    /** Phase 59B / v1.42.0 — persist a user-generated set
     *  (My Lessons) into the same IndexedDB tables as
     *  downloaded sets. */
    saveUserSet: (input) => saveUserSetDexie(input, new Date().toISOString()),
    deleteSet: (source, setId) => deleteSetDexie(source, setId),
    /** #1351 — bulk delete in one transaction. Lifecycle status lives in
     *  the mode-agnostic ``lib/content/browse/set-status-store``, not on
     *  the cached row. */
    deleteSets: (refs) => deleteSetsDexie(refs),
    aiValidate: (input) => aiValidateDexie(input),
    aiValidateCards: (input) => aiValidateCardsDexie(input),
    getAiValidationCache: (source, setId) =>
      getAiValidationCacheDexie(source, setId),
    saveAiValidationCache: (record) => saveAiValidationCacheDexie(record),
  },

  learningRepo: dexieLearningRepo,

  pluginSettings: dexiePluginSettings,

  github: dexieGithub,

  reset: dexieReset,
};
