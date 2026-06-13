/**
 * Adaptive Learner API client — curricula, topics, lessons, subjects, tags, projectTaxonomy namespaces.
 *
 * Namespace bodies extracted verbatim from client.ts (#394) and
 * composed into ``api`` by the client.ts barrel via spread.
 */

import { apiCall } from "./client-core";
import type {
  CurriculumCreateBody,
  CurriculumUpdateBody,
  TopicCreateBody,
  TopicUpdateBody,
  LessonCreateBody,
  LessonUpdateBody,
  SubjectCreateBody,
  SubjectUpdateBody,
  TagCreateBody,
  TagUpdateBody
} from "./request-types";

export const curriculumApi = {
  // --- Curriculum + topics (core, not plugin) -------------------------

  curricula: {
    /** List every curriculum owned by ``user_id``. */
    list: (userId: string) =>
      apiCall<import("../types/domain").Curriculum[]>(
        `/users/${encodeURIComponent(userId)}/curricula`,
      ),
    create: (userId: string, body: CurriculumCreateBody) =>
      apiCall<import("../types/domain").Curriculum>(
        `/users/${encodeURIComponent(userId)}/curricula`,
        { method: "POST", body },
      ),
    get: (curriculumId: string) =>
      apiCall<import("../types/domain").Curriculum>(
        `/curricula/${encodeURIComponent(curriculumId)}`,
      ),
    update: (curriculumId: string, body: CurriculumUpdateBody) =>
      apiCall<import("../types/domain").Curriculum>(
        `/curricula/${encodeURIComponent(curriculumId)}`,
        { method: "PATCH", body },
      ),
    remove: (curriculumId: string) =>
      apiCall<void>(`/curricula/${encodeURIComponent(curriculumId)}`, {
        method: "DELETE",
      }),
    listTopics: (curriculumId: string) =>
      apiCall<import("../types/domain").LearningTopic[]>(
        `/curricula/${encodeURIComponent(curriculumId)}/topics`,
      ),
    createTopic: (curriculumId: string, body: TopicCreateBody) =>
      apiCall<import("../types/domain").LearningTopic>(
        `/curricula/${encodeURIComponent(curriculumId)}/topics`,
        { method: "POST", body },
      ),
    listLessons: (curriculumId: string) =>
      apiCall<import("../types/domain").Lesson[]>(
        `/curricula/${encodeURIComponent(curriculumId)}/lessons`,
      ),
    createLesson: (curriculumId: string, body: LessonCreateBody) =>
      apiCall<import("../types/domain").Lesson>(
        `/curricula/${encodeURIComponent(curriculumId)}/lessons`,
        { method: "POST", body },
      ),
  },

  topics: {
    get: (topicId: string) =>
      apiCall<import("../types/domain").LearningTopic>(`/topics/${encodeURIComponent(topicId)}`),
    update: (topicId: string, body: TopicUpdateBody) =>
      apiCall<import("../types/domain").LearningTopic>(`/topics/${encodeURIComponent(topicId)}`, {
        method: "PATCH",
        body,
      }),
    remove: (topicId: string) =>
      apiCall<void>(`/topics/${encodeURIComponent(topicId)}`, {
        method: "DELETE",
      }),
  },

  lessons: {
    get: (lessonId: string) =>
      apiCall<import("../types/domain").Lesson>(`/lessons/${encodeURIComponent(lessonId)}`),
    update: (lessonId: string, body: LessonUpdateBody) =>
      apiCall<import("../types/domain").Lesson>(`/lessons/${encodeURIComponent(lessonId)}`, {
        method: "PATCH",
        body,
      }),
    remove: (lessonId: string) =>
      apiCall<void>(`/lessons/${encodeURIComponent(lessonId)}`, {
        method: "DELETE",
      }),
  },

  // --- Taxonomy: Subjects + Tags (v1.9.0 / Phase 22) ------------------

  subjects: {
    list: () => apiCall<import("../types/domain").Subject[]>("/subjects"),
    get: (subjectId: string) =>
      apiCall<import("../types/domain").Subject>(`/subjects/${encodeURIComponent(subjectId)}`),
    create: (body: SubjectCreateBody) =>
      apiCall<import("../types/domain").Subject>("/subjects", {
        method: "POST",
        body,
      }),
    update: (subjectId: string, body: SubjectUpdateBody) =>
      apiCall<import("../types/domain").Subject>(`/subjects/${encodeURIComponent(subjectId)}`, {
        method: "PATCH",
        body,
      }),
    remove: (subjectId: string) =>
      apiCall<void>(`/subjects/${encodeURIComponent(subjectId)}`, {
        method: "DELETE",
      }),
  },

  tags: {
    list: (userId: string) =>
      apiCall<import("../types/domain").Tag[]>(`/users/${encodeURIComponent(userId)}/tags`),
    create: (userId: string, body: TagCreateBody) =>
      apiCall<import("../types/domain").Tag>(`/users/${encodeURIComponent(userId)}/tags`, {
        method: "POST",
        body,
      }),
    update: (tagId: string, body: TagUpdateBody) =>
      apiCall<import("../types/domain").Tag>(`/tags/${encodeURIComponent(tagId)}`, {
        method: "PATCH",
        body,
      }),
    remove: (tagId: string) =>
      apiCall<void>(`/tags/${encodeURIComponent(tagId)}`, {
        method: "DELETE",
      }),
  },

  projectTaxonomy: {
    listSubjects: (projectId: string) =>
      apiCall<import("../types/domain").Subject[]>(
        `/projects/${encodeURIComponent(projectId)}/subjects`,
      ),
    assignSubject: (projectId: string, subjectId: string) =>
      apiCall<import("../types/domain").Subject>(
        `/projects/${encodeURIComponent(projectId)}/subjects`,
        { method: "POST", body: { subject_id: subjectId } },
      ),
    unassignSubject: (projectId: string, subjectId: string) =>
      apiCall<void>(
        `/projects/${encodeURIComponent(projectId)}/subjects/` + encodeURIComponent(subjectId),
        { method: "DELETE" },
      ),
    listTags: (projectId: string) =>
      apiCall<import("../types/domain").Tag[]>(`/projects/${encodeURIComponent(projectId)}/tags`),
    assignTag: (projectId: string, tagId: string) =>
      apiCall<import("../types/domain").Tag>(`/projects/${encodeURIComponent(projectId)}/tags`, {
        method: "POST",
        body: { tag_id: tagId },
      }),
    unassignTag: (projectId: string, tagId: string) =>
      apiCall<void>(
        `/projects/${encodeURIComponent(projectId)}/tags/` + encodeURIComponent(tagId),
        { method: "DELETE" },
      ),
  },
};
