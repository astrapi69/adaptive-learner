/**
 * Dexie implementation of the subjects / tags / projectTaxonomy namespaces (#354).
 *
 * Extracted verbatim from ``dexie-storage.ts``; shared row
 * mappers/helpers come from ``./dexie-rows``.
 */

import { getDb, newId, nowIso } from "./db";
import { ApiError } from "../../api/client";
import type {
  SubjectCreateBody,
  SubjectUpdateBody,
  TagCreateBody,
  TagUpdateBody,
} from "../../api/client";
import type { Subject, Tag } from "../../types/domain";
import type { IStorageService } from "../types";

export const dexieSubjects: IStorageService["subjects"] = {
    async list(): Promise<Subject[]> {
      const db = getDb();
      const rows = await db.subjects.toArray();
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return rows;
    },
    async get(subjectId: string): Promise<Subject> {
      const db = getDb();
      const row = await db.subjects.get(subjectId);
      if (!row) {
        throw new ApiError(
          404,
          `Subject ${subjectId} not found`,
          `/subjects/${subjectId}`,
          "GET",
        );
      }
      return row;
    },
    async create(body: SubjectCreateBody): Promise<Subject> {
      const db = getDb();
      if (body.parent_id) {
        const parent = await db.subjects.get(body.parent_id);
        if (!parent) {
          throw new ApiError(
            404,
            `Parent subject ${body.parent_id} not found`,
            "/subjects",
            "POST",
          );
        }
      }
      const ts = nowIso();
      const row: Subject = {
        id: newId(),
        parent_id: body.parent_id ?? null,
        name: body.name,
        description: body.description ?? null,
        icon: body.icon ?? null,
        created_at: ts,
        updated_at: ts,
      };
      await db.subjects.add(row);
      return row;
    },
    async update(subjectId: string, body: SubjectUpdateBody): Promise<Subject> {
      const db = getDb();
      if (body.parent_id !== undefined && body.parent_id === subjectId) {
        throw new ApiError(
          400,
          "Subject cannot be its own parent.",
          `/subjects/${subjectId}`,
          "PATCH",
        );
      }
      // #390 Phase 3: the existence/parent reads and the put run in one
      // rw transaction so a concurrent edit isn't lost.
      let next: Subject | null = null;
      await db.transaction("rw", db.subjects, async () => {
        const existing = await db.subjects.get(subjectId);
        if (!existing) {
          throw new ApiError(
            404,
            `Subject ${subjectId} not found`,
            `/subjects/${subjectId}`,
            "PATCH",
          );
        }
        if (body.parent_id) {
          const parent = await db.subjects.get(body.parent_id);
          if (!parent) {
            throw new ApiError(
              404,
              `Parent subject ${body.parent_id} not found`,
              `/subjects/${subjectId}`,
              "PATCH",
            );
          }
        }
        next = {
          ...existing,
          ...(body.name !== undefined && { name: body.name }),
          ...(body.parent_id !== undefined && { parent_id: body.parent_id }),
          ...(body.description !== undefined && {
            description: body.description,
          }),
          ...(body.icon !== undefined && { icon: body.icon }),
          updated_at: nowIso(),
        };
        await db.subjects.put(next);
      });
      return next as unknown as Subject;
    },
    async remove(subjectId: string): Promise<void> {
      const db = getDb();
      await db.transaction(
        "rw",
        [db.subjects, db.projectSubjects],
        async () => {
          // Detach children (SET NULL behaviour).
          await db.subjects
            .where("parent_id")
            .equals(subjectId)
            .modify({ parent_id: null, updated_at: nowIso() });
          await db.projectSubjects
            .where("subject_id")
            .equals(subjectId)
            .delete();
          await db.subjects.delete(subjectId);
        },
      );
    },

};

export const dexieTags: IStorageService["tags"] = {
    async list(userId: string): Promise<Tag[]> {
      const db = getDb();
      const rows = await db.tags.where("user_id").equals(userId).toArray();
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return rows;
    },
    async create(userId: string, body: TagCreateBody): Promise<Tag> {
      const db = getDb();
      const existing = await db.tags
        .where("user_id")
        .equals(userId)
        .and((row) => row.name === body.name)
        .first();
      if (existing) {
        throw new ApiError(
          409,
          `Tag '${body.name}' already exists for this user.`,
          `/users/${userId}/tags`,
          "POST",
        );
      }
      const row: Tag = {
        id: newId(),
        user_id: userId,
        name: body.name,
        color: body.color ?? null,
        created_at: nowIso(),
      };
      await db.tags.add(row);
      return row;
    },
    async update(tagId: string, body: TagUpdateBody): Promise<Tag> {
      const db = getDb();
      // #390 Phase 3: existence + name-clash reads and the put in one rw
      // transaction so a concurrent edit isn't lost.
      let next: Tag | null = null;
      await db.transaction("rw", db.tags, async () => {
        const existing = await db.tags.get(tagId);
        if (!existing) {
          throw new ApiError(
            404,
            `Tag ${tagId} not found`,
            `/tags/${tagId}`,
            "PATCH",
          );
        }
        if (body.name !== undefined && body.name !== existing.name) {
          const clash = await db.tags
            .where("user_id")
            .equals(existing.user_id)
            .and((row) => row.name === body.name && row.id !== tagId)
            .first();
          if (clash) {
            throw new ApiError(
              409,
              `Tag '${body.name}' already exists for this user.`,
              `/tags/${tagId}`,
              "PATCH",
            );
          }
        }
        next = {
          ...existing,
          ...(body.name !== undefined && { name: body.name }),
          ...(body.color !== undefined && { color: body.color }),
        };
        await db.tags.put(next);
      });
      return next as unknown as Tag;
    },
    async remove(tagId: string): Promise<void> {
      const db = getDb();
      await db.transaction("rw", [db.tags, db.projectTags], async () => {
        await db.projectTags.where("tag_id").equals(tagId).delete();
        await db.tags.delete(tagId);
      });
    },

};

