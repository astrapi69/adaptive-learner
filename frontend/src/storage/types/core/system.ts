/**
 * System / backup / export / taxonomy namespaces.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  SubjectCreateBody,
  SubjectUpdateBody,
  TagCreateBody,
  TagUpdateBody,
} from "../../../api/request-types";
import type {
  BackupPayload,
  BackupStats,
  RestoreSummary,
  Subject,
  SystemInfo,
  Tag,
} from "../../../types/domain";

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
  progress(userId: string, lang: string): Promise<import("../../backup/export-types").ProgressReport>;
  session(sessionId: string, lang: string): Promise<import("../../backup/export-types").SessionDetail>;
  curriculum(
    curriculumId: string,
    lang: string,
  ): Promise<import("../../backup/export-types").CurriculumOverview>;
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
