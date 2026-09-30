/**
 * Browser-mode mirror of the lesson/session unification (#3375).
 *
 * API mode writes a completed ``LearningSession`` with method ``content``
 * under the user's ``kind="content"`` pseudo-project whenever a content
 * lesson completes (``backend/app/services/lesson_session_unification.py``).
 * Every activity reader (streak, heatmap, the lesson-XP streak multiplier)
 * counts sessions, so without this row a lesson-only learner in browser mode
 * never built a streak. The pseudo-project stays out of every picker through
 * ``filterStandardProjects`` and is created inactive, so the recovery path
 * never offers it as the learner's project.
 *
 * @example
 * await recordLessonCompletionSessionDexie(userId); // before the XP award
 */

import type { LearningMethod } from "../../lib/constants";
import { getDb, newId, nowIso } from "../dexie/db";
import type { LearningProjectRow, LearningSessionRow } from "../dexie/db-rows";

/** The method value API mode stores for a lesson completion. */
const CONTENT_LESSON_METHOD = "content";

const PSEUDO_PROJECT_TOPIC = "Content Lessons";
const PSEUDO_PROJECT_GOAL =
  "Auto-managed pseudo-project that owns LearningSession rows for completed content lessons.";

async function findOrCreateContentProject(userId: string): Promise<string> {
  const db = getDb();
  const existing = await db.learningProjects
    .where("user_id")
    .equals(userId)
    .filter((p) => p.kind === "content")
    .first();
  if (existing) return existing.id;
  const ts = nowIso();
  const row: LearningProjectRow = {
    id: newId(),
    user_id: userId,
    topic: PSEUDO_PROJECT_TOPIC,
    goal: PSEUDO_PROJECT_GOAL,
    timeframe: "ongoing",
    daily_minutes: 1,
    current_problem: null,
    active: false,
    kind: "content",
    created_at: ts,
    updated_at: ts,
  };
  await db.learningProjects.add(row);
  return row.id;
}

/**
 * Write the completed content session for a just-completed lesson.
 *
 * Runs in one readwrite transaction so two completions in parallel tabs
 * cannot create two pseudo-projects.
 */
export async function recordLessonCompletionSessionDexie(userId: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.learningProjects, db.learningSessions, async () => {
    const projectId = await findOrCreateContentProject(userId);
    const ts = nowIso();
    const session: LearningSessionRow = {
      id: newId(),
      project_id: projectId,
      // The row type lists the six chat methods; ``content`` rows belong to
      // the pseudo-project, which no chat-session path ever opens.
      method: CONTENT_LESSON_METHOD as LearningMethod,
      started_at: ts,
      ended_at: ts,
      cycle_step: 1,
      status: "completed",
      imported_conversation_id: null,
    };
    await db.learningSessions.add(session);
  });
}
