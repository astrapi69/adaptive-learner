/**
 * GitHub content-repository fetch + simplified validation (EXP-023 Phase A,
 * commit 2).
 *
 * Runs client-side in both storage modes: given an ``{owner, repo, branch}``
 * it fetches the repo's ``manifest.yaml`` from GitHub, checks the expected
 * structure (a ``sets`` array), a compatible schema major, and that a
 * sampled lesson only uses known ``exercise_type``s. Returns a result the
 * Settings UI renders as "Validation passed: X sets, Y lessons" or the
 * failure reason.
 *
 * Auth: a configured GitHub token (Dexie mode keeps it in localStorage) is
 * sent as a Bearer header so private repos resolve; public repos need none.
 * In API mode the token lives server-side and is not read here, so Phase A
 * validates public user repos client-side (private-repo support in API mode
 * is a Phase B concern).
 */

import { parse as parseYaml } from "yaml";

/** The exercise types the lesson schema (v1.3) knows about. */
export const KNOWN_EXERCISE_TYPES = [
  "matching",
  "picture_choice",
  "free_text",
  "word_tiles",
  "cloze",
] as const;

/** Schema major the app understands (CURRENT_SCHEMA_VERSION is 1.x). */
const SUPPORTED_SCHEMA_MAJOR = 1;

const RAW_BASE = "https://raw.githubusercontent.com";

/** localStorage key holding the GitHub PAT in Dexie (GH-Pages) mode. */
const GITHUB_TOKEN_KEY = "adaptive-learner.github_token";

/** Read the browser-stored GitHub token, or empty string when none. */
export function readBrowserGitHubToken(): string {
  try {
    return localStorage.getItem(GITHUB_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface RepoValidationResult {
  ok: boolean;
  setCount: number;
  lessonCount: number;
  /** Present when ``ok`` is false: a human-readable failure reason. */
  reason?: string;
}

interface ParsedSet {
  id?: string;
  version?: string;
  lesson_count?: number;
  path?: string;
}

interface ParsedManifest {
  schema_version?: string;
  sets?: ParsedSet[];
  metadata?: { lessons?: unknown };
}

interface ParsedExercise {
  type?: string;
}
interface ParsedLesson {
  exercises?: ParsedExercise[];
  steps?: { exercises?: ParsedExercise[] }[];
}

function rawUrl(ref: RepoRef, path: string): string {
  const safePath = path.replace(/^\/+/, "");
  return `${RAW_BASE}/${ref.owner}/${ref.repo}/${ref.branch}/${safePath}`;
}

async function fetchRepoText(
  ref: RepoRef,
  path: string,
  token: string,
): Promise<string> {
  const headers: Record<string, string> = {};
  if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  const response = await fetch(rawUrl(ref, path), { headers });
  if (!response.ok) {
    const err: Error & { status?: number } = new Error(
      `HTTP ${response.status} for ${path}`,
    );
    err.status = response.status;
    throw err;
  }
  return response.text();
}

/** Repo-relative base dir for a set (honours the optional ``path``). */
function setBasePath(set: ParsedSet): string {
  if (set.path && set.path.trim()) return set.path.replace(/\/+$/, "");
  return `sets/${set.id}`;
}

/** Collect every exercise's ``type`` from a lesson (flat or stepped). */
function lessonExerciseTypes(lesson: ParsedLesson): string[] {
  const types: string[] = [];
  for (const ex of lesson.exercises ?? []) {
    if (ex.type) types.push(ex.type);
  }
  for (const step of lesson.steps ?? []) {
    for (const ex of step.exercises ?? []) {
      if (ex.type) types.push(ex.type);
    }
  }
  return types;
}

function firstLessonFilename(setManifest: ParsedManifest): string {
  const lessons = setManifest.metadata?.lessons;
  if (Array.isArray(lessons) && typeof lessons[0] === "string") {
    return lessons[0];
  }
  return "01.json";
}

/**
 * Fetch + validate a GitHub content repository. Never throws — every
 * failure mode resolves to ``{ok: false, reason}`` so the caller can show
 * the reason without a try/catch.
 */
export async function validateUserRepo(
  ref: RepoRef,
  token: string = readBrowserGitHubToken(),
): Promise<RepoValidationResult> {
  let manifest: ParsedManifest;
  try {
    const text = await fetchRepoText(ref, "manifest.yaml", token);
    manifest = (parseYaml(text) ?? {}) as ParsedManifest;
  } catch (error) {
    const status = (error as { status?: number }).status;
    const reason =
      status === 404
        ? "Repository or manifest.yaml not found."
        : status === 401 || status === 403
          ? "Access denied — check the repository and your GitHub token."
          : "Repository unreachable.";
    return { ok: false, setCount: 0, lessonCount: 0, reason };
  }

  if (manifest.schema_version) {
    const major = Number.parseInt(manifest.schema_version.split(".")[0], 10);
    if (Number.isFinite(major) && major !== SUPPORTED_SCHEMA_MAJOR) {
      return {
        ok: false,
        setCount: 0,
        lessonCount: 0,
        reason: `Unsupported schema version ${manifest.schema_version}.`,
      };
    }
  }

  const sets = manifest.sets;
  if (!Array.isArray(sets) || sets.length === 0) {
    return {
      ok: false,
      setCount: 0,
      lessonCount: 0,
      reason: "manifest.yaml lists no sets.",
    };
  }

  const lessonCount = sets.reduce((sum, s) => sum + (s.lesson_count ?? 0), 0);

  // Sample the first set's first lesson and confirm its exercise types.
  const firstSet = sets[0];
  try {
    const base = setBasePath(firstSet);
    const setManifestText = await fetchRepoText(
      ref,
      `${base}/manifest.yaml`,
      token,
    );
    const setManifest = (parseYaml(setManifestText) ?? {}) as ParsedManifest;
    const lessonText = await fetchRepoText(
      ref,
      `${base}/lessons/${firstLessonFilename(setManifest)}`,
      token,
    );
    const lesson = (JSON.parse(lessonText) ?? {}) as ParsedLesson;
    const known = new Set<string>(KNOWN_EXERCISE_TYPES);
    for (const type of lessonExerciseTypes(lesson)) {
      if (!known.has(type)) {
        return {
          ok: false,
          setCount: sets.length,
          lessonCount,
          reason: `Unknown exercise_type "${type}".`,
        };
      }
    }
  } catch {
    return {
      ok: false,
      setCount: sets.length,
      lessonCount,
      reason: "Could not read the first set's lessons.",
    };
  }

  return { ok: true, setCount: sets.length, lessonCount };
}
