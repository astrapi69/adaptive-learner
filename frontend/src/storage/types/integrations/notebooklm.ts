/**
 * NotebookLM study questions + namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

export type StudyQuestionType = "open" | "fill_blank" | "explain" | "compare";
export type StudyQuestionDifficulty = "easy" | "medium" | "hard";

export interface StudyQuestion {
  id: string;
  user_id: string;
  project_id: string;
  session_id: string | null;
  question: string;
  expected_answer: string;
  question_type: StudyQuestionType;
  difficulty: StudyQuestionDifficulty;
  topic: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudyQuestionCreateBody {
  project_id: string;
  session_id?: string | null;
  question: string;
  expected_answer?: string;
  question_type?: StudyQuestionType;
  difficulty?: StudyQuestionDifficulty;
  topic?: string;
}

export interface StudyQuestionUpdateBody {
  question?: string;
  expected_answer?: string;
  question_type?: StudyQuestionType;
  difficulty?: StudyQuestionDifficulty;
  topic?: string;
}

export interface StudyQuestionListFilters {
  projectId?: string;
  difficulty?: StudyQuestionDifficulty;
  topic?: string;
}

export interface INotebookLMNamespace {
  listQuestions(userId: string, filters?: StudyQuestionListFilters): Promise<StudyQuestion[]>;
  createQuestion(userId: string, body: StudyQuestionCreateBody): Promise<StudyQuestion>;
  updateQuestion(questionId: string, body: StudyQuestionUpdateBody): Promise<StudyQuestion>;
  deleteQuestion(questionId: string): Promise<void>;
  generateFromSession(sessionId: string): Promise<StudyQuestion[]>;
  generateFromProject(projectId: string): Promise<StudyQuestion[]>;
  studyGuide(projectId: string): Promise<string>;
}

/**
 * Pronunciation practice (Phase 31C / v1.18.0).
 *
 * ``eligibility`` works in both storage modes — it just walks
 * the project's subject taxonomy looking for a ``Languages``
 * ancestor.
 *
 * ``phrase`` + ``judge`` require an active AI provider with a
 * stored API key. API mode calls the backend's
 * ``/plugins/session/pronunciation/*`` routes; Dexie mode calls the
 * provider browser-direct with the user's own key
 * (``storage/ai/pronunciation-dexie.ts``, #903). Both reject with
 * ``ApiError(400)`` when no key is configured. An unusable provider
 * reply is a 400 in API mode and a 502 in Dexie mode.
 */
