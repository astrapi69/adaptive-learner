/**
 * Users + projects namespaces.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  LearningProjectCreateBody,
  LearningProjectUpdateBody,
  UserCreateBody,
  UserUpdateBody,
} from "../../api/request-types";
import type {
  LearningProject,
  User,
} from "../../types/domain";

export interface IUsersNamespace {
  create(body: UserCreateBody): Promise<User>;
  get(userId: string): Promise<User>;
  update(userId: string, body: UserUpdateBody): Promise<User>;
  projects: {
    list(userId: string): Promise<LearningProject[]>;
    create(userId: string, body: LearningProjectCreateBody): Promise<LearningProject>;
  };
  /**
   * Recover the most recent locally-known user identity, or null
   * when storage carries no recoverable trace (Phase 41B).
   *
   * - ``ApiStorage``: reads ~/.config/adaptive_learner/identity.yaml
   *   via ``GET /api/identity``. Returns null on 404.
   * - ``DexieStorage``: queries the most recent ``users`` row and
   *   its currently-active ``projects`` row. Returns null when the
   *   users table is empty.
   *
   * The caller (Landing.tsx) verifies the returned ``userId`` still
   * exists in the relevant backend before restoring localStorage.
   */
  findMostRecent(): Promise<RecoveryHint | null>;
}

/**
 * Recovery hint returned by :meth:`IUsersNamespace.findMostRecent`
 * (Phase 41B). The shape matches what ``Landing.tsx`` needs to
 * restore localStorage after a browser data wipe: which user, which
 * project they were on, which UI language. Wire-format conversion
 * (``active_project_id`` -> ``projectId``) happens inside each
 * storage implementation so Landing.tsx is mode-agnostic.
 */
export interface RecoveryHint {
  userId: string;
  projectId: string | null;
  language: string | null;
}

export interface IProjectsNamespace {
  get(projectId: string): Promise<LearningProject>;
  update(projectId: string, body: LearningProjectUpdateBody): Promise<LearningProject>;
}
