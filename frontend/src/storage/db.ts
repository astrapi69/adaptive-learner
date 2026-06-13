/**
 * Dexie database schema (Phase 10B).
 *
 * Mirrors the 14 SQLAlchemy models in ``backend/app/models/`` 1:1
 * so DexieStorage can store the same row shapes the backend would
 * have persisted. Field names match the wire JSON (snake_case)
 * because the IStorageService consumers expect the same domain
 * types from ``types/domain.ts``.
 *
 * Schema version starts at 1. Bump + add a ``stores()`` chain on
 * every breaking schema change; Dexie's migration system handles
 * the upgrade transparently for already-populated browsers.
 */

import Dexie, {type EntityTable, type Table} from "dexie";

import {BUNDLED_BADGES} from "./badges-data";

import type {
    UserRow,
    UserSettingsRow,
    ApiKeyBackupRow,
    LearningProjectRow,
    LearningProfileRow,
    CurriculumRow,
    LearningTopicRow,
    LessonRow,
    LearningSessionRow,
    SessionMessageRow,
    SessionRatingRow,
    SessionNoteRow,
    ProgressCommitRow,
    MethodSwitchRow,
    ImportedConversationRow,
    ImportedMessageRow,
    SubjectRow,
    TagRow,
    ProjectSubjectRow,
    ProjectTagRow,
    UserXPRow,
    BadgeRow,
    UserBadgeRow,
    StudyQuestionRow,
    AnkiCardRow,
    ContentSetRow,
    LessonProgressRow,
    ElementErrorRow,
    ContentSetFileRow,
    UserStreakRow,
    StepEvaluationRow,
    PluginSettingsRow,
    UserMissionRow,
} from "./db-rows";

// Re-export the row shapes so existing ``from "./db"`` imports keep
// working unchanged (#391 barrel).
export type * from "./db-rows";

// ---- Dexie database ---------------------------------------------------

export class AdaptiveLearnerDB extends Dexie {
    users!: EntityTable<UserRow, "id">;
    userSettings!: EntityTable<UserSettingsRow, "id">;
    // Phase 65 — API-key rollback cache (one row per user+provider).
    apiKeyBackups!: EntityTable<ApiKeyBackupRow, "id">;
    learningProjects!: EntityTable<LearningProjectRow, "id">;
    learningProfiles!: EntityTable<LearningProfileRow, "id">;
    curricula!: EntityTable<CurriculumRow, "id">;
    learningTopics!: EntityTable<LearningTopicRow, "id">;
    lessons!: EntityTable<LessonRow, "id">;
    learningSessions!: EntityTable<LearningSessionRow, "id">;
    sessionMessages!: EntityTable<SessionMessageRow, "id">;
    sessionRatings!: EntityTable<SessionRatingRow, "id">;
    sessionNotes!: EntityTable<SessionNoteRow, "id">;
    progressCommits!: EntityTable<ProgressCommitRow, "id">;
    methodSwitches!: EntityTable<MethodSwitchRow, "id">;
    stepEvaluations!: EntityTable<StepEvaluationRow, "id">;
    importedConversations!: EntityTable<ImportedConversationRow, "id">;
    importedMessages!: EntityTable<ImportedMessageRow, "id">;
    subjects!: EntityTable<SubjectRow, "id">;
    tags!: EntityTable<TagRow, "id">;
    projectSubjects!: EntityTable<ProjectSubjectRow, "id">;
    projectTags!: EntityTable<ProjectTagRow, "id">;
    userXp!: EntityTable<UserXPRow, "id">;
    badges!: EntityTable<BadgeRow, "id">;
    userBadges!: EntityTable<UserBadgeRow, "id">;
    userStreaks!: EntityTable<UserStreakRow, "id">;
    ankiCards!: EntityTable<AnkiCardRow, "id">;
    studyQuestions!: EntityTable<StudyQuestionRow, "id">;
    // Phase 43 / EXP-002 — Content-Loader cache. The Set
    // Browser (commit 7) reads ``contentSets``; the lesson
    // viewer (Phase 44) reads ``contentSetFiles``.
    contentSets!: EntityTable<ContentSetRow, "id">;
    contentSetFiles!: EntityTable<ContentSetFileRow, "id">;
    // Phase 44 / EXP-002 / P-109 — per-user lesson progress.
    // Composite key (``{user_id}#{source-slug}#{set_id}#{filename}``)
    // matches the backend's UniqueConstraint so the row shape
    // round-trips identically across modes.
    lessonProgress!: EntityTable<LessonProgressRow, "id">;
    // Phase 46B / EXP-007 / P-129 — element-level error +
    // mastery tracking. Composite key
    // ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}``
    // mirrors the backend UNIQUE constraint.
    elementErrors!: EntityTable<ElementErrorRow, "id">;
    // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
    // per-plugin settings round-trip. One row per plugin
    // name; lazy-created on first ``update``. Reads against
    // a missing row fall back to the bundled YAML defaults
    // at ``frontend/src/data/plugin-config/{name}.json``.
    pluginSettings!: EntityTable<PluginSettingsRow, "name">;
    // EXP-010 / Phase 56 — daily missions. One row per
    // {user_id, template_id, assigned_date}; indexes support the
    // per-user "today" query + the assigned_date scan.
    userMissions!: EntityTable<UserMissionRow, "id">;

