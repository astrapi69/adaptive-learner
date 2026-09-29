/**
 * GitHub content-repository fetch + simplified validation (EXP-023 Phase A,
 * commit 2).
 *
 * Runs client-side in both storage modes: given an ``{owner, repo, branch}``
 * it fetches the repo's ``manifest.yaml`` from GitHub, checks the expected
 * structure (a ``sets`` array), a compatible schema major, and that a
 * sampled lesson is one this app loads and renders (the shape layer and the
 * engine's rules, #3243). Returns a result the
 * Settings UI renders as "Validation passed: X sets, Y lessons" or the
 * failure reason.
 *
 * Auth + CORS: fetching is delegated to ``github-fetch`` (#645), which picks
 * the host by auth — public repos hit ``raw.githubusercontent.com`` with NO
 * custom headers (no CORS preflight), private/coach repos hit the
 * ``api.github.com`` contents endpoint with the Bearer token. In API mode the
 * token lives server-side and is not read here, so Phase A validates public
 * user repos client-side (private-repo support in API mode is a Phase B
 * concern).
 */

import {
  parseManifest,
  setBasePath,
  type ParsedManifest,
  type ParsedSet,
} from "../engine";
import { fetchGitHubFileText } from "./github-fetch";
import { resolveRepoToken } from "./repo-token";

/** Schema major the app understands (CURRENT_SCHEMA_VERSION is 1.x). */
const SUPPORTED_SCHEMA_MAJOR = 1;

