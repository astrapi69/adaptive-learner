/**
 * Content-repo export serialization (#1017).
 *
 * Turns a downloaded set + its lessons into the file map of the OFFICIAL
 * content-repo format (`astrapi69/adaptive-learner-content`), so an
 * exported repository is immediately usable as a content source via
 * Settings → Integrations → Add repository:
 *
 *   manifest.yaml         set metadata
 *   lessons/NN-slug.json  one file per lesson (verbatim)
 *   search-index.json     auto-generated discover entry
 *   README.md             auto-generated install + lesson list
 *
 * Pure (no network, no storage) so the format is unit-testable and stays
 * 100% compatible with the loader that parses these same files on import.
 */

import {stringify as stringifyYaml} from "yaml";

import type {ContentLesson, ContentSetEntry} from "../../storage/types";

/** One file to commit to the export repository. */
export interface RepoExportFile {
    path: string;
    content: string;
}

/** A lesson plus the filename it should keep in `lessons/`. */
export interface RepoExportLesson {
    filename: string;
    lesson: ContentLesson;
}

export interface RepoExportInput {
    set: ContentSetEntry;
    lessons: RepoExportLesson[];
    /** ``owner/repo`` of the target repository (for the README + index). */
    ownerRepo: string;
}

/** Schema version stamped on the exported manifest (the loader matches on
 *  the major, so a 1.x set imports cleanly). */
const EXPORT_SCHEMA_VERSION = "1.4";

/** Total card count across the lessons (for the search index + README). */
function totalCards(lessons: readonly RepoExportLesson[]): number {
    return lessons.reduce((sum, l) => sum + (l.lesson.cards?.length ?? 0), 0);
}

/** Build the set-level ``manifest.yaml`` body. */
export function buildManifestYaml(
    set: ContentSetEntry,
    lessonCount: number,
): string {
    // Only emit fields the loader reads; omit empties so the file stays
    // clean. ``name`` is the source-language title (the loader's title key).
    const manifest: Record<string, unknown> = {
        schema_version: EXPORT_SCHEMA_VERSION,
        name: set.title,
        source_language: set.source_language,
        target_language: set.target_language,
        level: set.level,
        domain: set.domain || "language",
        lesson_count: lessonCount,
        version: set.version || "1.0.0",
    };
    if (set.title_native) manifest.title_native = set.title_native;
    if (set.description) manifest.description = set.description;
    if (set.tags && set.tags.length > 0) manifest.tags = set.tags;
    if (set.book) manifest.book = set.book;
    return stringifyYaml(manifest);
}

/** Build the repo-root ``search-index.json`` (one entry for this set). */
export function buildSearchIndexJson(input: RepoExportInput): string {
    const {set, lessons} = input;
    const index = {
        generated_at: new Date().toISOString(),
        sets: [
            {
                id: set.id,
                name: set.title,
                description: set.description ?? "",
                source_language: set.source_language,
                target_language: set.target_language,
                level: set.level,
                domain: set.domain || "language",
                lesson_count: lessons.length,
                card_count: totalCards(lessons),
                tags: set.tags ?? [],
                ...(set.book ? {book: set.book} : {}),
            },
        ],
    };
    return JSON.stringify(index, null, 2) + "\n";
}

/** Build the auto-generated ``README.md``. */
export function buildReadme(input: RepoExportInput): string {
    const {set, lessons, ownerRepo} = input;
    const cards = totalCards(lessons);
    const lines: string[] = [
        `# ${set.title}`,
        "",
        "Learning set for Adaptive Learner.",
        "",
        `- ${lessons.length} lessons, ${cards} cards`,
        `- Language: ${set.source_language} → ${set.target_language}`,
        `- Level: ${set.level}`,
        `- Domain: ${set.domain || "language"}`,
        "",
        "## Installation",
        "",
        "1. Open Adaptive Learner",
        "2. Settings → Integrations → Add repository",
        `3. Repository URL: https://github.com/${ownerRepo}`,
        "4. If private: add your GitHub token in Settings",
        "",
        "## Lessons",
        "",
    ];
    lessons.forEach((l, i) => {
        const count = l.lesson.cards?.length ?? 0;
        lines.push(`${i + 1}. ${l.lesson.title} (${count} cards)`);
    });
    lines.push("");
    return lines.join("\n");
}

/** Slugify a lesson filename safely (keep an existing valid name, else
 *  derive one from the title). */
export function lessonFilename(
    lesson: ContentLesson,
    fallbackFilename: string,
    index: number,
): string {
    if (fallbackFilename && fallbackFilename.endsWith(".json")) {
        return fallbackFilename;
    }
    const slug = (lesson.title || `lesson-${index + 1}`)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || `lesson-${index + 1}`;
    const nn = String(index + 1).padStart(2, "0");
    return `${nn}-${slug}.json`;
}

/**
 * Build the full content-repo file map for ``input``.
 *
 * @param input - The set, its lessons (with filenames), and target repo.
 * @returns The ordered list of files to commit.
 */
export function buildRepoExportFiles(
    input: RepoExportInput,
): RepoExportFile[] {
    const files: RepoExportFile[] = [
        {
            path: "manifest.yaml",
            content: buildManifestYaml(input.set, input.lessons.length),
        },
    ];
    input.lessons.forEach((l, i) => {
        files.push({
            path: `lessons/${lessonFilename(l.lesson, l.filename, i)}`,
            content: JSON.stringify(l.lesson, null, 2) + "\n",
        });
    });
    files.push({
        path: "search-index.json",
        content: buildSearchIndexJson(input),
    });
    files.push({path: "README.md", content: buildReadme(input)});
    return files;
}
