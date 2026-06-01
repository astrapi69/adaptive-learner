/**
 * Lesson export + sharing (Phase 59D / v1.42.0; PR pathway Phase 65).
 *
 * Turns a user-generated lesson (or set) into shareable artefacts:
 *
 *   - a standalone lesson JSON file (schema v1.1, plays independently)
 *   - a full content-set ZIP (manifest.yaml + lessons/) that another
 *     user can import OR that can be submitted to the content repo
 *   - a pre-filled GitHub PULL REQUEST pathway (NOT an issue): the
 *     lesson JSON lands at the correct path in the content tree, the
 *     repo's CI validation runs automatically, and the maintainer
 *     just reviews + merges. Two flavours (Option C hybrid):
 *       * small lessons fit in a GitHub "create new file" URL
 *         (``communityPrUrl``) — the commit message + description
 *         pre-fill the PR title + body; GitHub auto-forks for
 *         non-collaborators. Zero auth, zero token.
 *       * large lessons overflow the URL, so the caller downloads
 *         the JSON and opens the repo's "upload files" page
 *         (``communityUploadUrl``); the user drag-drops the file.
 *
 * Exported artefacts contain ZERO user data: only the clean lesson
 * content (no error history, no progress, no user id). The pure
 * builders below are unit-tested; ``triggerDownload`` is the only
 * DOM-touching part and is kept separate.
 */

import { stringify as stringifyYaml } from "yaml";

import type { ContentLesson } from "../../storage/types";
import { slugify } from "./analysis-to-lesson";

/** Metadata describing a set to export (mirrors the saved set). */
export interface ExportSetMeta {
  set_id: string;
  title: string;
  language: string;
  level: string;
  description?: string | null;
}

/** Filename for a single-lesson JSON export: ``{topic-slug}-lesson.json``. */
export function lessonFileName(title: string): string {
  const slug = slugify(title) || "lesson";
  return `${slug}-lesson.json`;
}

/** Pretty-printed lesson JSON (clean content only — a ContentLesson
 *  carries no user data by construction). */
export function lessonJson(lesson: ContentLesson): string {
  return JSON.stringify(lesson, null, 2);
}

/** Build the one-entry ContentManifest YAML for a content-set export.
 *  Mirrors the per-set cached manifest the loader reads, so the ZIP
 *  re-imports cleanly. */
export function buildManifestYaml(
  meta: ExportSetMeta,
  lessonCount: number,
): string {
  const manifest = {
    schema_version: "1.1",
    name: meta.title,
    description: meta.description ?? null,
    sets: [
      {
        id: slugify(meta.set_id) || "lesson-set",
        title: meta.title,
        language: meta.language,
        level: meta.level,
        version: "1.0.0",
        lesson_count: lessonCount,
        domain: "user-generated",
        description: meta.description ?? null,
        tags: [],
      },
    ],
    metadata: { author: "user", origin: "shared" },
  };
  return stringifyYaml(manifest);
}

/** Build a content-set ZIP blob: ``manifest.yaml`` + ``lessons/{id}.json``.
 *  ``async`` because JSZip is dynamically imported (matches the
 *  notebooklm / anki exporters). */
export async function buildContentSetZip(
  meta: ExportSetMeta,
  lessons: ContentLesson[],
): Promise<Blob> {
  const JSZipMod = (await import("jszip")).default;
  const zip = new JSZipMod();
  zip.file("manifest.yaml", buildManifestYaml(meta, lessons.length));
  const lessonsDir = zip.folder("lessons");
  for (const lesson of lessons) {
    lessonsDir?.file(`${lesson.id}.json`, lessonJson(lesson));
  }
  return zip.generateAsync({ type: "blob" });
}

/** ZIP filename for a content-set export: ``{set-slug}-set.zip``. */
export function contentSetFileName(title: string): string {
  const slug = slugify(title) || "lesson-set";
  return `${slug}-set.zip`;
}

/** Context for the community pull request: where the lesson lands in
 *  the source-language tree, how it scored in validation, and the
 *  metadata the maintainer needs to review + merge. */
export interface CommunityPrDetails {
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  /** Repo-relative FILE path the lesson lands at, e.g.
   *  ``sets/de/fr-a1/lessons/16-konjugation.json``. */
  filePath: string;
  exerciseCount: number;
  cardCount: number;
  lessonCount: number;
  /** e.g. "AI-validated: yes, quality_score: 0.85" — omitted when
   *  the user didn't run the AI review. */
  aiSummary?: string;
  /** Rule-based validation issues the user acknowledged before
   *  sharing anyway. Absent when the check passed. */
  validationIssues?: string[];
  /** Optional author credit (Phase 64C-2). */
  author?: string;
  /** Optional lesson description. */
  description?: string | null;
}

/** PR title for a community lesson contribution:
 *  ``content: {title} ({source}->{target} {level})``. */
export function buildPrTitle(details: CommunityPrDetails): string {
  return `content: ${details.title} (${details.sourceLanguage}->${details.targetLanguage} ${details.level})`;
}