    constructor(name = "adaptive-learner") {
        super(name);
        this.version(1).stores({
            users: "id, email",
            userSettings: "id, user_id",
            learningProjects: "id, user_id, active",
            learningProfiles: "id, project_id, user_id, assessed_at",
            curricula: "id, user_id",
            learningTopics: "id, curriculum_id, parent_id, order_index",
            lessons: "id, curriculum_id, order_index",
            learningSessions: "id, project_id, status, started_at",
            sessionMessages: "id, session_id, created_at",
            sessionRatings: "id, session_id, created_at",
            sessionNotes: "id, session_id, created_at",
            progressCommits: "id, project_id, session_id, committed_at",
            methodSwitches: "id, project_id, switched_at",
            stepEvaluations: "id, session_id, created_at",
        });
        // Schema v2 — v0.9.0 Phase 12C: chat-history import surface.
        this.version(2).stores({
            importedConversations:
                "id, user_id, project_id, imported_at, source, analyzed",
            importedMessages: "id, conversation_id, order_index",
        });
        // Schema v3 — v1.8.0 Phase 21A: step_evaluations column
        // alignment with the backend. ``suggested_step`` and
        // ``created_at`` rename to ``to_step`` and
        // ``evaluated_at`` so the sync surface uses one
        // vocabulary on both sides. The upgrade callback maps
        // each existing row in place.
        this.version(3)
            .stores({
                stepEvaluations: "id, session_id, evaluated_at",
            })
            .upgrade(async (tx) => {
                await tx
                    .table("stepEvaluations")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if ("suggested_step" in row) {
                            const sug = row.suggested_step as number;
                            const applied = row.applied as boolean;
                            const fromStep = row.from_step as number;
                            // Match the backend semantics:
                            //   to_step = applied ? suggested_step : from_step
                            row.to_step = applied ? sug : fromStep;
                            delete row.suggested_step;
                        }
                        if ("created_at" in row && !("evaluated_at" in row)) {
                            row.evaluated_at = row.created_at;
                            delete row.created_at;
                        }
                    });
            });
        // Schema v4 — v1.8.0 Phase 21B: session_notes promoted
        // from append-only to mutable for the sync surface.
        // ``updated_at`` is added; existing rows get
        // ``updated_at = created_at`` (the same back-fill the
        // backend's Alembic migration 0006 applies).
        this.version(4)
            .stores({
                sessionNotes: "id, session_id, updated_at",
            })
            .upgrade(async (tx) => {
                await tx
                    .table("sessionNotes")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("updated_at" in row)) {
                            row.updated_at = row.created_at;
                        }
                    });
            });
        // Schema v5 — v1.8.0 Phase 21D: imported_messages joins
        // the sync surface. ``created_at`` is added per row;
        // existing rows get ``created_at = parent.imported_at``
        // (matches the back-fill in Alembic 0007). The index
        // switches to ``created_at`` so the sync filter can
        // page through "since last sync" efficiently.
        this.version(5)
            .stores({
                importedMessages: "id, conversation_id, created_at",
            })
            .upgrade(async (tx) => {
                const conversations = await tx
                    .table("importedConversations")
                    .toArray();
                const importedAt = new Map<string, string>(
                    conversations.map((c: Record<string, unknown>) => [
                        String(c.id),
                        String(c.imported_at),
                    ]),
                );
                await tx
                    .table("importedMessages")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("created_at" in row)) {
                            const parentTs = importedAt.get(
                                String(row.conversation_id),
                            );
                            // Fall back to "now" if the parent
                            // somehow doesn't exist (orphan
                            // message; shouldn't happen but
                            // guards the migration anyway).
                            row.created_at =
                                parentTs ?? new Date().toISOString();
                        }
                    });
            });
        // Schema v6 — v1.9.0 Phase 22A: Subjects + Tags taxonomy.
        // Four new tables; no data migration needed (clean adds).
        this.version(6).stores({
            subjects: "id, parent_id, name, updated_at",
            tags: "id, user_id, name, created_at",
            projectSubjects: "id, project_id, subject_id, created_at",
            projectTags: "id, project_id, tag_id, created_at",
        });
        // Schema v7 — v1.16.0 Phase 29A: gamification XP singleton.
        // One new table; clean add, no data migration needed.
        this.version(7).stores({
            userXp: "id, user_id, updated_at",
        });
        // Schema v8 — v1.16.0 Phase 29B: badge catalog + earned
        // records. Two clean-add tables; no data migration.
        this.version(8).stores({
            badges: "id, key, category, updated_at",
            userBadges: "id, user_id, badge_id, earned_at",
        });
        // Schema v9 — v1.16.0 Phase 29C: per-user streak state
        // singleton (freezes, weekend mode, longest streak).
        this.version(9).stores({
            userStreaks: "id, user_id, updated_at",
        });
        // Schema v10 — v1.17.0 Phase 30B: Anki flashcard
        // suggestions. Indexed by user_id (primary read path)
        // + project_id + updated_at for sync.
        this.version(10).stores({
            ankiCards:
                "id, user_id, project_id, conversation_id, session_id, updated_at",
        });
        // Schema v11 — v1.19.0 Phase 32B: AI-generated study
        // questions. Indexed by user_id + project_id +
        // updated_at for sync; difficulty + topic are
        // free-text filters served by ``.filter()``.
        this.version(11).stores({
            studyQuestions:
                "id, user_id, project_id, session_id, updated_at",
        });
        // Schema v12 — v1.21.1 Phase 36 Bug 1: content_hash for
        // duplicate-import detection. Adds a secondary index so
        // the per-user dedup check on create is O(log n). The
        // upgrade back-fills the digest for every existing row by
        // reading its messages — mirrors the Alembic 0014
        // back-fill exactly so API + Dexie modes stay in lockstep.
        this.version(12)
            .stores({
                importedConversations:
                    "id, user_id, project_id, imported_at, source, analyzed, content_hash",
            })
            .upgrade(async (tx) => {
                const convs = await tx.table("importedConversations").toArray();
                for (const conv of convs) {
                    const messages = await tx
                        .table("importedMessages")
                        .where("conversation_id")
                        .equals(conv.id)
                        .sortBy("order_index");
                    const payload = messages
                        .map(
                            (m: Record<string, unknown>) =>
                                `${String(m.role).toLowerCase()}:${String(
                                    m.content,
                                ).trim()}`,
                        )
                        .join("\n");
                    const data = new TextEncoder().encode(payload);
                    const digest = await crypto.subtle.digest("SHA-256", data);
                    const bytes = new Uint8Array(digest);
                    let hex = "";
                    for (const b of bytes) {
                        hex += b.toString(16).padStart(2, "0");
                    }
                    await tx
                        .table("importedConversations")
                        .update(conv.id, {content_hash: hex});
                }
            });
        // Schema v13 — v1.21.1 Phase 36 Bug 3: children-side FK
        // from a generated curriculum back to the imported
        // conversation that produced it. New secondary index for
        // the per-conversation lookup. No back-fill: pre-v13 rows
        // were all free-form (no FK existed yet) so ``null`` is
        // correct for the historic set.
        this.version(13).stores({
            curricula: "id, user_id, imported_conversation_id",
        });
        // Schema v14 — v1.21.1 Phase 36 Bug 4: children-side FK
        // from a learning session back to the imported
        // conversation it was started from. New secondary index
        // for the "is there an active session for this
        // conversation?" lookup. No back-fill: pre-v14 sessions
        // were all free-form so ``null`` is correct historically.
        this.version(14).stores({
            learningSessions:
                "id, project_id, status, started_at, imported_conversation_id",
        });
        // Schema v15 — v1.26.0 Phase 42 (BL-30 prerequisite):
        // ``session_notes.kind`` joins the row shape. Mirrors
        // the backend Alembic 0017 migration. Existing rows
        // back-fill to ``"note"`` (matches the server_default).
        // No new index — kind is filtered in-memory by the
        // learning-repo renderer, not paged.
        this.version(15)
            .stores({
                sessionNotes: "id, session_id, updated_at",
            })
            .upgrade(async (tx) => {
                await tx
                    .table("sessionNotes")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("kind" in row)) {
                            row.kind = "note";
                        }
                    });
            });
        // Schema v16 — Phase 43 / EXP-002. Content-Loader
        // cache for Dexie-mode (GitHub Pages) users.
        // ``contentSets`` carries one row per downloaded set
        // (cache_key = "{source-slug}/{set_id}/{version}");
        // ``contentSetFiles`` carries the raw text/bytes of
        // each lesson + asset.
        this.version(16).stores({
            contentSets: "id, source, set_id, version, downloaded_at",
            contentSetFiles: "id, set_pk, filename",
        });
        // Schema v17 — Phase 44 / EXP-002 / P-109. Lesson
        // progress. Composite primary key
        // ``{user_id}#{source-slug}#{set_id}#{filename}``;
        // ``user_id`` index for the per-user list query.
        this.version(17).stores({
            lessonProgress: "id, user_id, set_id, status, updated_at",
        });
        // Schema v18 — Phase 46B / EXP-007 / P-129.
        // Element-level error + mastery tracking. Composite
        // primary key
        // ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}``
        // mirrors the backend's UNIQUE constraint so
        // duplicate upserts converge through either backend.
        // Indexes: ``user_id`` for the per-user list query,
        // ``[user_id+set_id]`` for set-filtered listing,
        // ``mastered`` for the review-queue "exclude
        // mastered" predicate.
        this.version(18).stores({
            elementErrors:
                "id, user_id, [user_id+set_id], mastered, updated_at",
        });
        // Schema v19 — Phase 49 / v1.32.0 / PHASE-42-STORAGE-
        // ABSTRACTION-01: per-plugin settings round-trip.
        // Single primary key ``name`` (plugin slug); no
        // secondary indexes — the table only ever supports
        // get-by-name + upsert, never a multi-row scan.
        this.version(19).stores({
            pluginSettings: "&name",
        });
        // Schema v20 — EXP-010 / Phase 56: daily missions.
        // Indexes: ``user_id`` + ``[user_id+assigned_date]`` for
        // the per-user "today" query, ``assigned_date`` for the
        // midnight-rollover scan, ``template_id`` for repeat
        // avoidance across days.
        this.version(20).stores({
            userMissions:
                "id, user_id, [user_id+assigned_date], assigned_date, template_id",
        });
        // Schema v21 — Phase 57 / v1.40.0: badge tiers. No index
        // changes (the new fields are non-indexed), but we bump so the
        // upgrade backfills existing rows in place:
        //   1. catalog ``badges`` rows get ``base_tier`` +
        //      ``tier_thresholds`` from BUNDLED_BADGES (the seeder only
        //      INSERTS missing rows, never updates existing ones, so an
        //      upgrade-in-place user would otherwise keep tier-less
        //      catalog rows);
        //   2. every ``userBadges`` row gets ``tier`` = its badge's
        //      static ``base_tier`` (dynamic badges start at "bronze")
        //      + ``updated_at`` = earned_at.
        // Mirrors the Alembic 0022 backfill so both modes converge.
        // BUNDLED_BADGES is statically imported from badges-data.ts (a
        // pure-data module with no db.ts dependency, so no import
        // cycle). It MUST NOT be a dynamic ``await import()`` here: a
        // native dynamic import escapes Dexie's promise-zone tracking,
        // so the IndexedDB upgrade transaction auto-commits during the
        // await and the subsequent tx.table(...) throws "The
        // transaction has finished" (surfaced as DatabaseClosedError),
        // which broke the v1.40.0 schema-v21 upgrade for every existing
        // Dexie user.
        this.version(21)
            .stores({})
            .upgrade(async (tx) => {
                const specByKey = new Map(
                    BUNDLED_BADGES.map((b) => [b.key, b]),
                );
                await tx
                    .table("badges")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        const spec = specByKey.get(row.key as string);
                        if (spec) {
                            row.base_tier = spec.base_tier ?? "bronze";
                            row.tier_thresholds = spec.tier_thresholds ?? null;
                        }
                    });
                const badges = await tx.table("badges").toArray();
                const baseTierById = new Map<string, string>(
                    badges.map((b: Record<string, unknown>) => [
                        b.id as string,
                        (b.base_tier as string) ?? "bronze",
                    ]),
                );
                await tx
                    .table("userBadges")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!row.tier) {
                            row.tier =
                                baseTierById.get(row.badge_id as string) ??
                                "bronze";
                        }
                        if (!row.updated_at) {
                            row.updated_at = row.earned_at;
                        }
                    });
            });
        // Schema v22 — Phase 60 / v1.44.0: language-pair fields on
        // ``contentSets``. No index changes (the new fields are
        // non-indexed). Backfill in place so existing downloaded /
        // user-generated set rows gain ``target_language`` (= the
        // old ``language``) + ``source_language`` (= "en", the
        // pilot explanation language). Mirrors the backend
        // ContentSet model's read-alias + "en" default so both
        // storage modes converge.
        this.version(22)
            .stores({})
            .upgrade(async (tx) => {
                await tx
                    .table("contentSets")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!row.target_language) {
                            row.target_language = row.language;
                        }
                        if (!row.source_language) {
                            row.source_language = "en";
                        }
                    });
            });
        // Schema v23 — EXP-018 / Phase 62 / v1.46.0: direction-aware
        // ``elementErrors``. Every pre-62 row was recorded receptively,
        // so it gets ``direction = "target_to_source"``. The composite
        // primary ``id`` grows a sixth ``#{direction}`` segment, so the
        // row must be RE-KEYED (delete + re-add) — ``.modify()`` cannot
        // change the keyPath value. New receptive upserts would
        // otherwise compute the new id and orphan the old row, losing
        // its error/streak/mastery history. No index changes
        // (``direction`` is filtered in memory by the review queue).
        this.version(23)
            .stores({})
            .upgrade(async (tx) => {
                const table = tx.table("elementErrors");
                const rows = await table.toArray();
                for (const row of rows as Record<string, unknown>[]) {
                    if (row.direction) {
                        continue;
                    }
                    const oldId = row.id as string;
                    row.direction = "target_to_source";
                    row.id = `${oldId}#target_to_source`;
                    await table.delete(oldId);
                    await table.put(row);
                }
            });
        // Phase 65 — additive: the API-key rollback-cache table.
        this.version(24).stores({
            apiKeyBackups: "id, user_id, provider",
        });
        // v1.54.0 — language pair on imported conversations (captured at
        // import time). Non-indexed additive fields; back-fill existing
        // rows to null so the UI applies the app-language fallback. No
        // dynamic import in the upgrade (avoids the DatabaseClosedError
        // trap from the v21 incident).
        this.version(25)
            .stores({})
            .upgrade(async (tx) => {
                await tx
                    .table("importedConversations")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("source_language" in row)) row.source_language = null;
                        if (!("target_language" in row)) row.target_language = null;
                    });
            });
        // Schema v26 — #390 Phase 2 (Class C create-race). DEDUP existing
        // duplicate rows so the unique indexes added in v27 can be created
        // without a ConstraintError on db.open. Adding a unique index on a
        // store that already holds duplicates aborts the open (white
        // screen), so the dedup MUST land in an earlier version: Dexie
        // runs every intermediate version's upgrade in one versionchange
        // transaction, so v26's deletes are visible when v27's
        // ``createIndex`` builds the index. No dynamic import here (the
        // v21 DatabaseClosedError trap).
        this.version(26)
            .stores({})
            .upgrade(async (tx) => {
                // Singletons: keep one row per user.
                await dedupeSingletonByUser(
                    tx.table("userSettings"),
                    (a, b) =>
                        String(b.updated_at ?? "").localeCompare(
                            String(a.updated_at ?? ""),
                        ) < 0,
                );
                await dedupeSingletonByUser(
                    tx.table("userXp"),
                    (a, b) => Number(a.total_xp ?? 0) >= Number(b.total_xp ?? 0),
                );
                await dedupeSingletonByUser(
                    tx.table("userStreaks"),
                    (a, b) =>
                        Number(a.longest_streak_days ?? 0) >=
                        Number(b.longest_streak_days ?? 0),
                );
                // Catalog: dedup badges by key, remapping userBadges.badge_id
                // to the survivor BEFORE deleting the duplicate badge rows.
                await dedupeBadgesByKey(
                    tx.table("badges"),
                    tx.table("userBadges"),
                );
                // userBadges: keep one row per (user_id, badge_id). Runs
                // AFTER the badge remap, which can collapse two rows onto
                // the same pair.
                await dedupeUserBadgesByPair(tx.table("userBadges"));
            });
        // Schema v27 — #390 Phase 2: the unique indexes themselves, on the
        // now-deduplicated data. ``&`` marks an index unique; the compound
        // ``&[user_id+badge_id]`` is the correct key for userBadges (one
        // row per user PER badge, not per user). These are the DB-level
        // backstop behind the transaction-wrapped ensure helpers.
        this.version(27).stores({
            userSettings: "id, &user_id",
            userXp: "id, &user_id, updated_at",
            userStreaks: "id, &user_id, updated_at",
            userBadges: "id, user_id, badge_id, earned_at, &[user_id+badge_id]",
            badges: "id, &key, category, updated_at",
        });
    }
}