/**
 * Patterns that must not appear in lesson content (EXP-023 Phase B —
 * "no executable code"). Content is plain JSON rendered as markdown/text;
 * a script tag / inline handler / eval call signals an untrusted repo.
 */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /<script\b/i,
  /javascript:/i,
  /\bon\w+\s*=\s*["']/i, // inline event handlers (onerror=, onclick=, …)
  /\beval\s*\(/i,
  /\bnew\s+Function\s*\(/i,
];

/** True when ``text`` contains a suspicious (executable) pattern. */
export function hasSuspiciousContent(text: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(text));
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
  /**
   * ``true`` when the failure was an I/O one — the manifest / sample lesson
   * could not be FETCHED (network, unreachable, rate-limit, 4xx/5xx) — rather
   * than a STRUCTURAL content problem (bad schema, no sets, no lessons,
   * executable content, unknown exercise type). A transient failure means the
   * repo could not be re-validated, NOT that it is invalid, so a caller must
   * not demote a previously-good repo on it (#1441). Absent/false on a
   * structural failure and on success.
   */
  transient?: boolean;
}

/** The GitHub ``"{owner}/{repo}"`` source identifier for a repo ref. */
function refSource(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

/** Fetch a repo text file via the CORS-safe shared helper. */
function fetchRepoText(
  ref: RepoRef,
  path: string,
  token: string,
): Promise<string> {
  return fetchGitHubFileText(refSource(ref), ref.branch, path, token);
}

/**
 * The verdict on the sampled lesson (#3243): the app's shape layer (the
 * schema, the slug ids, the extension load guard - undeclared and unadopted
 * types) and then the engine's semantic rules with the app's extension
 * registry, exactly what the lesson funnel runs before a save. Returns the
 * first error, or ``null`` when the lesson would load and render.
 *
 * The validators are imported on demand: this module sits in the entry
 * chunk (the sync path and the settings sections import it), and a static
 * import would put the ajv validator and the rules module there (#3222's
 * bundle condition). A chunk that cannot be loaded is an I/O failure and
 * surfaces as such, never as a verdict on the content.
 */
async function judgeSampledLesson(lesson: unknown): Promise<string | null> {
  const [{ validateLessonShape }, { validateLessonRules }, { APP_EXTENSION_REGISTRY }] =
    await Promise.all([
      import("../validation/lesson-schema-validator"),
      import("learn-content-engine/rules"),
      import("../validation/engine-extensions"),
    ]);
  const shape = validateLessonShape(lesson);
  if (!shape.ok) return shape.errors[0] ?? "the lesson does not match the schema";
  const { errors } = validateLessonRules(lesson as Parameters<typeof validateLessonRules>[0], {
    extensions: APP_EXTENSION_REGISTRY,
  });
  const first = errors[0];
  return first ? `${first.path} ${first.message}` : null;
}

function firstLessonFilename(setManifest: ParsedManifest): string {
  const lessons = setManifest.metadata?.lessons;
  if (Array.isArray(lessons) && typeof lessons[0] === "string") {
    return lessons[0];
  }
  return "01.json";
}

/** One set advertised by a repo's own ``manifest.yaml`` (#1388). */
export interface RepoManifestSet {
  id: string;
  lessonCount: number;
}

/**
 * Read the set list from ONE repository's own ``manifest.yaml`` (#1388).
 *
 * This is the source-isolated counterpart to ``listSets()``: it touches
 * exactly the given repo (same CORS-safe fetch {@link validateUserRepo}
 * uses in both storage modes), so a per-repo sync generates no network
 * traffic to any other configured source. THROWS when the repo is
 * unreachable / has no manifest — the caller reports the failure at the
 * affected row and other repos stay untouched.
 */
export async function listRepoManifestSets(
  ref: RepoRef,
  token: string = resolveRepoToken(refSource(ref)),
): Promise<RepoManifestSet[]> {
  const text = await fetchRepoText(ref, "manifest.yaml", token);
  const manifest = parseManifest(text) ?? {};
  const sets = Array.isArray(manifest.sets) ? manifest.sets : [];
  return sets
    .filter(
      (set): set is ParsedSet & { id: string } =>
        typeof set.id === "string" && set.id.trim() !== "",
    )
    .map((set) => ({ id: set.id, lessonCount: set.lesson_count ?? 0 }));
}

/**
 * Fetch + validate a GitHub content repository. Never throws — every
 * failure mode resolves to ``{ok: false, reason}`` so the caller can show
 * the reason without a try/catch.
 */
export async function validateUserRepo(
  ref: RepoRef,
  token: string = resolveRepoToken(refSource(ref)),
): Promise<RepoValidationResult> {
  let manifest: ParsedManifest;
  try {
    const text = await fetchRepoText(ref, "manifest.yaml", token);
    manifest = parseManifest(text) ?? {};
  } catch (error) {
    const status = (error as { status?: number }).status;
    const reason =
      status === 404
        ? "Repository or manifest.yaml not found."
        : status === 401 || status === 403
          ? "Access denied - check the repository and your GitHub token."
          : "Repository unreachable.";
    // Could not FETCH the manifest → transient I/O, not a content verdict.
    return { ok: false, setCount: 0, lessonCount: 0, reason, transient: true };
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
  if (lessonCount < 1) {
    return {
      ok: false,
      setCount: sets.length,
      lessonCount: 0,
      reason: "No lessons found in any set.",
    };
  }

  // Sample the first set's first lesson: no executable content, and a
  // lesson this app would load and render (shape layer + engine rules).
  const firstSet = sets[0];
  let lesson: unknown;
  try {
    const base = setBasePath(firstSet);
    const setManifestText = await fetchRepoText(
      ref,
      `${base}/manifest.yaml`,
      token,
    );
    const setManifest = parseManifest(setManifestText) ?? {};
    const lessonText = await fetchRepoText(
      ref,
      `${base}/lessons/${firstLessonFilename(setManifest)}`,
      token,
    );
    if (hasSuspiciousContent(lessonText)) {
      return {
        ok: false,
        setCount: sets.length,
        lessonCount,
        reason: "Lesson content contains disallowed executable code.",
      };
    }
    lesson = JSON.parse(lessonText) ?? {};
  } catch (error) {
    // An HttpError carries a ``status`` — the fetch could not complete
    // (transient I/O). A ``JSON.parse`` SyntaxError has no status — the lesson
    // WAS read but is malformed content (structural). Only the former must
    // preserve a good repo's trust (#1441).
    const transient = typeof (error as { status?: number }).status === "number";
    return {
      ok: false,
      setCount: sets.length,
      lessonCount,
      reason: transient
        ? "Could not read the first set's lessons."
        : "The first set's first lesson is not valid JSON.",
      transient,
    };
  }

  let verdict: string | null;
  try {
    verdict = await judgeSampledLesson(lesson);
  } catch {
    // The validator chunk could not be loaded (offline, a stale deploy):
    // the lesson was not judged, so a good repo keeps its trust (#1441).
    return {
      ok: false,
      setCount: sets.length,
      lessonCount,
      reason: "Could not load the lesson validator.",
      transient: true,
    };
  }
  if (verdict !== null) {
    return {
      ok: false,
      setCount: sets.length,
      lessonCount,
      reason: `The first set's first lesson fails validation: ${verdict}`,
    };
  }

  return { ok: true, setCount: sets.length, lessonCount };
}