/** Build the Markdown PR body (the maintainer-facing summary). Used
 *  both as the ``description=`` param on the create-file URL (so the
 *  PR body pre-fills) and as the "copy this into the PR description"
 *  text on the large-lesson upload path. */
export function buildPrBody(details: CommunityPrDetails): string {
  const lines: string[] = [
    "## New lesson",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Title | ${details.title} |`,
    `| Source language | ${details.sourceLanguage} |`,
    `| Target language | ${details.targetLanguage} |`,
    `| Level | ${details.level} |`,
    `| Lessons | ${details.lessonCount} |`,
    `| Cards | ${details.cardCount} |`,
    `| Exercises | ${details.exerciseCount} |`,
    ...(details.author ? [`| Contributed by | ${details.author} |`] : []),
    "",
    `**Placement:** \`${details.filePath}\``,
    "",
    details.validationIssues && details.validationIssues.length > 0
      ? `**Validation:** ⚠ shared with warnings${details.aiSummary ? ` · ${details.aiSummary}` : ""}`
      : `**Validation:** schema 1.2 ✓ · quality ✓${details.aiSummary ? ` · ${details.aiSummary}` : ""}`,
  ];
  if (details.validationIssues && details.validationIssues.length > 0) {
    lines.push("", "**Quality-check findings (acknowledged by author):**");
    for (const issue of details.validationIssues) {
      lines.push(`- ${issue}`);
    }
  }
  if (details.description) {
    lines.push("", `**Description:** ${details.description}`);
  }
  lines.push(
    "",
    "_Created with Adaptive Learner — My Lessons > Share with Community._",
    "_The content-repo CI validation runs automatically on this PR._",
  );
  return lines.join("\n");
}

/** Conservative URL-length cap for the GitHub Web new-file editor.
 *  GitHub itself accepts more, but mobile browsers and a few
 *  proxies/servers refuse much beyond this. When the JSON (plus the
 *  pre-filled PR title + body) would push the URL over this, callers
 *  fall back to the download + upload-page path. */
export const MAX_PR_URL_LENGTH = 8000;

/** Shape the GitHub Web new-file editor expects. */
export interface CommunityPrUrlArgs {
  /** ``owner/repo``. */
  repo: string;
  /** Default branch of the content repo (``main`` for the official
   *  one; configurable so docs/tests can pin a different branch). */
  branch: string;
  /** Repo-relative FILE path the lesson lands at, e.g.
   *  ``sets/de/fr-a1/lessons/16-konjugation.json`` — built by the
   *  caller from the placement engine (auto-numbered, slugged). */
  filePath: string;
  /** The lesson to ship; its full JSON lands in ``?value=``. */
  lesson: ContentLesson;
  /** Pre-fills the commit message + PR title. */
  prTitle: string;
  /** Pre-fills the commit description + PR body (Markdown). */
  prBody: string;
}

/** Build the GitHub Web "new file" URL that opens a commit editor
 *  with the file path + JSON content pre-filled, plus the commit
 *  message + description (which seed the PR title + body). The user
 *  clicks "Propose new file"; GitHub auto-forks for non-collaborators
 *  and opens the PR draft — zero auth, zero token.
 *
 *  Returns ``null`` when the URL would exceed ``MAX_PR_URL_LENGTH``,
 *  signalling the caller to fall back to the upload-page path.
 */
export function communityPrUrl(args: CommunityPrUrlArgs): string | null {
  const { repo, branch, filePath, lesson, prTitle, prBody } = args;
  const params = new URLSearchParams({
    filename: filePath,
    value: lessonJson(lesson),
    message: prTitle,
    description: prBody,
  });
  const url = `https://github.com/${repo}/new/${branch}?${params.toString()}`;
  if (url.length > MAX_PR_URL_LENGTH) return null;
  return url;
}

/** GitHub Web "upload files" page for the lesson's target directory.
 *  Used on the large-lesson path: the caller downloads the JSON, then
 *  opens this so the user drag-drops the file. GitHub auto-forks +
 *  opens a PR on "Propose changes". No URL-length limit (the file
 *  content is uploaded, not URL-encoded).
 *
 *  ``dir`` is the repo-relative directory, e.g. ``sets/de/fr-a1/lessons``.
 */
export function communityUploadUrl(
  repo: string,
  branch: string,
  dir: string,
): string {
  return `https://github.com/${repo}/upload/${branch}/${dir}`;
}

/** Trigger a browser download for a blob. The only DOM-touching part;
 *  kept out of the pure builders so those stay unit-testable. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convenience: download a single lesson as JSON. ``filename``
 *  overrides the default ``{slug}-lesson.json`` — the share flow
 *  passes the placement-engine filename (``{nn}-{slug}.json``) so the
 *  downloaded file matches the path the maintainer expects. */
export function downloadLessonJson(
  lesson: ContentLesson,
  filename?: string,
): void {
  const blob = new Blob([lessonJson(lesson)], { type: "application/json" });
  triggerDownload(blob, filename ?? lessonFileName(lesson.title));
}
