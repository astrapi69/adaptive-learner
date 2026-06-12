/**
 * Tools / curricula / topics / lessons / i18n / plugins namespaces.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  CurriculumCreateBody,
  CurriculumUpdateBody,
  LessonCreateBody,
  LessonUpdateBody,
  TopicCreateBody,
  TopicUpdateBody,
} from "../../api/request-types";
import type {
  Curriculum,
  LearningTopic,
  Lesson,
  SpacedRecommendation,
  ToolRecommendation,
} from "../../types/domain";

export interface IToolsNamespace {
  recommendations(projectId: string, lang: string): Promise<ToolRecommendation[]>;
  spaced(projectId: string, lang: string): Promise<SpacedRecommendation[]>;
}

export interface ICurriculaNamespace {
  list(userId: string): Promise<Curriculum[]>;
  create(userId: string, body: CurriculumCreateBody): Promise<Curriculum>;
  get(curriculumId: string): Promise<Curriculum>;
  update(curriculumId: string, body: CurriculumUpdateBody): Promise<Curriculum>;
  remove(curriculumId: string): Promise<void>;
  /**
   * Phase 36 Bug 3 — return the curriculum auto-generated from
   * the given imported conversation, or ``null`` if none exists.
   * ImportDetail uses the answer to flip its "Create curriculum"
   * CTA into a "Go to curriculum" navigate.
   */
  getForConversation(conversationId: string): Promise<Curriculum | null>;
  listTopics(curriculumId: string): Promise<LearningTopic[]>;
  createTopic(curriculumId: string, body: TopicCreateBody): Promise<LearningTopic>;
  listLessons(curriculumId: string): Promise<Lesson[]>;
  createLesson(curriculumId: string, body: LessonCreateBody): Promise<Lesson>;
}

export interface ITopicsNamespace {
  get(topicId: string): Promise<LearningTopic>;
  update(topicId: string, body: TopicUpdateBody): Promise<LearningTopic>;
  remove(topicId: string): Promise<void>;
}

export interface ILessonsNamespace {
  get(lessonId: string): Promise<Lesson>;
  update(lessonId: string, body: LessonUpdateBody): Promise<Lesson>;
  remove(lessonId: string): Promise<void>;
}

export interface II18nNamespace {
  get(lang: string): Promise<Record<string, unknown>>;
}

export interface IPluginsNamespace {
  manifests(): Promise<Record<string, unknown>>;
  health(): Promise<Record<string, unknown>>;
  errors(): Promise<Record<string, string>>;
}

/**
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * Learning Repository render + ZIP export. Mirrors the
 * backend's ``/api/plugins/learning-repo/render`` +
 * ``/export-zip`` endpoints (v1.26.0 / Phase 42) so the
 * LearningRepo page works in BOTH storage modes.
 *
 * In Dexie mode, the renderer is the TypeScript port at
 * ``frontend/src/lib/learning-repo/`` (49B-D); the
 * implementation builds the RenderContext from IndexedDB
 * via ``loadDexieContext`` and writes the ZIP with JSZip
 * client-side.
 *
 * The ``persist`` endpoint (git commit + tag) is NOT in
 * this namespace by design: it needs a server-side
 * filesystem + git binary, so it stays on
 * ``api.learningRepo.persist`` only. The LearningRepo page
 * gates the "Persist to git" button on storage mode.
 */
