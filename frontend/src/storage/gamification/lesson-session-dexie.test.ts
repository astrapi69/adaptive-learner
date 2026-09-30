/**
 * A completed content lesson counts as activity in browser mode (#3375).
 *
 * API mode writes a completed ``LearningSession`` (method ``content``) under
 * the user's ``kind="content"`` pseudo-project when a lesson completes
 * (``lesson_session_unification.py``), so lesson days feed the streak, the
 * heatmap and the lesson-XP streak multiplier. Dexie mode wrote nothing, so a
 * lesson-only learner kept a 0-day streak and earned less XP than on desktop.
 * The API half is pinned in ``backend/tests/test_lesson_session_unification.py``.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { filterStandardProjects } from "../../lib/learning/learning-project";
import { _resetDbForTests, getDb } from "../dexie/db";
import { rowToProject } from "../dexie/dexie-rows";
import { dexieStorage } from "../dexie-storage";

const USER = "user-1";
const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "language-fr-a1";

async function seedUser(): Promise<void> {
  await getDb().users.put({
    id: USER,
    name: "Tester",
    email: null,
    language: "en",
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
  });
}

async function completeLesson(filename: string): Promise<void> {
  await dexieStorage.lessonProgress.upsert(USER, {
    source: SOURCE,
    set_id: SET_ID,
    lesson_filename: filename,
    step_result: { step_id: "step1", correct: 4, total: 4, attempts: 1 },
    mark_completed: true,
  });
}

async function contentProjects() {
  return (await getDb().learningProjects.where({ user_id: USER }).toArray()).filter(
    (p) => p.kind === "content",
  );
}

beforeEach(async () => {
  // _resetDbForTests only closes the handle; clear every table so each
  // test starts empty.
  await _resetDbForTests();
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await seedUser();
});

describe("content lesson completion writes a session (#3375)", () => {
  it("counts the lesson day toward the streak", async () => {
    await completeLesson("01-greetings.json");
    const streak = await dexieStorage.gamification.getStreak(USER);
    expect(streak.current_streak_days).toBe(1);
  });

  it("writes one completed content session under a hidden pseudo-project", async () => {
    await completeLesson("01-greetings.json");
    const projects = await contentProjects();
    expect(projects).toHaveLength(1);
    expect(filterStandardProjects(projects.map(rowToProject))).toEqual([]);
    const sessions = await getDb().learningSessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      project_id: projects[0].id,
      method: "content",
      status: "completed",
      cycle_step: 1,
    });
    expect(sessions[0].ended_at).not.toBeNull();
  });

  it("awards the same XP as API mode, with the first-day streak multiplier", async () => {
    await completeLesson("01-greetings.json");
    const xp = await getDb().userXp.where({ user_id: USER }).first();
    // 30 base + 30 stars + 20 first-attempt, x1.25 (backend test pins 100).
    expect(xp?.total_xp).toBe(100);
  });

  it("reuses the pseudo-project for a second lesson", async () => {
    await completeLesson("01-greetings.json");
    await completeLesson("02-numbers.json");
    expect(await contentProjects()).toHaveLength(1);
    expect(await getDb().learningSessions.count()).toBe(2);
  });

  it("does not write a session when an already completed lesson is saved again", async () => {
    await completeLesson("01-greetings.json");
    await dexieStorage.lessonProgress.upsert(USER, {
      source: SOURCE,
      set_id: SET_ID,
      lesson_filename: "01-greetings.json",
      mark_completed: true,
    });
    expect(await getDb().learningSessions.count()).toBe(1);
  });

  it("never picks the pseudo-project as the recovered active project", async () => {
    await completeLesson("01-greetings.json");
    const recovered = await dexieStorage.users.findMostRecent();
    expect(recovered?.projectId ?? null).toBeNull();
  });

  it("does not count the content method toward all six methods", async () => {
    const db = getDb();
    await db.learningProjects.put({
      id: "p-std",
      user_id: USER,
      topic: "French",
      goal: "A1",
      timeframe: "3m",
      daily_minutes: 30,
      current_problem: null,
      active: true,
      kind: "standard",
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
    });
    for (const method of ["deductive", "inductive", "error_based", "dialogic", "contextual"] as const) {
      await db.learningSessions.add({
        id: `s-${method}`,
        project_id: "p-std",
        method,
        started_at: "2026-05-21T00:00:00Z",
        ended_at: "2026-05-21T00:10:00Z",
        cycle_step: 7,
        status: "completed",
        imported_conversation_id: null,
      });
    }
    await completeLesson("01-greetings.json");
    const badges = await db.userBadges.where({ user_id: USER }).toArray();
    const keys = await Promise.all(badges.map(async (b) => (await db.badges.get(b.badge_id))?.key));
    expect(keys).not.toContain("all_six_methods");
  });
});
