/**
 * Dexie-mode system / i18n / reset namespaces (#1786 — extracted from
 * dexie-storage.ts). The system/maintenance concern: About-tab info
 * synthesis, the bundled i18n catalogs, and the Danger-Zone reset.
 */

import { ApiError } from "../../api/client";
import { getDb } from "./db";
import { clearAllAutoBackups } from "../backup/auto-backup";
import type { IStorageService } from "../types";

export const dexieI18n: IStorageService["i18n"] = {
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
      "../../data/i18n/*.json",
      { import: "default" },
    );
    const loader =
      catalogs[`../../data/i18n/${lang}.json`] ??
      catalogs["../../data/i18n/en.json"];
    return loader ? await loader() : {};
  },
};

export const dexieSystem: IStorageService["system"] = {
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
};

/**
 * Phase 41F Danger Zone: typed-confirm reset for Dexie mode.
 * Clears every table on the main Dexie DB plus the separate
 * auto-backup ring (kept in its own Dexie database by
 * auto-backup.ts). The confirmation gate matches the backend
 * server-side check (CONFIRMATION_TOKEN === "RESET"), enforced
 * here so the UI's typed-confirm pattern behaves identically
 * across modes; reject with ApiError(400) for parity with the
 * API-mode 400 response.
 */
export const dexieReset: IStorageService["reset"] = async (confirmation) => {
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
};
