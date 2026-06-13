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
 */


import {
  createAnkiCard,
  deleteAnkiCard,
  extractFromConversationDexie,
  extractFromSessionDexie,
  listAnkiCards,
  markAnkiCardsExported,
  updateAnkiCard,
} from "./anki";
import { evaluateBadgesForUser } from "./badges";
import {
  getDailyMissionsDexie,
  regenerateDailyMissionsDexie,
} from "./missions-dexie";
import {
  getDb,
  nowIso,
  type SubjectRow,
} from "./db";
import {
  clearAllAutoBackups,
} from "./auto-backup";
import {
  createDexieBackup,
  getDexieBackupStats,
  restoreDexieBackup,
} from "./backup";
import {
  buildCurriculumOverview as dexieBuildCurriculumOverview,
  buildProgressReport as dexieBuildProgressReport,
  buildSessionDetail as dexieBuildSessionDetail,
} from "./export-builder";
import {
  createStudyQuestion,
  deleteStudyQuestion,
  generateFromProjectDexie,
  generateFromSessionDexie,
  listStudyQuestions,
  studyGuideDexie,
  updateStudyQuestion,
} from "./notebooklm";
import { ApiError } from "../api/client";
import {
  aiValidateDexie,
  deleteSetDexie,
  activeSourcesDexie,
  downloadSetDexie,
  getAssetDexie,
  getLessonDexie,
  listLessonsDexie,
  listSetsDexie,
  saveUserSetDexie,
} from "./content-loader-dexie";
import {
  getLessonProgressDexie,
  listLessonProgressDexie,
  upsertLessonProgressDexie,
} from "./lesson-progress-dexie";
import { awardLessonXpDexie } from "./lesson-xp-dexie";
import {
  computeReviewQueueDexie,
  listElementErrorsDexie,
  recordElementAttemptsDexie,
} from "./element-errors-dexie";
import type {
  IStorageService,
} from "./types";
import { dexieGamification } from "./dexie-gamification";
import { dexieCurricula, dexieLessons, dexieTopics } from "./dexie-curricula";
import { dexieAssessment, dexieSession, dexieTools, dexieTracking } from "./dexie-session";
import { dexieSettings } from "./dexie-settings";
import { dexieProjectTaxonomy, dexieSubjects, dexieTags } from "./dexie-taxonomy";
import { dexieProjects, dexieUsers } from "./dexie-users";
import { dexieImports } from "./dexie-imports";

// Row <-> wire mappers + requireRow/ensureSettings live in
// ./dexie-rows (#354), shared with the per-domain namespace modules.

// ---- Storage object ---------------------------------------------------

/** localStorage key holding the GitHub PAT in Dexie (GH-Pages) mode. */
const GITHUB_TOKEN_KEY = "adaptive-learner.github_token";

/** Read the stored GitHub token (empty string when none / no storage). */
function readGitHubToken(): string {
  try {
    return localStorage.getItem(GITHUB_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Store (or clear, when blank) the GitHub token. */
function writeGitHubToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) localStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
    else localStorage.removeItem(GITHUB_TOKEN_KEY);
  } catch {
    /* storage unavailable — best effort */
  }
}

