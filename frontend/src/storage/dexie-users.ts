/**
 * Dexie implementation of the users + projects namespaces (#354).
 *
 * Extracted verbatim from ``dexie-storage.ts``; shared row
 * mappers/helpers come from ``./dexie-rows``.
 */

import { getDb, newId, nowIso } from "./db";
import { ensureSettings, requireRow, rowToProject, rowToUser } from "./dexie-rows";
import type { LearningProjectRow, UserRow } from "./db";
import type {
  LearningProjectCreateBody,
  LearningProjectUpdateBody,
  UserCreateBody,
  UserUpdateBody,
} from "../api/client";
import type { LearningProject, User } from "../types/domain";
import type { IStorageService } from "./types";

export const dexieUsers: IStorageService["users"] = {
    async create(body: UserCreateBody): Promise<User> {
      const db = getDb();
      const ts = nowIso();
      const row: UserRow = {
        id: newId(),
        name: body.name,
        email: body.email ?? null,
        language: body.language ?? "de",
        created_at: ts,
        updated_at: ts,
      };
      await db.users.add(row);
      await ensureSettings(db, row.id, row.language);
      return rowToUser(row);
    },
    async get(userId: string): Promise<User> {
      const db = getDb();
      const row = await requireRow(db.users, userId, "User");
      return rowToUser(row);
    },
    async update(userId: string, body: UserUpdateBody): Promise<User> {
      const db = getDb();
      // #390 Phase 3: atomic get+spread+put (no lost concurrent edit).
      let updated: UserRow | null = null;
      await db.transaction("rw", db.users, async () => {
        const row = await requireRow(db.users, userId, "User");
        updated = {
          ...row,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.language !== undefined ? { language: body.language } : {}),
          updated_at: nowIso(),
        };
        await db.users.put(updated);
      });
      return rowToUser(updated as unknown as UserRow);
    },
    projects: {
      async list(userId: string): Promise<LearningProject[]> {
        const db = getDb();
        const rows = await db.learningProjects
          .where("user_id")
          .equals(userId)
          .toArray();
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return rows.map(rowToProject);
      },
      async create(
        userId: string,
        body: LearningProjectCreateBody,
      ): Promise<LearningProject> {
        const db = getDb();
        await requireRow(db.users, userId, "User");
        const ts = nowIso();
        const row: LearningProjectRow = {
          id: newId(),
          user_id: userId,
          topic: body.topic,
          goal: body.goal,
          timeframe: body.timeframe,
          daily_minutes: body.daily_minutes,
          current_problem: body.current_problem ?? null,
          active: body.active ?? true,
          // v1.31.0 / Phase 46F: Dexie-mode creates
          // are always wizard-driven (standard).
          kind: "standard",
          created_at: ts,
          updated_at: ts,
        };
        await db.learningProjects.add(row);
        return rowToProject(row);
      },
    },
    async findMostRecent() {
      // Phase 41B: Dexie-mode recovery. When localStorage is
      // empty but IndexedDB still carries learner data (a
      // localStorage-only wipe, not a full browser clear), we
      // can re-seed Landing.tsx from the most recent users row
      // + their currently-active project.
      const db = getDb();
      const rows = await db.users.toArray();
      if (rows.length === 0) {
        return null;
      }
      // Sort by updated_at desc; ties broken by created_at desc.
      rows.sort((a, b) => {
        const u = b.updated_at.localeCompare(a.updated_at);
        return u !== 0 ? u : b.created_at.localeCompare(a.created_at);
      });
      const user = rows[0];
      // Pick the user's currently-active project; fall back to
      // the most-recent project when no row is marked active
      // (legacy seed data, partial imports, etc.).
      const projects = await db.learningProjects
        .where("user_id")
        .equals(user.id)
        .toArray();
      const active = projects.find((p) => p.active) ?? null;
      const fallback = projects
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const project = active ?? fallback ?? null;
      return {
        userId: user.id,
        projectId: project?.id ?? null,
        language: user.language,
      };
    },

};

export const dexieProjects: IStorageService["projects"] = {
    async get(projectId: string): Promise<LearningProject> {
      const db = getDb();
      const row = await requireRow(db.learningProjects, projectId, "Project");
      return rowToProject(row);
    },
    async update(
      projectId: string,
      body: LearningProjectUpdateBody,
    ): Promise<LearningProject> {
      const db = getDb();
      // #390 Phase 3: atomic get+spread+put (no lost concurrent edit).
      let updated: LearningProjectRow | null = null;
      await db.transaction("rw", db.learningProjects, async () => {
        const row = await requireRow(db.learningProjects, projectId, "Project");
        updated = {
          ...row,
          ...(body.topic !== undefined ? { topic: body.topic } : {}),
          ...(body.goal !== undefined ? { goal: body.goal } : {}),
          ...(body.timeframe !== undefined
            ? { timeframe: body.timeframe }
            : {}),
          ...(body.daily_minutes !== undefined
            ? { daily_minutes: body.daily_minutes }
            : {}),
          ...(body.current_problem !== undefined
            ? { current_problem: body.current_problem }
            : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          updated_at: nowIso(),
        };
        await db.learningProjects.put(updated);
      });
      return rowToProject(updated as unknown as LearningProjectRow);
    },

};
