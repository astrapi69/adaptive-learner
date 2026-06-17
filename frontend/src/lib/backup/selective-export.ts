/**
 * Selective data export (#544).
 *
 * Lets a learner export a SUBSET of their backup — picking which data
 * categories to include — in the exact same importable archive format
 * the full backup uses, so the existing restore reads it unchanged (the
 * restore tolerates absent tables non-destructively).
 *
 * Pure + storage-agnostic: it operates on a {@link BackupPayload} that
 * the caller already fetched via ``storage.backup.export(userId)`` and
 * trims its ``data`` map to the selected tables. The category model maps
 * the 30 backup tables onto user-facing groups, auto-including the
 * dependent child tables of a chosen category (e.g. picking
 * "Lernprojekte" carries its sessions / ratings / notes).
 */

import type { BackupPayload } from "../../types/domain";

/** A user-selectable export category over one or more backup tables. */
export interface ExportCategory {
  /** Stable id (checkbox key, testid). */
  id: string;
  /** i18n key for the label. */
  labelKey: string;
  /** Fallback label (English). */
  labelFallback: string;
  /** Tables exported when this category is selected (primary + deps). */
  tables: readonly string[];
  /** The auto-included dependency tables — a subset of ``tables`` shown
   *  as a "exported automatically" hint. Empty when the category is a
   *  single self-contained table. */
  includes: readonly string[];
}

/** A heading group of related categories (Inhalte / Stammdaten / …). */
export interface ExportGroup {
  id: string;
  labelKey: string;
  labelFallback: string;
  categories: readonly ExportCategory[];
}

/** The owner ``users`` row always travels so a subset is self-contained. */
export const ALWAYS_INCLUDED_TABLES: readonly string[] = ["users"];

/**
 * The export categories, grouped for the Settings UI. The table names
 * mirror ``storage/backup.ts`` ``BACKUP_TABLES`` (pinned by a test).
 */
export const EXPORT_GROUPS: readonly ExportGroup[] = [
  {
    id: "content",
    labelKey: "data_export.group_content",
    labelFallback: "Content",
    categories: [
      {
        id: "projects",
        labelKey: "data_export.cat_projects",
        labelFallback: "Learning projects (with sessions, ratings, notes)",
        tables: [
          "learning_projects",
          "learning_profiles",
          "learning_sessions",
          "session_messages",
          "session_ratings",
          "session_notes",
          "progress_commits",
          "method_switches",
          "step_evaluations",
          "project_subjects",
          "project_tags",
        ],
        includes: [
          "learning_profiles",
          "learning_sessions",
          "session_messages",
          "session_ratings",
          "session_notes",
          "progress_commits",
          "method_switches",
          "step_evaluations",
          "project_subjects",
          "project_tags",
        ],
      },
      {
        id: "curricula",
        labelKey: "data_export.cat_curricula",
        labelFallback: "Curricula (with topics and lessons)",
        tables: ["curriculums", "learning_topics", "lessons"],
        includes: ["learning_topics", "lessons"],
      },
      {
        id: "progress",
        labelKey: "data_export.cat_progress",
        labelFallback: "Lesson progress (with mistakes / SRS)",
        tables: ["lesson_progress", "element_errors"],
        includes: ["element_errors"],
      },
    ],
  },
  {
    id: "master",
    labelKey: "data_export.group_master",
    labelFallback: "Master data",
    categories: [
      {
        id: "subjects",
        labelKey: "data_export.cat_subjects",
        labelFallback: "Subjects",
        tables: ["subjects"],
        includes: [],
      },
      {
        id: "tags",
        labelKey: "data_export.cat_tags",
        labelFallback: "Tags",
        tables: ["tags"],
        includes: [],
      },
    ],
  },
  {
    id: "extra",
    labelKey: "data_export.group_extra",
    labelFallback: "Extra data",
    categories: [
      {
        id: "imports",
        labelKey: "data_export.cat_imports",
        labelFallback: "Chat imports (with messages)",
        tables: ["imported_conversations", "imported_messages"],
        includes: ["imported_messages"],
      },
      {
        id: "anki",
        labelKey: "data_export.cat_anki",
        labelFallback: "Anki cards",
        tables: ["anki_card_suggestions"],
        includes: [],
      },
      {
        id: "questions",
        labelKey: "data_export.cat_questions",
        labelFallback: "Study questions",
        tables: ["study_questions"],
        includes: [],
      },
    ],
  },
  {
    id: "gamification",
    labelKey: "data_export.group_gamification",
    labelFallback: "Gamification",
    categories: [
      {
        id: "gamification",
        labelKey: "data_export.cat_gamification",
        labelFallback: "XP, badges, streak, missions",
        tables: ["user_xp", "badges", "user_badges", "user_streaks", "user_missions"],
        includes: [],
      },
    ],
  },
  {
    id: "config",
    labelKey: "data_export.group_config",
    labelFallback: "Configuration",
    categories: [
      {
        id: "settings",
        labelKey: "data_export.cat_settings",
        labelFallback: "Settings",
        tables: ["user_settings"],
        includes: [],
      },
      {
        id: "ai_config",
        labelKey: "data_export.cat_ai_config",
        labelFallback: "AI key backup",
        tables: ["api_key_backups"],
        includes: [],
      },
    ],
  },
];

/** Every selectable category id, flattened. */
export function allCategoryIds(): string[] {
  return EXPORT_GROUPS.flatMap((g) => g.categories.map((c) => c.id));
}

/** Look up a category by id (or undefined). */
export function categoryById(id: string): ExportCategory | undefined {
  for (const group of EXPORT_GROUPS) {
    const found = group.categories.find((c) => c.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * The set of backup tables produced by a selection — the union of each
 * selected category's tables plus the always-included owner row.
 */
export function resolveSelectedTables(selectedIds: Iterable<string>): Set<string> {
  const tables = new Set<string>(ALWAYS_INCLUDED_TABLES);
  for (const id of selectedIds) {
    const cat = categoryById(id);
    if (cat) for (const table of cat.tables) tables.add(table);
  }
  return tables;
}

/**
 * Trim a full {@link BackupPayload} to the selected tables, recomputing
 * the stats. Downloaded content sets are dropped (re-downloadable, not
 * user data). The result is a valid, importable backup subset.
 *
 * @param full a complete backup payload (from ``storage.backup.export``).
 * @param tables the table names to keep (see {@link resolveSelectedTables}).
 */
export function filterBackupPayload(
  full: BackupPayload,
  tables: Set<string>,
): BackupPayload {
  const data: Record<string, Record<string, unknown>[]> = {};
  const tableCounts: Record<string, number> = {};
  let total = 0;
  for (const [name, rows] of Object.entries(full.data)) {
    if (!tables.has(name)) continue;
    data[name] = rows;
    tableCounts[name] = rows.length;
    total += rows.length;
  }
  return {
    ...full,
    data,
    content_sets: undefined,
    stats: { total_records: total, tables: tableCounts, content_sets: 0 },
  };
}

/** Filename for a selective export, e.g. ``adaptive-learner-export-2026-06-15.alb``. */
export function selectiveExportFilename(now: Date = new Date()): string {
  return `adaptive-learner-export-${now.toISOString().slice(0, 10)}.alb`;
}
