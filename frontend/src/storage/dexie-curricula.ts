/**
 * Dexie implementation of the curricula / topics / lessons namespaces (#354).
 *
 * Extracted verbatim from ``dexie-storage.ts``; shared row
 * mappers/helpers come from ``./dexie-rows``.
 */

import { getDb, newId, nowIso } from "./db";
import { requireRow, rowToCurriculum, rowToLesson, rowToTopic } from "./dexie-rows";
import type { CurriculumRow, LearningTopicRow, LessonRow } from "./db";
import type {
  CurriculumCreateBody,
  CurriculumUpdateBody,
  LessonCreateBody,
  LessonUpdateBody,
  TopicCreateBody,
  TopicUpdateBody,
} from "../api/client";
import type { Curriculum, LearningTopic, Lesson } from "../types/domain";
import type { IStorageService } from "./types";

export const dexieCurricula: IStorageService["curricula"] = {
    async list(userId: string): Promise<Curriculum[]> {
      const db = getDb();
      const rows = await db.curricula.where("user_id").equals(userId).toArray();
      rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return rows.map(rowToCurriculum);
    },
    async create(
      userId: string,
      body: CurriculumCreateBody,
    ): Promise<Curriculum> {
      const db = getDb();
      const user = await requireRow(db.users, userId, "User");
      const ts = nowIso();
      const row: CurriculumRow = {
        id: newId(),
        user_id: userId,
        title: body.title,
        description: body.description ?? null,
        language: body.language ?? user.language,
        created_at: ts,
        updated_at: ts,
        imported_conversation_id: body.imported_conversation_id ?? null,
      };
      await db.curricula.add(row);
      return rowToCurriculum(row);
    },
    /**
     * Phase 36 Bug 3 — return the curriculum auto-generated
     * from this conversation, or ``null`` if none exists.
     * ImportDetail uses the answer to flip the "Create
     * curriculum" CTA into a "Go to curriculum" navigate.
     */
    async getForConversation(
      conversationId: string,
    ): Promise<Curriculum | null> {
      const db = getDb();
      const row = await db.curricula
        .where("imported_conversation_id")
        .equals(conversationId)
        .first();
      return row ? rowToCurriculum(row) : null;
    },
    async get(curriculumId: string): Promise<Curriculum> {
      const db = getDb();
      const row = await requireRow(db.curricula, curriculumId, "Curriculum");
      return rowToCurriculum(row);
    },
    async update(
      curriculumId: string,
      body: CurriculumUpdateBody,
    ): Promise<Curriculum> {
      const db = getDb();
      const row = await requireRow(db.curricula, curriculumId, "Curriculum");
      const updated: CurriculumRow = {
        ...row,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
        updated_at: nowIso(),
      };
      await db.curricula.put(updated);
      return rowToCurriculum(updated);
    },
    async remove(curriculumId: string): Promise<void> {
      const db = getDb();
      await db.transaction(
        "rw",
        [db.curricula, db.learningTopics, db.lessons],
        async () => {
          await db.lessons.where("curriculum_id").equals(curriculumId).delete();
          await db.learningTopics
            .where("curriculum_id")
            .equals(curriculumId)
            .delete();
          await db.curricula.delete(curriculumId);
        },
      );
    },
    async listTopics(curriculumId: string): Promise<LearningTopic[]> {
      const db = getDb();
      const rows = await db.learningTopics
        .where("curriculum_id")
        .equals(curriculumId)
        .toArray();
      rows.sort((a, b) => a.order_index - b.order_index);
      return rows.map(rowToTopic);
    },
    async createTopic(
      curriculumId: string,
      body: TopicCreateBody,
    ): Promise<LearningTopic> {
      const db = getDb();
      await requireRow(db.curricula, curriculumId, "Curriculum");
      const ts = nowIso();
      const row: LearningTopicRow = {
        id: newId(),
        curriculum_id: curriculumId,
        parent_id: body.parent_id ?? null,
        title: body.title,
        description: body.description ?? null,
        order_index: body.order_index ?? 0,
        created_at: ts,
        updated_at: ts,
      };
      await db.learningTopics.add(row);
      return rowToTopic(row);
    },
    async listLessons(curriculumId: string): Promise<Lesson[]> {
      const db = getDb();
      const rows = await db.lessons
        .where("curriculum_id")
        .equals(curriculumId)
        .toArray();
      rows.sort((a, b) => a.order_index - b.order_index);
      return rows.map(rowToLesson);
    },
    async createLesson(
      curriculumId: string,
      body: LessonCreateBody,
    ): Promise<Lesson> {
      const db = getDb();
      await requireRow(db.curricula, curriculumId, "Curriculum");
      const ts = nowIso();
      const row: LessonRow = {
        id: newId(),
        curriculum_id: curriculumId,
        title: body.title,
        content: body.content ?? "",
        order_index: body.order_index ?? 0,
        created_at: ts,
        updated_at: ts,
      };
      await db.lessons.add(row);
      return rowToLesson(row);
    },

};

export const dexieTopics: IStorageService["topics"] = {
    async get(topicId: string): Promise<LearningTopic> {
      const db = getDb();
      const row = await requireRow(db.learningTopics, topicId, "Topic");
      return rowToTopic(row);
    },
    async update(
      topicId: string,
      body: TopicUpdateBody,
    ): Promise<LearningTopic> {
      const db = getDb();
      const row = await requireRow(db.learningTopics, topicId, "Topic");
      const updated: LearningTopicRow = {
        ...row,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.parent_id !== undefined ? { parent_id: body.parent_id } : {}),
        ...(body.order_index !== undefined
          ? { order_index: body.order_index }
          : {}),
        updated_at: nowIso(),
      };
      await db.learningTopics.put(updated);
      return rowToTopic(updated);
    },
    async remove(topicId: string): Promise<void> {
      const db = getDb();
      await db.learningTopics.delete(topicId);
    },

};

export const dexieLessons: IStorageService["lessons"] = {
    async get(lessonId: string): Promise<Lesson> {
      const db = getDb();
      const row = await requireRow(db.lessons, lessonId, "Lesson");
      return rowToLesson(row);
    },
    async update(lessonId: string, body: LessonUpdateBody): Promise<Lesson> {
      const db = getDb();
      const row = await requireRow(db.lessons, lessonId, "Lesson");
      const updated: LessonRow = {
        ...row,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.order_index !== undefined
          ? { order_index: body.order_index }
          : {}),
        updated_at: nowIso(),
      };
      await db.lessons.put(updated);
      return rowToLesson(updated);
    },
    async remove(lessonId: string): Promise<void> {
      const db = getDb();
      await db.lessons.delete(lessonId);
    },

};
