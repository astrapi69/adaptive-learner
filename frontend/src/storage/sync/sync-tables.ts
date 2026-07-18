/**
 * Sync table metadata (#1795 — extracted from sync-engine.ts).
 *
 * The dependency-ordered sync surface: parent rows ship before
 * children so the receiving side never has a dangling FK. Every
 * entry documents when it joined the surface and why it is
 * MUTABLE vs APPEND-ONLY.
 */

import {getDb} from "../dexie/db";

// ----- Table sync metadata --------------------------------------------

export interface SyncTable {
    name: string;
    dexieTable: keyof ReturnType<typeof getDb>;
    timestampField: string;
    appendOnly: boolean;
}

/**
 * Tables we sync, in dependency order. Parent rows ship before
 * children so the receiving side never has a dangling FK.
 */
export const SYNC_TABLES: SyncTable[] = [
    {name: "users", dexieTable: "users", timestampField: "updated_at", appendOnly: false},
    {
        name: "user_settings",
        dexieTable: "userSettings",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "learning_projects",
        dexieTable: "learningProjects",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "learning_profiles",
        dexieTable: "learningProfiles",
        timestampField: "assessed_at",
        appendOnly: false,
    },
    {name: "curriculums", dexieTable: "curricula", timestampField: "updated_at", appendOnly: false},
    {
        name: "learning_topics",
        dexieTable: "learningTopics",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {name: "lessons", dexieTable: "lessons", timestampField: "updated_at", appendOnly: false},
    // Append-only:
    {
        name: "learning_sessions",
        dexieTable: "learningSessions",
        timestampField: "started_at",
        appendOnly: true,
    },
    {
        name: "session_messages",
        dexieTable: "sessionMessages",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        name: "session_ratings",
        dexieTable: "sessionRatings",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21B — promoted to MUTABLE. Notes are
        // user-editable in the UI; the conflict-resolution
        // pipeline picks a winner by ``updated_at``. The
        // backend Alembic migration 0006 + the Dexie v4 schema
        // upgrade back-fill ``updated_at = created_at`` for
        // historical rows.
        name: "session_notes",
        dexieTable: "sessionNotes",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "progress_commits",
        dexieTable: "progressCommits",
        timestampField: "committed_at",
        appendOnly: true,
    },
    {
        name: "method_switches",
        dexieTable: "methodSwitches",
        timestampField: "switched_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21A — aligned with backend column names
        // (``to_step`` + ``evaluated_at``) via the Dexie v3
        // schema upgrade. Append-only: an evaluation row is the
        // verdict at the moment of evaluation; later edits would
        // misrepresent history.
        name: "step_evaluations",
        dexieTable: "stepEvaluations",
        timestampField: "evaluated_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21D — chat-history surface joins sync.
        // APPEND-ONLY: ``analyzed`` + ``analysis_result`` are NOT
        // updated post-sync; each device runs its own analysis
        // (the AI roundtrip is expensive and per-device).
        name: "imported_conversations",
        dexieTable: "importedConversations",
        timestampField: "imported_at",
        appendOnly: true,
    },
    {
        // v1.8.0 / Phase 21D — paired with imported_conversations.
        // ``created_at`` added via Dexie v5 + Alembic 0007.
        name: "imported_messages",
        dexieTable: "importedMessages",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        // v1.9.0 / Phase 22A — Subjects (global taxonomy) +
        // Tags (per-user labels). Subjects are MUTABLE (rename /
        // re-parent / icon edit). Tags are MUTABLE too (rename /
        // color edit).
        name: "subjects",
        dexieTable: "subjects",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        name: "tags",
        dexieTable: "tags",
        timestampField: "created_at",
        appendOnly: false,
    },
    {
        // M:N association rows are APPEND-ONLY: assigning /
        // unassigning is an insert / delete, never an update.
        name: "project_subjects",
        dexieTable: "projectSubjects",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        name: "project_tags",
        dexieTable: "projectTags",
        timestampField: "created_at",
        appendOnly: true,
    },
    {
        // v1.16.0 / Phase 29A — per-user XP / level singleton.
        // MUTABLE: ``total_xp`` advances on every session-end,
        // assessment, import. Conflict resolution by
        // ``updated_at`` picks the device that accumulated more
        // recently (the user's true cross-device total can drift
        // briefly during offline use; the last-write wins is
        // intentional — exact cross-device merging of XP isn't
        // useful and rewards the wrong behaviour).
        name: "user_xp",
        dexieTable: "userXp",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.16.0 / Phase 29B — badge catalog (global, MUTABLE).
        // The seed YAML is the source of truth; sync carries the
        // catalog so a fresh device knows about every available
        // badge before the user earns any.
        name: "badges",
        dexieTable: "badges",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.16.0 / Phase 29B — earned-badge record. v1.40.0 /
        // Phase 57: MUTABLE (was append-only) — a dynamic badge's
        // ``tier`` climbs in place (high-water mark, never demotes), so
        // last-write-wins on ``updated_at`` is safe (the newer write
        // always carries the higher-or-equal tier). The v21 Dexie
        // upgrade back-fills ``updated_at = earned_at`` for pre-tier
        // rows.
        name: "user_badges",
        dexieTable: "userBadges",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.16.0 / Phase 29C — per-user streak state singleton.
        // MUTABLE: freezes earned / spent + weekend-mode flag.
        name: "user_streaks",
        dexieTable: "userStreaks",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.17.0 / Phase 30B — Anki flashcard suggestions.
        // MUTABLE: the user accepts / rejects / edits in-place.
        name: "anki_card_suggestions",
        dexieTable: "ankiCards",
        timestampField: "updated_at",
        appendOnly: false,
    },
    {
        // v1.19.0 / Phase 32B — AI-generated study questions.
        // MUTABLE: the user edits / deletes in-place.
        name: "study_questions",
        dexieTable: "studyQuestions",
        timestampField: "updated_at",
        appendOnly: false,
    },
];

export const APPEND_ONLY_TABLES = new Set(
    SYNC_TABLES.filter((t) => t.appendOnly).map((t) => t.name),
);
