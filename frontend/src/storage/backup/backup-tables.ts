/**
 * Backup table specs + restore order (#1806 — extracted from backup.ts).
 *
 * The declarative half of the Dexie backup: which tables travel in a
 * backup, how each is user-scoped, whether it restores append-only or
 * newer-side-wins, and the parent-before-child restore order. Mirrors
 * the backend's ``backup_service.py`` / ``sync_service.TABLES``
 * one-for-one so the same JSON file works in both directions.
 */

import type {AdaptiveLearnerDB} from "../dexie/db";

export const BACKUP_FORMAT = "adaptive-learner-backup" as const;
// 1.5.0 — EXP-051 / #2125: the ``set_runs`` table + ``run_id`` on
// ``element_errors`` ride the backup. Backward-compatible: a pre-1.5.0
// backup lacks ``set_runs`` and its element-error rows have no ``run_id``
// (they import as the implicit run 1, materialised lazily on first
// read/write). 1.4.0 added the optional ``local_storage`` snapshot block.
export const BACKUP_VERSION = "1.5.0";

export const EXCLUDED_USER_SETTINGS_FIELDS: ReadonlySet<string> = new Set([
    "api_key_anthropic",
    "api_key_openai",
    "api_key_gemini",
]);

/**
 * Backup-table descriptor. ``store`` is the Dexie table name;
 * ``filter`` says how to scope by user. ``append_only`` flips the
 * restore behaviour (skip duplicates vs newer-side-wins).
 */
export interface BackupTableSpec {
    store: keyof AdaptiveLearnerDB & string;
    timestampField: string;
    appendOnly: boolean;
    scope:
        | "self" // the row IS the user (users table)
        | "user" // row.user_id == userId
        | "via_curriculum" // row.curriculum_id IN curriculums of user
        | "via_project" // row.project_id IN projects of user
        | "via_session" // row.session_id IN sessions of user
        | "via_conversation" // row.conversation_id IN conversations of user
        | "global"; // row is shared across users (subjects taxonomy)
}

export const BACKUP_TABLES: Record<string, BackupTableSpec> = {
    users: {
        store: "users",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "self",
    },
    user_settings: {
        store: "userSettings",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    learning_projects: {
        store: "learningProjects",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    learning_profiles: {
        store: "learningProfiles",
        timestampField: "assessed_at",
        appendOnly: false,
        scope: "user",
    },
    curriculums: {
        store: "curricula",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    learning_topics: {
        store: "learningTopics",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "via_curriculum",
    },
    lessons: {
        store: "lessons",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "via_curriculum",
    },
    learning_sessions: {
        store: "learningSessions",
        timestampField: "started_at",
        appendOnly: true,
        scope: "via_project",
    },
    session_messages: {
        store: "sessionMessages",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_session",
    },
    session_ratings: {
        store: "sessionRatings",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_session",
    },
    session_notes: {
        store: "sessionNotes",
        // v1.8.0 / Phase 21B — session_notes is now mutable.
        // Backup-side timestampField stays at ``created_at`` for
        // chronological ordering of the dump; the sync surface
        // uses ``updated_at`` for conflict resolution
        // independently of backup.
        timestampField: "created_at",
        appendOnly: false,
        scope: "via_session",
    },
    progress_commits: {
        store: "progressCommits",
        timestampField: "committed_at",
        appendOnly: true,
        scope: "via_project",
    },
    method_switches: {
        store: "methodSwitches",
        timestampField: "switched_at",
        appendOnly: true,
        scope: "via_project",
    },
    step_evaluations: {
        store: "stepEvaluations",
        // Renamed v1.8.0 / Phase 21A to match the backend column.
        timestampField: "evaluated_at",
        appendOnly: true,
        scope: "via_session",
    },
    imported_conversations: {
        store: "importedConversations",
        timestampField: "imported_at",
        appendOnly: true,
        scope: "user",
    },
    imported_messages: {
        store: "importedMessages",
        timestampField: "timestamp",
        appendOnly: true,
        scope: "via_conversation",
    },
    // v1.9.0 / Phase 22A — taxonomy. Subjects are GLOBAL (the
    // entire taxonomy travels with the backup so a restore on
    // another device preserves the tree). Tags + project_*
    // associations are user-scoped through the existing helpers.
    subjects: {
        store: "subjects",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "global",
    },
    tags: {
        store: "tags",
        timestampField: "created_at",
        appendOnly: false,
        scope: "user",
    },
    project_subjects: {
        store: "projectSubjects",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_project",
    },
    project_tags: {
        store: "projectTags",
        timestampField: "created_at",
        appendOnly: true,
        scope: "via_project",
    },
    // BACKUP-DIR-EXPORT-01 — bring the Dexie backup up to parity
    // with the backend sync surface (``sync_service.TABLES``).
    // Before this, a Dexie-mode (GitHub Pages) export silently
    // dropped EVERY gamification / progress / SRS / missions row:
    // a backup looked complete but lost the user's actual learning
    // state. These mirror the backend specs one-for-one (all
    // ``scope="direct"`` -> Dexie ``"user"``, mutable, ``updated_at``;
    // ``badges`` is the GLOBAL catalog like ``subjects``).
    user_xp: {
        store: "userXp",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    badges: {
        store: "badges",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "global",
    },
    user_badges: {
        store: "userBadges",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    anki_card_suggestions: {
        store: "ankiCards",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    study_questions: {
        store: "studyQuestions",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    user_streaks: {
        store: "userStreaks",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    lesson_progress: {
        store: "lessonProgress",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    element_errors: {
        store: "elementErrors",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    user_missions: {
        store: "userMissions",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    // EXP-051 / #2125 — Durchgang (run/pass) bookkeeping. Mutable
    // (``closed_at`` stamped on the run close); direct user scope. Rides the
    // backup so a learner's runs survive Export -> wipe -> Import.
    set_runs: {
        store: "setRuns",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
    // Phase 65 — API-key rollback cache. Carries Fernet ciphertext
    // (same scheme as ``UserSettings.api_key_*``). The backend syncs
    // and backs this up, so we mirror it for a "same file both
    // directions" guarantee. Unlike the plaintext ``api_key_*``
    // fields, the ciphertext is keyed to the install's secret and
    // is useless without it, so it is NOT stripped on export.
    api_key_backups: {
        store: "apiKeyBackups",
        timestampField: "updated_at",
        appendOnly: false,
        scope: "user",
    },
};

/**
 * Order matters for restore: parents before children. Mutable
 * parents first, then the append-only history, then imports.
 */
export const RESTORE_ORDER: readonly string[] = [
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
    // v1.9.0 / Phase 22A — Subjects + Tags taxonomy. Subjects
    // before tags (no dependency); both before the M:N rows
    // that point at them.
    "subjects",
    "tags",
    "project_subjects",
    "project_tags",
    // BACKUP-DIR-EXPORT-01 — gamification / progress / SRS /
    // missions. ``badges`` (the catalog) before ``user_badges``
    // (which references a badge id); the rest are direct user-scope
    // rows with no cross-table FK inside the backup set.
    "user_xp",
    "badges",
    "user_badges",
    "anki_card_suggestions",
    "study_questions",
    "user_streaks",
    "lesson_progress",
    "element_errors",
    "user_missions",
    // EXP-051 / #2125 — direct user-scope, no cross-table FK in the backup set.
    "set_runs",
    "api_key_backups",
];
