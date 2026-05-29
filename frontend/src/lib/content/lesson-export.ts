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

/** Build a pre-filled GitHub issue URL for the community contribution
 *  pathway. The maintainer reviews + adds the lesson to the official
 *  content repo manually (no auto-publish). */
export function communityIssueUrl(
  repo: string,
  meta: ExportSetMeta,
  lessonCount: number,
): string {
  const title = `New lesson: ${meta.title} (${meta.language} ${meta.level})`;
  const body = [
    `**Title:** ${meta.title}`,
    `**Language:** ${meta.language}`,
    `**Level:** ${meta.level}`,
    `**Lessons:** ${lessonCount}`,
    meta.description ? `**Description:** ${meta.description}` : "",
    "",
    "I created this lesson from my own learning and would like to share it.",
    "",
    "**How to contribute it:**",
    "1. I'll attach the exported content-set ZIP (or paste the lesson JSON) below.",
    "2. Maintainer: review the lesson, then add it to the content repo under `sets/`.",
    "",
    "_Exported from Adaptive Learner — My Lessons > Share with Community._",
  ]
    .filter((line) => line !== null)
    .join("\n");
  const params = new URLSearchParams({ title, body });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
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
