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
 * stored API key; the API-mode path is the backend's
 * ``/plugins/session/pronunciation/*`` routes, and the
 * Dexie-mode path throws ``ApiError(501)`` for v1.18.0 (browser-
 * direct AI for pronunciation deferred to a polish patch). The
 * Pronunciation page surfaces a clear "switch to API mode"
 * hint when the throw fires.
 */