type MigrationRow = Record<string, unknown> & {id: string};

/**
 * Delete duplicate singleton rows so a store keeps exactly one row per
 * ``user_id``. ``aWins(a, b)`` returns true when ``a`` should survive
 * over the currently-held ``b`` (the loser is deleted).
 */
async function dedupeSingletonByUser(
    table: Table<MigrationRow, string>,
    aWins: (a: MigrationRow, b: MigrationRow) => boolean,
): Promise<void> {
    const rows = await table.toArray();
    const winnerByUser = new Map<string, MigrationRow>();
    const toDelete: string[] = [];
    for (const row of rows) {
        const userId = String(row.user_id ?? "");
        const current = winnerByUser.get(userId);
        if (!current) {
            winnerByUser.set(userId, row);
            continue;
        }
        if (aWins(row, current)) {
            toDelete.push(current.id);
            winnerByUser.set(userId, row);
        } else {
            toDelete.push(row.id);
        }
    }
    for (const id of toDelete) await table.delete(id);
}

/**
 * Dedup the badge catalog by ``key``: pick the first row per key as the
 * survivor, remap every ``userBadges.badge_id`` that points at a
 * duplicate onto the survivor's id, then delete the duplicate badge rows.
 */
async function dedupeBadgesByKey(
    badges: Table<MigrationRow, string>,
    userBadges: Table<MigrationRow, string>,
): Promise<void> {
    const survivorByKey = new Map<string, MigrationRow>();
    const remap = new Map<string, string>();
    const toDelete: string[] = [];
    for (const badge of await badges.toArray()) {
        const key = String(badge.key ?? "");
        const survivor = survivorByKey.get(key);
        if (!survivor) {
            survivorByKey.set(key, badge);
            continue;
        }
        remap.set(badge.id, survivor.id);
        toDelete.push(badge.id);
    }
    if (remap.size > 0) {
        for (const userBadge of await userBadges.toArray()) {
            const target = remap.get(String(userBadge.badge_id ?? ""));
            if (target) {
                userBadge.badge_id = target;
                await userBadges.put(userBadge);
            }
        }
    }
    for (const id of toDelete) await badges.delete(id);
}

