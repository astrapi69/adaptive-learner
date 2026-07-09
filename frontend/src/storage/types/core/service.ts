/**
 * StorageMode + the IStorageService root contract.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type { IContentLoaderNamespace } from "../content/content";
import type {
  ICurriculaNamespace,
  II18nNamespace,
  ILessonsNamespace,
  IPluginsNamespace,
  IToolsNamespace,
  ITopicsNamespace,
} from "../content/curricula";
import type { IElementErrorsNamespace } from "../learning/element-errors";
import type { ILearningDataNamespace } from "../learning/learning-data";
import type { IGamificationNamespace } from "../learning/gamification";
import type { IGitHubNamespace } from "../integrations/github";
import type { IImportsNamespace } from "../content/imports";
import type {
  ILearningRepoNamespace,
  IPluginSettingsNamespace,
} from "../integrations/learning-repo";
import type { ILessonProgressNamespace } from "../content/lesson-progress";
import type { IMissionsNamespace } from "../learning/missions";
import type { INotebookLMNamespace } from "../integrations/notebooklm";
import type {
  IAnkiNamespace,
  IPronunciationNamespace,
} from "../learning/pronunciation";
import type {
  IAssessmentNamespace,
  ISessionNamespace,
  ITrackingNamespace,
} from "./session";
import type { ISettingsNamespace } from "./settings";
import type {
  IBackupNamespace,
  IExportNamespace,
  IProjectTaxonomyNamespace,
  ISubjectsNamespace,
  ISystemNamespace,
  ITagsNamespace,
} from "./system";
import type {
  IProjectsNamespace,
  IUsersNamespace,
} from "./users";

export type StorageMode = "api" | "dexie";

/**
 * The full storage contract. Mirrors ``api.*`` in api/client.ts;
 * every namespace's methods take the same arguments and return
 * the same domain types.
 */
export interface IStorageService {
  readonly mode: StorageMode;

  health(): Promise<{ status: string; version: string; debug: boolean }>;

  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  imports: IImportsNamespace;
  system: ISystemNamespace;
  backup: IBackupNamespace;
  export: IExportNamespace;
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  pronunciation: IPronunciationNamespace;
  notebooklm: INotebookLMNamespace;
  contentLoader: IContentLoaderNamespace;
  lessonProgress: ILessonProgressNamespace;
  elementErrors: IElementErrorsNamespace;
  learningData: ILearningDataNamespace;
  pluginSettings: IPluginSettingsNamespace;
  learningRepo: ILearningRepoNamespace;
  missions: IMissionsNamespace;
  github: IGitHubNamespace;

  /**
   * Phase 41F Danger Zone reset. Wipes every piece of learner
   * state this storage backend owns:
   *
   * - ``ApiStorage``: POSTs ``{confirmation}`` to /api/reset.
   *   The backend truncates every SQLite table, clears
   *   ~/.config/adaptive_learner/identity.yaml, and scrubs
   *   ``ai.*`` from secrets.yaml (preserving secret_key).
   * - ``DexieStorage``: clears every store in the main IndexedDB
   *   DB plus the separate auto-backup ring. localStorage +
   *   sessionStorage are cleared by the calling component
   *   (DangerZoneSection), not here.
   *
   * Both implementations require the literal ``"RESET"`` token;
   * ApiStorage forwards it to the backend gate, DexieStorage
   * checks it locally and rejects with an ApiError(400) so the
   * UI's typed-confirm pattern is enforced uniformly across
   * modes.
   */
  reset(confirmation: string): Promise<{ reset: true; tables_cleared: number }>;
}
