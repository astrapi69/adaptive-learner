/**
 * Lesson export + sharing (Phase 59D / v1.42.0).
 *
 * Turns a user-generated lesson (or set) into shareable artefacts:
 *
 *   - a standalone lesson JSON file (schema v1.1, plays independently)
 *   - a full content-set ZIP (manifest.yaml + lessons/) that another
 *     user can import OR that can be submitted to the content repo
 *   - a pre-filled GitHub issue URL for the community contribution
 *     pathway (manual maintainer review — no auto-publish)
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

/** Phase 61 — extra context for the community issue so the
 *  maintainer sees, at a glance, where the lesson lands in the
 *  source-language tree and how it scored in validation. */
export interface CommunityIssueDetails {
  sourceLanguage: string;
  targetLanguage: string;
  /** Repo-relative directory the set lands in (``sets/de/fr-a1``). */
  placement: string;
  exerciseCount: number;
  cardCount: number;
  /** e.g. "AI-validated: yes, quality_score: 0.85" — omitted when
   *  the user didn't run the AI review. */
  aiSummary?: string;
  /** Rule-based validation issues the user acknowledged before
   *  sharing anyway. Rendered in the issue body so the maintainer
   *  sees what the rule-based check flagged; absent when the
   *  check passed. */
  validationIssues?: string[];
}

/** Build a pre-filled GitHub issue URL for the community contribution
 *  pathway. The maintainer reviews + adds the lesson to the official
 *  content repo manually (no auto-publish). */
export function communityIssueUrl(
  repo: string,
  meta: ExportSetMeta,
  lessonCount: number,
  details?: CommunityIssueDetails,
): string {
  const title = `New lesson: ${meta.title} (${meta.language} ${meta.level})`;
  const lines: string[] = [];
  if (details) {
    // Tree placement first — the maintainer's primary question.
    lines.push(
      `**Placement:** \`${details.placement}/\` (${details.sourceLanguage} → ${details.targetLanguage}, ${meta.level})`,
      "",
      "| Field | Value |",
      "|---|---|",
      `| Title | ${meta.title} |`,
      `| Source language | ${details.sourceLanguage} |`,
      `| Target language | ${details.targetLanguage} |`,
      `| Level | ${meta.level} |`,
      `| Lessons | ${lessonCount} |`,
      `| Cards | ${details.cardCount} |`,
      `| Exercises | ${details.exerciseCount} |`,
      "",
      details.validationIssues && details.validationIssues.length > 0
        ? `**Validation:** ⚠ shared with warnings${details.aiSummary ? ` · ${details.aiSummary}` : ""}`
        : `**Validation:** schema ✓ · quality ✓${details.aiSummary ? ` · ${details.aiSummary}` : ""}`,
    );
    if (details.validationIssues && details.validationIssues.length > 0) {
      lines.push("", "**Quality-check findings (acknowledged by author):**");
      for (const issue of details.validationIssues) {
        lines.push(`- ${issue}`);
      }
    }
    if (meta.description) lines.push("", `**Description:** ${meta.description}`);
  } else {
    lines.push(
      `**Title:** ${meta.title}`,
      `**Language:** ${meta.language}`,
      `**Level:** ${meta.level}`,
      `**Lessons:** ${lessonCount}`,
      meta.description ? `**Description:** ${meta.description}` : "",
    );
  }
  const body = [
    ...lines,
    "",
    "I created this lesson from my own learning and would like to share it.",
    "",
    "**How to contribute it:**",
    "1. I'll attach the exported content-set ZIP (or paste the lesson JSON) below.",
    "2. Maintainer: review the lesson, then add it to the content repo under `sets/`.",
    "",
    "_Exported from Adaptive Learner — My Lessons > Share with Community._",
  ].join("\n");
  const params = new URLSearchParams({ title, body });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

/** Conservative URL-length cap for the GitHub Web new-file editor.
 *  GitHub itself accepts more, but mobile browsers and a few
 *  proxies/servers refuse much beyond this. When the JSON would
 *  push the URL over this, callers should fall back to the
 *  Issue + attachment path. */
export const MAX_PR_URL_LENGTH = 8000;

/** Shape the GitHub Web new-file editor expects. */
export interface CommunityPrUrlArgs {
  /** ``owner/repo``. */
  repo: string;
  /** Default branch of the content repo (``main`` for the official
   *  one; configurable so docs/tests can pin a different branch). */
  branch: string;
  /** Repo-relative directory like ``sets/de/de-b1`` from
   *  ``treePlacement(...).path``. The function appends
   *  ``/lessons/{filename}``. */
  placement: string;
  /** The lesson to ship. Its title drives the filename slug; its
   *  full JSON shape lands in ``?value=``. */
  lesson: ContentLesson;
}

/** Build the GitHub Web "new file" URL that opens a commit editor
 *  with the file path + JSON content pre-filled. The user clicks
 *  "Commit changes", GitHub auto-forks for non-collaborators and
 *  opens the PR draft — zero auth required.
 *
 *  Returns ``null`` when the URL would exceed ``MAX_PR_URL_LENGTH``,
 *  signalling the caller to fall back to ``communityIssueUrl``.
 *  Otherwise returns the ready-to-open URL.
 */
export function communityPrUrl(args: CommunityPrUrlArgs): string | null {
  const { repo, branch, placement, lesson } = args;
  const filename = `${placement}/lessons/${lessonFileName(lesson.title)}`;
  const value = lessonJson(lesson);
  const params = new URLSearchParams({ filename, value });
  const url = `https://github.com/${repo}/new/${branch}?${params.toString()}`;
  if (url.length > MAX_PR_URL_LENGTH) return null;
  return url;
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

/** Convenience: download a single lesson as JSON. */
export function downloadLessonJson(lesson: ContentLesson): void {
  const blob = new Blob([lessonJson(lesson)], { type: "application/json" });
  triggerDownload(blob, lessonFileName(lesson.title));
}