const TIER_RANK: Record<string, number> = {bronze: 0, silver: 1, gold: 2};

/** Keep one userBadges row per (user_id, badge_id); on a clash keep the
 *  higher tier, else the earlier ``earned_at``. */
async function dedupeUserBadgesByPair(
    table: Table<MigrationRow, string>,
): Promise<void> {
    const winnerByPair = new Map<string, MigrationRow>();
    const toDelete: string[] = [];
    for (const row of await table.toArray()) {
        const pair = `${String(row.user_id ?? "")}#${String(row.badge_id ?? "")}`;
        const current = winnerByPair.get(pair);
        if (!current) {
            winnerByPair.set(pair, row);
            continue;
        }
        const rowRank = TIER_RANK[String(row.tier ?? "bronze")] ?? 0;
        const curRank = TIER_RANK[String(current.tier ?? "bronze")] ?? 0;
        const rowWins =
            rowRank > curRank ||
            (rowRank === curRank &&
                String(row.earned_at ?? "").localeCompare(
                    String(current.earned_at ?? ""),
                ) < 0);
        if (rowWins) {
            toDelete.push(current.id);
            winnerByPair.set(pair, row);
        } else {
            toDelete.push(row.id);
        }
    }
    for (const id of toDelete) await table.delete(id);
}

/**
 * Singleton database handle. ``getDb()`` is the only allowed way
 * to reach it — tests reset via ``_resetDbForTests``.
 */
let _db: AdaptiveLearnerDB | null = null;

export function getDb(): AdaptiveLearnerDB {
    if (_db === null) {
        _db = new AdaptiveLearnerDB();
    }
    return _db;
}

/**
 * Test-only hook: close the current handle and forget it so the
 * next ``getDb()`` opens a fresh instance. Used to point Dexie
 * at fake-indexeddb between Vitest cases.
 */
export async function _resetDbForTests(): Promise<void> {
    if (_db !== null) {
        await _db.close();
        _db = null;
    }
}

/**
 * ISO timestamp helper. Centralised so a future ``Date.now()``
 * mock during tests reaches every callsite.
 */
export function nowIso(): string {
    return new Date().toISOString();
}

/**
 * UUID v4 generator. Browsers + happy-dom + fake-indexeddb all
 * ship ``crypto.randomUUID``; tests run under those runtimes.
 * Pinned in a helper so tests can mock it deterministically.
 */
export function newId(): string {
    return crypto.randomUUID();
}
