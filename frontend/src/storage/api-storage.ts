/**
 * ApiStorage — IStorageService backed by the FastAPI backend.
 *
 * This is a thin pass-through to ``api.*`` in ``api/client.ts``.
 * Every method delegates 1:1; no behavioural change vs. v0.6.0.
 *
 * The single point of indirection lets pages depend on
 * IStorageService instead of the api object directly, which makes
 * the DexieStorage swap (10F) a single line in the factory.
 */

import { api, ApiError } from "../api/client";
import { enqueueRequest } from "../lib/pwa/sync-queue";
import {
  applyStoredLessonOrderToList,
  recordSavedSetOrder,
} from "../lib/content/browse/lesson-order-store";
import type {
  ApiKeyTestResult,
  GitHubVerifyKind,
  IStorageService,
} from "./types";

export const apiStorage: IStorageService = {
  mode: "api",

  health: () => api.health(),

  i18n: {
    get: (lang) => api.i18n.get(lang),
  },

  users: {
    create: (body) => api.users.create(body),
    get: (userId) => api.users.get(userId),
    update: (userId, body) => api.users.update(userId, body),
    projects: {
      list: (userId) => api.users.projects.list(userId),
      create: (userId, body) => api.users.projects.create(userId, body),
    },
    findMostRecent: async () => {
      // Phase 41B: identity.yaml is the recovery channel in API
      // mode. ``api.identity.get`` returns null on 404 so we
      // pass through without an explicit catch.
      const payload = await api.identity.get();
      if (payload === null) {
        return null;
      }
      return {
        userId: payload.user_id,
        projectId: payload.active_project_id,
        language: payload.language,
      };
    },
  },

  projects: {
    get: (projectId) => api.projects.get(projectId),
    update: (projectId, body) => api.projects.update(projectId, body),
  },

  settings: {
    get: (userId) => api.settings.get(userId),
    update: (userId, body) => api.settings.update(userId, body),
    setApiKey: (userId, body) => api.settings.setApiKey(userId, body),
    deleteApiKey: (userId, provider) =>
      api.settings.deleteApiKey(userId, provider),
    // EXP-038 — keys live server-side (Fernet-encrypted) in API mode and never
    // reach the client as plaintext, so there is nothing to export here. The
    // empty result gates the encrypted-key-export entry off in API mode.
    exportApiKeys: async () => ({}),
    getApp: () => api.settings.getApp(),
    getAvailableModels: (userId, provider) =>
      api.settings.getAvailableModels(userId, provider),
    testApiKey: async (userId, body) => {
      const result = await api.settings.testApiKey(userId, body);
      return {
        success: result.success,
        kind: result.kind as ApiKeyTestResult["kind"],
      };
    },
    backupApiKey: (userId, body) => api.settings.backupApiKey(userId, body),
    getApiKeyBackup: (userId, provider) =>
      api.settings.getApiKeyBackup(userId, provider),
    restoreApiKeyBackup: (userId, provider) =>
      api.settings.restoreApiKeyBackup(userId, provider),
  },

  assessment: {
    questions: (lang) => api.assessment.questions(lang),
    evaluate: (body) => api.assessment.evaluate(body),
    profile: (projectId) => api.assessment.profile(projectId),
  },

  session: {
    start: (body) => api.session.start(body),
    message: (sessionId, body) => api.session.message(sessionId, body),
    streamMessage: (sessionId, body, handlers) =>
      api.session.streamMessage(sessionId, body, handlers),
    rate: (sessionId, body) => api.session.rate(sessionId, body),
    end: (sessionId) => api.session.end(sessionId),
    switchRecommendation: (sessionId) =>
      api.session.switchRecommendation(sessionId),
    acceptSwitch: (sessionId, body) =>
      api.session.acceptSwitch(sessionId, body),
    // Phase 36 Bug 4 — HTTP shape lives under /imports/, not
    // /session/, because the lookup is "did THIS conversation
    // start a session?". Same answer either way.
    getActiveForConversation: (conversationId) =>
      api.imports.getActiveSession(conversationId),
    // Phase 38 Bug 7 — resume path: fetch the existing
    // session record + chat history so Session.tsx can
    // re-render the prior conversation instead of starting
    // a fresh one.
    get: (sessionId) => api.session.get(sessionId),
    getMessages: (sessionId) => api.session.getMessages(sessionId),
  },

  tracking: {
    progress: (projectId) => api.tracking.progress(projectId),
    commits: (projectId) => api.tracking.commits(projectId),
  },

  tools: {
    recommendations: (projectId, lang) =>
      api.tools.recommendations(projectId, lang),
    spaced: (projectId, lang) => api.tools.spaced(projectId, lang),
  },

  curricula: {
    list: (userId) => api.curricula.list(userId),
    create: (userId, body) => api.curricula.create(userId, body),
    get: (curriculumId) => api.curricula.get(curriculumId),
    update: (curriculumId, body) => api.curricula.update(curriculumId, body),
    remove: (curriculumId) => api.curricula.remove(curriculumId),
    // Phase 36 Bug 3 — HTTP shape lives under /imports/, not
    // /curricula/, because the lookup is "what did THIS
    // conversation produce?". Same answer either way.
    getForConversation: (conversationId) =>
      api.imports.getCurriculum(conversationId),
    listTopics: (curriculumId) => api.curricula.listTopics(curriculumId),
    createTopic: (curriculumId, body) =>
      api.curricula.createTopic(curriculumId, body),
    listLessons: (curriculumId) => api.curricula.listLessons(curriculumId),
    createLesson: (curriculumId, body) =>
      api.curricula.createLesson(curriculumId, body),
  },

  topics: {
    get: (topicId) => api.topics.get(topicId),
    update: (topicId, body) => api.topics.update(topicId, body),
    remove: (topicId) => api.topics.remove(topicId),
  },

  lessons: {
    get: (lessonId) => api.lessons.get(lessonId),
    update: (lessonId, body) => api.lessons.update(lessonId, body),
    remove: (lessonId) => api.lessons.remove(lessonId),
  },

  plugins: {
    manifests: () => api.plugins.manifests(),
    health: () => api.plugins.health(),
    errors: () => api.plugins.errors(),
  },

  imports: {
    list: (userId) => api.imports.list(userId),
    create: (userId, body) => api.imports.create(userId, body),
    get: (conversationId) => api.imports.get(conversationId),
    update: (conversationId, body) => api.imports.update(conversationId, body),
    remove: (conversationId) => api.imports.remove(conversationId),
    saveAnalysis: (conversationId, analysis) =>
      api.imports.saveAnalysis(conversationId, analysis),
    analyze: (conversationId) => api.imports.analyze(conversationId),
  },

  system: {
    info: () => api.system.info(),
  },

  backup: {
    export: (userId) => api.backup.export(userId),
    import: (userId, payload) => api.backup.import(userId, payload),
    stats: (userId) => api.backup.stats(userId),
  },

  export: {
    progress: (userId, lang) => api.export.progress(userId, lang),
    session: (sessionId, lang) => api.export.session(sessionId, lang),
    curriculum: (curriculumId, lang) =>
      api.export.curriculum(curriculumId, lang),
  },

  subjects: {
    list: () => api.subjects.list(),
    get: (subjectId) => api.subjects.get(subjectId),
    create: (body) => api.subjects.create(body),
    update: (subjectId, body) => api.subjects.update(subjectId, body),
    remove: (subjectId) => api.subjects.remove(subjectId),
  },

  tags: {
    list: (userId) => api.tags.list(userId),
    create: (userId, body) => api.tags.create(userId, body),
    update: (tagId, body) => api.tags.update(tagId, body),
    remove: (tagId) => api.tags.remove(tagId),
  },

  projectTaxonomy: {
    listSubjects: (projectId) => api.projectTaxonomy.listSubjects(projectId),
    assignSubject: (projectId, subjectId) =>
      api.projectTaxonomy.assignSubject(projectId, subjectId),
    unassignSubject: (projectId, subjectId) =>
      api.projectTaxonomy.unassignSubject(projectId, subjectId),
    listTags: (projectId) => api.projectTaxonomy.listTags(projectId),
    assignTag: (projectId, tagId) =>
      api.projectTaxonomy.assignTag(projectId, tagId),
    unassignTag: (projectId, tagId) =>
      api.projectTaxonomy.unassignTag(projectId, tagId),
  },

  gamification: {
    getState: (userId) => api.gamification.getState(userId),
    awardAssessment: (userId) => api.gamification.awardAssessment(userId),
    awardImport: (userId) => api.gamification.awardImport(userId),
    spendXp: (userId, amount, reason) =>
      api.gamification.spendXp(userId, amount, reason),
    listBadges: (userId) => api.gamification.listBadges(userId),
    evaluateBadges: (userId) => api.gamification.evaluateBadges(userId),
    getStreak: (userId) => api.gamification.getStreak(userId),
    getStreakHeatmap: (userId, days) =>
      api.gamification.getStreakHeatmap(userId, days),
    setWeekendMode: (userId, enabled) =>
      api.gamification.setWeekendMode(userId, enabled),
    resetProgress: (userId) => api.gamification.resetProgress(userId),
  },

  anki: {
    list: (userId, filters) => api.anki.list(userId, filters),
    create: (userId, body) => api.anki.create(userId, body),
    update: (cardId, body) => api.anki.update(cardId, body),
    remove: async (cardId) => {
      await api.anki.remove(cardId);
    },
    extractFromSession: (sessionId) => api.anki.extractFromSession(sessionId),
    extractFromConversation: (conversationId) =>
      api.anki.extractFromConversation(conversationId),
    markExported: (cardIds) => api.anki.markExported(cardIds),
  },

  pronunciation: {
    eligibility: (projectId) => api.pronunciation.eligibility(projectId),
    phrase: (args) => api.pronunciation.phrase(args),
    judge: (args) => api.pronunciation.judge(args),
  },

  notebooklm: {
    listQuestions: (userId, filters) =>
      api.notebooklm.listQuestions(userId, filters),
    createQuestion: (userId, body) =>
      api.notebooklm.createQuestion(userId, body),
    updateQuestion: (questionId, body) =>
      api.notebooklm.updateQuestion(questionId, body),
    deleteQuestion: async (questionId) => {
      await api.notebooklm.deleteQuestion(questionId);
    },
    generateFromSession: (sessionId) =>
      api.notebooklm.generateFromSession(sessionId),
    generateFromProject: (projectId) =>
      api.notebooklm.generateFromProject(projectId),
    studyGuide: (projectId) => api.notebooklm.studyGuide(projectId),
  },

  // --- LessonProgress (Phase 44 / EXP-002 / P-109) -------------------

  lessonProgress: {
    list: (userId) => api.lessonProgress.list(userId),
    get: (userId, source, setId, filename) =>
      api.lessonProgress.get(userId, source, setId, filename),
    upsert: async (userId, body) => {
      try {
        return await api.lessonProgress.upsert(userId, body);
      } catch (err) {
        // S3 — if the upsert failed because we're offline, queue the
        // POST so the progress isn't lost; it replays on reconnect.
        // Re-throw either way so the caller's existing handling is
        // unchanged (zero behaviour regression; this only ADDS the
        // eventual sync). Online failures (5xx/4xx) are NOT queued.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueRequest(
            `/users/${encodeURIComponent(userId)}/lesson-progress`,
            "POST",
            body,
          );
        }
        throw err;
      }
    },
  },

  // --- Element Errors (Phase 46B / EXP-007 / P-129) ---------------------

  elementErrors: {
    list: (userId, opts) => api.elementErrors.list(userId, opts),
    recordBulk: (userId, attempts) =>
      api.elementErrors.recordBulk(userId, attempts),
    startRun: (userId, setId, opts) => api.elementErrors.startRun(userId, setId, opts),
    listRuns: (userId, setId) => api.elementErrors.listRuns(userId, setId),
    reviewQueue: (userId, opts) => api.elementErrors.reviewQueue(userId, opts),
    remapKeys: (userId, remaps) => api.elementErrors.remap(userId, remaps),
    remapExerciseIds: (userId, remaps) =>
      api.elementErrors.remapExerciseIds(userId, remaps),
    archiveRetired: (userId, setId, retiredIds) =>
      api.elementErrors.archiveRetired(userId, setId, retiredIds),
  },

  // --- Learner-data maintenance (#1445 / #1821) ------------------------
  learningData: {
    deleteLearningData: async (userId, deletion) => {
      const result = await api.learningData.delete(userId, {
        lesson_progress_ids: deletion.lessonProgressIds,
        set_ids: deletion.setIds,
        lesson_cards: deletion.lessonCards?.map((card) => ({
          set_id: card.set_id,
          lesson_id: card.lesson_id,
        })),
      });
      return {
        lessonsDeleted: result.lessons_deleted,
        cardsDeleted: result.cards_deleted,
      };
    },
  },

  // --- Daily missions (EXP-010 / Phase 56) -----------------------------
  missions: {
    getDaily: async (userId, opts) => {
      const wire = await api.missions.getDaily(userId, opts);
      return {
        missions: wire.missions,
        newlyCompleted: wire.newly_completed,
      };
    },
    regenerate: async (userId, opts) => {
      const wire = await api.missions.regenerate(userId, opts);
      return {
        missions: wire.missions,
        newlyCompleted: wire.newly_completed,
      };
    },
  },

  // --- Content-Loader (Phase 43 / EXP-002) -----------------------------

  contentLoader: {
    listSets: () => api.contentLoader.listSets(),
    downloadSet: (source, setId) =>
      api.contentLoader.downloadSet(source, setId),
    // #2212 — order by the user's chosen display order so open/next-lesson
    // follow it, not just the "Manage lessons" list (no-op if never reordered).
    listLessons: async (source, setId) =>
      applyStoredLessonOrderToList(
        await api.contentLoader.listLessons(source, setId),
      ),
    getLesson: (source, setId, filename) =>
      api.contentLoader.getLesson(source, setId, filename),
    /** Phase 54 / v1.37.0 — fetch one cached asset.
     *  Delegates to ``api.contentLoader.getAsset`` which
     *  hits the backend proxy endpoint (54F). Returns null
     *  on 404 so the resolver can fall through to a
     *  placeholder SVG / text-only display. */
    getAsset: (source, setId, assetPath) =>
      api.contentLoader.getAsset(source, setId, assetPath),
    /** Phase 59B / v1.42.0 — persist a user-generated set into
     *  the backend filesystem cache (same place as downloaded
     *  sets). */
    saveUserSet: async (input) => {
      const entry = await api.contentLoader.saveUserSet(input);
      // #2173 — seed the display-order overlay with the source/authoring order
      // (the user's later reorder wins; this is a no-op then).
      recordSavedSetOrder(input.set_id, input.lessons);
      return entry;
    },
    deleteSet: (source, setId) => api.contentLoader.deleteSet(source, setId),
    /** #1351 — no batch endpoint; delete sequentially. Set lifecycle
     *  status is a per-device UI decision persisted browser-side in
     *  ``lib/content/browse/set-status-store`` (not a storage concern in
     *  either mode). */
    deleteSets: async (refs) => {
      for (const { source, setId } of refs) {
        await api.contentLoader.deleteSet(source, setId);
      }
    },
    /** Phase 60 / v1.44.0 — opt-in AI content review (backend
     *  resolves the AI key server-side). */
    aiValidate: (input) => api.contentLoader.aiValidate(input),
    /** EXP-033 / AIV-02 — the set-wide per-card check runs client-side
     *  (browser-direct provider call) and EXP-033 ships no server route,
     *  so it is unavailable in API mode. The UI gates the trigger to
     *  Dexie mode; this throw is the defensive backstop. */
    aiValidateCards: () =>
      Promise.reject(
        new Error(
          "AI content check is only available in browser-storage (Dexie) mode.",
        ),
      ),
    /** EXP-033 / AIV-04 — the report cache is client-side (IndexedDB);
     *  API mode has no cached reports (the check never runs there). */
    getAiValidationCache: () => Promise.resolve(null),
    saveAiValidationCache: () => Promise.resolve(),
  },

  // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
  // per-plugin settings round-trip. ApiStorage is a thin
  // pass-through to the existing
  // ``api.pluginSettings.{get,update}`` helpers (v1.26.0 /
  // Phase 42). DexieStorage's parallel implementation does
  // the YAML-defaults fallback locally.
  pluginSettings: {
    get: (pluginName) => api.pluginSettings.get(pluginName),
    update: (pluginName, body) => api.pluginSettings.update(pluginName, body),
  },

  // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
  // Learning Repository render + ZIP. ApiStorage delegates
  // to the existing backend endpoints; DexieStorage runs
  // the TS renderer client-side. The ``persist`` endpoint
  // stays on ``api.learningRepo.persist`` (server-only;
  // needs filesystem + git binary), so it is intentionally
  // NOT in the namespace.
  learningRepo: {
    render: (projectId, language) =>
      api.learningRepo.render(projectId, language),
    exportZip: (projectId, language) =>
      api.learningRepo.exportZip(projectId, language),
  },

  // GitHub community-PR automation. The token stays server-side
  // (secrets.yaml); the backend proxy runs the fork -> branch ->
  // commit -> PR flow so the browser never holds the PAT in API mode.
  github: {
    getStatus: () => api.github.getStatus(),
    setToken: (token) => api.github.setToken(token),
    clearToken: () => api.github.clearToken(),
    verifyToken: async (token) => {
      const wire = await api.github.verifyToken(token);
      return {
        valid: wire.valid,
        username: wire.username,
        kind: wire.kind as GitHubVerifyKind,
      };
    },
    createLessonPr: async (args) => {
      const wire = await api.github.createPr({
        upstream: args.upstream,
        base_branch: args.baseBranch,
        branch_name: args.branchName,
        file_path: args.filePath,
        file_content: args.fileContent,
        commit_message: args.commitMessage,
        pr_title: args.prTitle,
        pr_body: args.prBody,
        manifest_update: args.manifestUpdate
          ? {
              set_path: args.manifestUpdate.setPath,
              lesson_filename: args.manifestUpdate.lessonFilename,
            }
          : null,
      });
      return {
        url: wire.url,
        number: wire.number,
        manifestUpdated: wire.manifest_updated,
      };
    },
    // #1017 — server-mode export (token lives server-side) needs a backend
    // push endpoint; tracked as a follow-up. Browser (Dexie) mode has the
    // full export today. Fail with a clear, friendly message until then.
    exportSetToRepo: async () => {
      throw new ApiError(
        501,
        "Exporting a set to a GitHub repository is currently available in browser (Dexie) mode.",
      );
    },
    // Registering a repo needs the browser-direct fork -> commit -> PR flow;
    // the server-mode (token server-side) path is a follow-up. Fall back to
    // the manual copy-JSON + edit-link flow the UI offers everywhere.
    createRegistryPr: async () => {
      throw new ApiError(
        501,
        "Submitting a repository to the directory is currently available in browser (Dexie) mode. Use the copy-and-propose flow instead.",
      );
    },
  },

  // Phase 41F Danger Zone: typed-confirm reset. ApiStorage hands
  // the token straight to the backend; the 400 gate lives server-
  // side (services/reset_service.CONFIRMATION_TOKEN).
  reset: (confirmation) => api.reset(confirmation),
};