export const dexieStorage: IStorageService = {
  mode: "dexie",

  health: async () => ({
    status: "ok",
    version: "dexie-local",
    debug: false,
  }),

  i18n: {
    /**
     * Dexie mode has no backend, so the bundled JSON
     * catalogs under ``frontend/src/data/i18n/`` are the
     * source of truth at runtime. Mirrors what the backend's
     * ``GET /api/i18n/{lang}`` returns in API mode.
     *
     * The JSON files are regenerated from
     * ``backend/config/i18n/*.yaml`` via
     * ``scripts/sync_i18n_to_frontend.py`` — a Vitest pin
     * (``i18n-sync.test.ts``) catches drift.
     */
    get: async (lang: string) => {
      // Lazy (non-eager) glob: each language catalog is its own
      // chunk, fetched on demand. Eager loading inlined all 8
      // catalogs (~215 KB gzip) into the main bundle on every page
      // load — see docs/audits/performance-audit-2026-06-03.md F-1.
      const catalogs = import.meta.glob<Record<string, unknown>>(
        "../data/i18n/*.json",
        { import: "default" },
      );
      const loader =
        catalogs[`../data/i18n/${lang}.json`] ??
        catalogs["../data/i18n/en.json"];
      return loader ? await loader() : {};
    },
  },

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

  system: {
    async info() {
      // In Dexie mode there is no backend to query. We
      // synthesise the same SystemInfo shape so the About
      // tab renders without conditional branches; fields
      // we can't know browser-side (Python version, backend
      // dep versions, server-side build hash) come through
      // as ``null`` / ``"unknown"`` and the UI hides the
      // matching rows.
      return {
        app: {
          name: "Adaptive Learner",
          version: __APP_VERSION__,
          license: "MIT",
          authors: ["Asterios Raptis"],
          repository_url: "https://github.com/astrapi69/adaptive-learner",
          issues_url: "https://github.com/astrapi69/adaptive-learner/issues",
          docs_url: "https://astrapi69.github.io/adaptive-learner/docs/",
          build_hash: __BUILD_HASH__,
          build_date: __BUILD_DATE__,
        },
        runtime: {
          python_version: null,
          platform_system:
            typeof navigator !== "undefined"
              ? navigator.platform || "browser"
              : "browser",
          platform_release:
            typeof navigator !== "undefined"
              ? navigator.userAgent.slice(0, 80)
              : "",
          platform_machine: "",
        },
        dependencies: {
          fastapi: null,
          sqlalchemy: null,
          pydantic: null,
          pluginforge: null,
        },
        paths: {
          database_path: "Local Browser Storage (IndexedDB)",
          data_directory: "Local Browser Storage (IndexedDB)",
        },
      };
    },
  },

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

  // ---- Taxonomy: Subjects + Tags (v1.9.0 / Phase 22) -------------------




  gamification: dexieGamification,

  notebooklm: {
    listQuestions: (userId, filters) => listStudyQuestions(userId, filters),
    createQuestion: (userId, body) => createStudyQuestion(userId, body),
    updateQuestion: (questionId, body) => updateStudyQuestion(questionId, body),
    deleteQuestion: (questionId) => deleteStudyQuestion(questionId),
    generateFromSession: () => generateFromSessionDexie(),
    generateFromProject: () => generateFromProjectDexie(),
    studyGuide: () => studyGuideDexie(),
  },

  pronunciation: {
    async eligibility(projectId) {
      // Walk the project's subjects + every parent chain
      // looking for a "Languages" (or "Sprachen") node.
      const db = getDb();
      const assocs = await db.projectSubjects
        .where({ project_id: projectId })
        .toArray();
      if (assocs.length === 0) return { eligible: false };
      const visited = new Set<string>();
      for (const a of assocs) {
        let cursor: string | null = a.subject_id;
        while (cursor !== null && !visited.has(cursor)) {
          visited.add(cursor);
          const subj: SubjectRow | undefined = await db.subjects.get(cursor);
          if (!subj) break;
          if (
            subj.name.toLowerCase() === "languages" ||
            subj.name.toLowerCase() === "sprachen"
          ) {
            return { eligible: true };
          }
          cursor = subj.parent_id;
        }
      }
      return { eligible: false };
    },
    phrase: async () => {
      throw new ApiError(
        501,
        "Pronunciation practice requires API mode for the AI calls. " +
          "Switch to API mode in Settings.",
      );
    },
    judge: async () => {
      throw new ApiError(
        501,
        "Pronunciation practice requires API mode for the AI calls. " +
          "Switch to API mode in Settings.",
      );
    },
  },

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
    downloadSet: async (source, setId) =>
      downloadSetDexie(source, setId, await activeSourcesDexie()),
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
    aiValidate: (input) => aiValidateDexie(input),
  },

  // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
  // Learning Repository render + ZIP in Dexie mode.
  // ``render`` calls the TS renderer (Phase 49B-D) against
  // a context built from the IndexedDB tables; ``exportZip``
  // packs the same rendered tree into a Blob via JSZip
  // (dynamic-imported so the ~190 kB JSZip chunk isn't paid
  // on cold load — same pattern as ``lib/anki/apkg-builder.ts``).
  //
  // The git-persist endpoint is intentionally absent: it
  // needs a server-side filesystem + git binary. The
  // LearningRepo page gates the "Persist to git" button on
  // storage mode and shows a tooltip in Dexie.
  learningRepo: {
    render: async (projectId: string, language?: string) => {
      const renderedAt = nowIso();
      const lang = language ?? "en";
      const { loadDexieContext } =
        await import("../lib/learning-repo/load-context-dexie");
      const { renderRepository } =
        await import("../lib/learning-repo/renderer");
      const ctx = await loadDexieContext(projectId, {
        renderedAt,
      });
      const files = await renderRepository(ctx, lang);
      return {
        project_id: projectId,
        language: lang,
        rendered_at: renderedAt,
        files,
      };
    },
    exportZip: async (projectId: string, language?: string) => {
      const lang = language ?? "en";
      const { loadDexieContext } =
        await import("../lib/learning-repo/load-context-dexie");
      const { renderRepository } =
        await import("../lib/learning-repo/renderer");
      const ctx = await loadDexieContext(projectId);
      const files = await renderRepository(ctx, lang);
      const JSZipMod = (await import("jszip")).default;
      const zip = new JSZipMod();
      for (const [path, content] of Object.entries(files)) {
        zip.file(path, content);
      }
      return zip.generateAsync({ type: "blob" });
    },
  },

  // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
  // per-plugin settings round-trip in Dexie mode. The
  // pluginSettings table is empty on a fresh install; the
  // first ``get(name)`` falls back to the bundled YAML
  // defaults at ``frontend/src/data/plugin-config/{name}.json``
  // (regenerated from ``backend/config/plugins/*.yaml`` via
  // ``scripts/sync_plugin_config_to_frontend.py``). ``update``
  // upserts a row keyed by plugin name. Response shape
  // mirrors the API's ``{plugin, settings}`` payload so
  // consumers don't branch on storage mode.
  pluginSettings: {
    get: async (pluginName: string) => {
      const db = getDb();
      const row = await db.pluginSettings.get(pluginName);
      if (row) {
        return { plugin: pluginName, settings: row.settings };
      }
      // Lazy defaults: pull from the bundled YAML.
      // ``import.meta.glob`` resolves the JSON files at
      // build time so the chunk is available without a
      // dynamic fetch — matches the i18n namespace's
      // pattern.
      const bundles = import.meta.glob<Record<string, unknown>>(
        "../data/plugin-config/*.json",
        { eager: true, import: "default" },
      );
      const path = `../data/plugin-config/${pluginName}.json`;
      const defaults = bundles[path] ?? {};
      return { plugin: pluginName, settings: defaults };
    },
    update: async (
      pluginName: string,
      body: { settings: Record<string, unknown> },
    ) => {
      const db = getDb();
      const ts = nowIso();
      await db.pluginSettings.put({
        name: pluginName,
        settings: body.settings,
        updated_at: ts,
      });
      return { plugin: pluginName, settings: body.settings };
    },
  },

  // GitHub community-PR automation, browser-direct. The PAT lives in
  // localStorage (``GITHUB_TOKEN_KEY``) — a repo-scope PAT is not a
  // billable AI key, so browser storage is acceptable here. The fork
  // -> branch -> commit -> PR flow runs against api.github.com directly
  // (GitHub allows the cross-origin request with the Authorization
  // header). Failures throw ApiError so the friendly-error mapper +
  // ShareWizard classifier handle them identically to API mode.
  github: {
    getStatus: async () => {
      const token = readGitHubToken();
      return {
        configured: token.length > 0,
        source: token.length > 0 ? "browser" : "none",
      };
    },
    setToken: async (token: string) => {
      writeGitHubToken(token);
      return { configured: token.trim().length > 0, source: "browser" };
    },
    clearToken: async () => {
      writeGitHubToken("");
      return { configured: false, source: "none" };
    },
    verifyToken: async (token?: string) => {
      const effective = (token ?? readGitHubToken()).trim();
      const { GitHubApi } = await import("../lib/github/github-api");
      return new GitHubApi(effective).verifyToken();
    },
    createLessonPr: async (args) => {
      const token = readGitHubToken().trim();
      if (!token) {
        throw new ApiError(401, "No GitHub token configured.");
      }
      const { GitHubApi } = await import("../lib/github/github-api");
      return new GitHubApi(token).createLessonPr(args);
    },
  },

  // Phase 41F Danger Zone: typed-confirm reset for Dexie mode.
  // Clears every table on the main Dexie DB plus the separate
  // auto-backup ring (kept in its own Dexie database by
  // auto-backup.ts). The confirmation gate matches the backend
  // server-side check (CONFIRMATION_TOKEN === "RESET"), enforced
  // here so the UI's typed-confirm pattern behaves identically
  // across modes; reject with ApiError(400) for parity with the
  // API-mode 400 response.
  reset: async (confirmation) => {
    if (confirmation !== "RESET") {
      throw new ApiError(400, "Confirmation token mismatch.");
    }
    const db = getDb();
    // Clear every store on the main Dexie DB. Listing them
    // explicitly rather than iterating ``db.tables`` so a
    // future contributor who renames a table sees a clear
    // diff here instead of a silently expanded reset.
    const tableNames = [
      "users",
      "userSettings",
      "learningProjects",
      "learningProfiles",
      "curricula",
      "learningTopics",
      "lessons",
      "learningSessions",
      "sessionMessages",
      "sessionRatings",
      "sessionNotes",
      "progressCommits",
      "methodSwitches",
      "stepEvaluations",
      "importedConversations",
      "importedMessages",
      "subjects",
      "tags",
      "projectSubjects",
      "projectTags",
      "userXP",
      "badges",
      "userBadges",
      "userStreaks",
      "ankiCards",
      "studyQuestions",
      "contentSets",
      "contentSetFiles",
      "lessonProgress",
      "elementErrors",
      // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01)
      "pluginSettings",
    ];
    let cleared = 0;
    for (const name of tableNames) {
      const table = (db as unknown as Record<string, unknown>)[name];
      if (table && typeof table === "object" && "clear" in table) {
        try {
          await (table as { clear(): Promise<void> }).clear();
          cleared += 1;
        } catch (err) {
          console.warn(`Dexie reset: clear(${name}) failed:`, err);
        }
      }
    }
    await clearAllAutoBackups();
    return { reset: true, tables_cleared: cleared };
  },
};
