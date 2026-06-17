/**
 * Tests for the selective data export (#544).
 */

import { describe, expect, it } from "vitest";

import type { BackupPayload } from "../../types/domain";
import {
  ALWAYS_INCLUDED_TABLES,
  allCategoryIds,
  categoryById,
  EXPORT_GROUPS,
  filterBackupPayload,
  resolveSelectedTables,
  selectiveExportFilename,
} from "./selective-export";

/** The 30 backup tables (mirrors storage/backup.ts BACKUP_TABLES). */
const KNOWN_TABLES = new Set([
  "users",
  "user_settings",
  "learning_projects",
  "learning_profiles",
  "curriculums",
  "learning_topics",
  "lessons",
  "learning_sessions",
  "session_messages",
  "session_ratings",
  "session_notes",
  "progress_commits",
  "method_switches",
  "step_evaluations",
  "imported_conversations",
  "imported_messages",
  "subjects",
  "tags",
  "project_subjects",
  "project_tags",
  "user_xp",
  "badges",
  "user_badges",
  "anki_card_suggestions",
  "study_questions",
  "user_streaks",
  "lesson_progress",
  "element_errors",
  "user_missions",
  "api_key_backups",
]);

function fullPayload(): BackupPayload {
  const tables = [...KNOWN_TABLES];
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of tables) data[t] = [{ id: `${t}-1` }];
  return {
    format: "adaptive-learner-backup",
    version: "1.3.0",
    created_at: "2026-06-15T00:00:00Z",
    user_id: "u1",
    storage_mode: "dexie",
    data,
    content_sets: [{ source: "x", id: "y" } as never],
    stats: { total_records: tables.length, tables: {}, content_sets: 1 },
  };
}

describe("selective-export category model", () => {
  it("references only real backup tables", () => {
    for (const group of EXPORT_GROUPS) {
      for (const cat of group.categories) {
        for (const table of cat.tables) {
          expect(KNOWN_TABLES.has(table), `${cat.id} -> ${table}`).toBe(true);
        }
        // includes is a subset of tables.
        for (const dep of cat.includes) expect(cat.tables).toContain(dep);
      }
    }
  });

  it("has unique category ids", () => {
    const ids = allCategoryIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks up categories by id", () => {
    expect(categoryById("projects")?.tables).toContain("learning_projects");
    expect(categoryById("nope")).toBeUndefined();
  });
});

describe("resolveSelectedTables", () => {
  it("always includes the owner users row", () => {
    expect(resolveSelectedTables([])).toEqual(new Set(ALWAYS_INCLUDED_TABLES));
  });

  it("unions a category's tables (with auto-included deps)", () => {
    const tables = resolveSelectedTables(["curricula"]);
    expect(tables.has("curriculums")).toBe(true);
    expect(tables.has("learning_topics")).toBe(true);
    expect(tables.has("lessons")).toBe(true);
    expect(tables.has("users")).toBe(true);
  });

  it("merges multiple categories", () => {
    const tables = resolveSelectedTables(["subjects", "tags"]);
    expect([...tables].sort()).toEqual(["subjects", "tags", "users"]);
  });
});

describe("filterBackupPayload", () => {
  it("keeps only the selected tables and recomputes stats", () => {
    const tables = resolveSelectedTables(["subjects"]);
    const out = filterBackupPayload(fullPayload(), tables);
    expect(Object.keys(out.data).sort()).toEqual(["subjects", "users"]);
    expect(out.stats.total_records).toBe(2);
    expect(out.stats.tables).toEqual({ users: 1, subjects: 1 });
  });

  it("drops downloaded content sets (re-downloadable, not user data)", () => {
    const out = filterBackupPayload(fullPayload(), resolveSelectedTables(["tags"]));
    expect(out.content_sets).toBeUndefined();
    expect(out.stats.content_sets).toBe(0);
  });

  it("preserves the importable envelope (format/version/user)", () => {
    const out = filterBackupPayload(fullPayload(), resolveSelectedTables([]));
    expect(out.format).toBe("adaptive-learner-backup");
    expect(out.version).toBe("1.3.0");
    expect(out.user_id).toBe("u1");
  });

  it("a full selection reproduces every table", () => {
    const out = filterBackupPayload(fullPayload(), resolveSelectedTables(allCategoryIds()));
    expect(new Set(Object.keys(out.data))).toEqual(KNOWN_TABLES);
  });
});

describe("selectiveExportFilename", () => {
  it("formats the date", () => {
    expect(selectiveExportFilename(new Date("2026-06-15T12:00:00Z"))).toBe(
      "adaptive-learner-export-2026-06-15.alb",
    );
  });
});