export const dexieProjectTaxonomy: IStorageService["projectTaxonomy"] = {
    async listSubjects(projectId: string): Promise<Subject[]> {
      const db = getDb();
      const assocs = await db.projectSubjects
        .where("project_id")
        .equals(projectId)
        .toArray();
      const subjectIds = assocs.map((a) => a.subject_id);
      const subjects = await db.subjects.bulkGet(subjectIds);
      const out = subjects.filter((s): s is Subject => s !== undefined);
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    },
    async assignSubject(
      projectId: string,
      subjectId: string,
    ): Promise<Subject> {
      const db = getDb();
      const project = await db.learningProjects.get(projectId);
      if (!project) {
        throw new ApiError(
          404,
          `Project ${projectId} not found`,
          `/projects/${projectId}/subjects`,
          "POST",
        );
      }
      const subject = await db.subjects.get(subjectId);
      if (!subject) {
        throw new ApiError(
          404,
          `Subject ${subjectId} not found`,
          `/projects/${projectId}/subjects`,
          "POST",
        );
      }
      const existing = await db.projectSubjects
        .where("project_id")
        .equals(projectId)
        .and((row) => row.subject_id === subjectId)
        .first();
      if (!existing) {
        await db.projectSubjects.add({
          id: newId(),
          project_id: projectId,
          subject_id: subjectId,
          created_at: nowIso(),
        });
      }
      return subject;
    },
    async unassignSubject(projectId: string, subjectId: string): Promise<void> {
      const db = getDb();
      const existing = await db.projectSubjects
        .where("project_id")
        .equals(projectId)
        .and((row) => row.subject_id === subjectId)
        .first();
      if (!existing) {
        throw new ApiError(
          404,
          `Subject ${subjectId} not assigned to project ${projectId}`,
          `/projects/${projectId}/subjects/${subjectId}`,
          "DELETE",
        );
      }
      await db.projectSubjects.delete(existing.id);
    },
    async listTags(projectId: string): Promise<Tag[]> {
      const db = getDb();
      const assocs = await db.projectTags
        .where("project_id")
        .equals(projectId)
        .toArray();
      const tagIds = assocs.map((a) => a.tag_id);
      const tags = await db.tags.bulkGet(tagIds);
      const out = tags.filter((t): t is Tag => t !== undefined);
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    },
    async assignTag(projectId: string, tagId: string): Promise<Tag> {
      const db = getDb();
      const project = await db.learningProjects.get(projectId);
      if (!project) {
        throw new ApiError(
          404,
          `Project ${projectId} not found`,
          `/projects/${projectId}/tags`,
          "POST",
        );
      }
      const tag = await db.tags.get(tagId);
      if (!tag) {
        throw new ApiError(
          404,
          `Tag ${tagId} not found`,
          `/projects/${projectId}/tags`,
          "POST",
        );
      }
      if (tag.user_id !== project.user_id) {
        throw new ApiError(
          400,
          "Tag and project belong to different users.",
          `/projects/${projectId}/tags`,
          "POST",
        );
      }
      const existing = await db.projectTags
        .where("project_id")
        .equals(projectId)
        .and((row) => row.tag_id === tagId)
        .first();
      if (!existing) {
        await db.projectTags.add({
          id: newId(),
          project_id: projectId,
          tag_id: tagId,
          created_at: nowIso(),
        });
      }
      return tag;
    },
    async unassignTag(projectId: string, tagId: string): Promise<void> {
      const db = getDb();
      const existing = await db.projectTags
        .where("project_id")
        .equals(projectId)
        .and((row) => row.tag_id === tagId)
        .first();
      if (!existing) {
        throw new ApiError(
          404,
          `Tag ${tagId} not assigned to project ${projectId}`,
          `/projects/${projectId}/tags/${tagId}`,
          "DELETE",
        );
      }
      await db.projectTags.delete(existing.id);
    },

};
