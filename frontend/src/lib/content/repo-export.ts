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

import {
    isKnownContentDomain as engineIsKnownContentDomain,
    lessonIdOrderingIssues,
    validateManifest,
} from "learn-content-engine";
import {parse as parseYaml, stringify as stringifyYaml} from "yaml";

import {
    DEFAULT_DOMAIN,
    normalizeLevel,
} from "./content-domains";
import {CURRENT_MANIFEST_SCHEMA_VERSION} from "./schema-version";
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

/**
 * ``schema_version`` for the root ``search-index.json`` (#2300). This is the
 * INDEX format version, independent of the manifest/lesson schema version
 * above: the canonical generator (``generate_search_index.py`` in the content
 * repo) emits ``"1.0"`` — pinned by the ``__fixtures__/search-index-official.json``
 * round-trip test so a re-mirror that bumps it fails loudly here.
 */
const SEARCH_INDEX_SCHEMA_VERSION = "1.0";

/** Total card count across the lessons (for the search index + README). */
function totalCards(lessons: readonly RepoExportLesson[]): number {
    return lessons.reduce((sum, l) => sum + (l.lesson.cards?.length ?? 0), 0);
}

/**
 * The content domain to WRITE into an exported repo (#2376 class 2).
 *
 * ``set.domain`` can carry app-internal origin values ("imported" from
 * "My lessons") that are not content domains - ``KNOWN_CONTENT_DOMAINS``
 * does not know them, and the Discover filter would receive a domain that
 * does not exist. Only domains the engine knows (the language default
 * included) pass through; anything else falls back to ``knowledge`` when
 * source == target (a same-language set, e.g. a book, would fail the
 * language-pair validation as ``language``) and ``language`` otherwise.
 */
export function exportDomain(set: ContentSetEntry): string {
    const value = (set.domain || "").trim().toLowerCase();
    // #3397 - the engine's own answer; it counts the language default as
    // known, and an empty value is not a domain to write.
    if (value && engineIsKnownContentDomain(value)) return value;
    const source = (set.source_language || "").split("-")[0].toLowerCase();
    const target = (set.target_language || "").split("-")[0].toLowerCase();
    if (source && target && source === target) return "knowledge";
    return DEFAULT_DOMAIN;
}

/**
 * The content domain to WRITE into an exported lesson file (#3242).
 *
 * The Dexie read path injects the set row's ``domain`` into a lesson that
 * carries none, and a user set stores its ORIGIN there (``imported``,
 * ``analysis``, ``adaptive``), so the parsed lesson arrives with the origin
 * marker as its domain and #2425's filter on the set-level files left the
 * lesson files contradicting the manifest. A lesson's own known domain and
 * the default language domain pass through; a lesson without a domain
 * stays without one (the API-mode shape, the manifest is authoritative);
 * anything else becomes the set's export domain, so lesson and manifest
 * agree, as the community share wizard already does for the lessons it
 * ships.
 */
export function exportLessonDomain(
    lesson: ContentLesson,
    set: ContentSetEntry,
): string | undefined {
    const raw = (lesson as {domain?: unknown}).domain;
    if (raw === undefined || raw === null) return undefined;
    const value = String(raw).trim().toLowerCase();
    if (value && engineIsKnownContentDomain(value)) return value;
    return exportDomain(set);
}

function lessonForExport(
    lesson: ContentLesson,
    set: ContentSetEntry,
): ContentLesson {
    const domain = exportLessonDomain(lesson, set);
    if (domain === undefined) {
        const {domain: _dropped, ...rest} = lesson as ContentLesson & {domain?: unknown};
        return rest as ContentLesson;
    }
    return {...lesson, domain} as ContentLesson;
}

/** Repo-relative directory of the exported set (#3403). ``sets/{id}`` is
 *  also where readers look when a manifest names no ``path``. */
function exportSetPath(set: ContentSetEntry): string {
    return `sets/${set.id}`;
}

/** The set's entry in a manifest's ``sets`` list. Only fields the
 *  manifest schema knows; empties are omitted so the file stays clean. */
function manifestSetEntry(set: ContentSetEntry, lessonCount: number): Record<string, unknown> {
    const entry: Record<string, unknown> = {
        id: set.id,
        title: set.title,
        target_language: set.target_language,
        source_language: set.source_language,
        level: normalizeLevel(set.level),
        domain: exportDomain(set),
        version: set.version || "1.0.0",
        lesson_count: lessonCount,
        path: exportSetPath(set),
    };
    if (set.title_native) entry.title_native = set.title_native;
    if (set.description) entry.description = set.description;
    if (set.tags && set.tags.length > 0) entry.tags = set.tags;
    if (set.book) entry.book = set.book;
    return entry;
}

/** Build the repo-root ``manifest.yaml``: the repo name plus the one
 *  exported set and its ``path`` (#3403 - the canonical ``sets`` shape;
 *  flat root keys failed the engine's ``validateManifest``). */
export function buildManifestYaml(
    set: ContentSetEntry,
    lessonCount: number,
): string {
    const manifest: Record<string, unknown> = {
        schema_version: CURRENT_MANIFEST_SCHEMA_VERSION,
        name: set.title,
        ...(set.description ? {description: set.description} : {}),
        sets: [manifestSetEntry(set, lessonCount)],
    };
    return stringifyYaml(manifest);
}

/** Build the set-level ``manifest.yaml`` under {@link exportSetPath}: the
 *  same set entry plus ``metadata.lessons``, the files readers download. */
function buildSetManifestYaml(
    set: ContentSetEntry,
    lessonFilenames: readonly string[],
): string {
    const manifest: Record<string, unknown> = {
        schema_version: CURRENT_MANIFEST_SCHEMA_VERSION,
        name: set.title,
        sets: [manifestSetEntry(set, lessonFilenames.length)],
        metadata: {lessons: [...lessonFilenames]},
    };
    return stringifyYaml(manifest);
}

/** Refuse to export a manifest the engine rejects: a repo nobody can load
 *  is worse than an export that stops with the engine's reasons. */
function assertValidManifest(path: string, content: string): void {
    const verdict = validateManifest(parseYaml(content));
    if (verdict.valid) return;
    const reasons = verdict.errors.map((e) => `${e.path || "/"} ${e.message}`).join("; ");
    throw new Error(`${path} is not a valid content manifest: ${reasons}`);
}

/** Build the repo-root ``search-index.json`` (one entry for this set).
 *
 * Matches the canonical index format (``schema/search-index.schema.json`` in
 * the content repo, whose root ``required`` is ``[repo, schema_version,
 * sets]``): #2300 - the earlier export omitted ``repo`` + ``schema_version``,
 * so ``scripts/validate_registered_repo.py`` rejected an app-exported repo on
 * two missing required fields (and ``RegistrySubmitSection`` read no
 * ``index_schema_version``), through no fault of the author.
 *
 * Per-set enrichment fields the canonical generator also emits -
 * ``visibility``, ``review_status``, ``ai_validated``, ``trust_level``,
 * ``updated_at`` - are deliberately NOT written here: the read side
 * ({@link ./repos/search-index-loader} ``parseSearchIndex``) normalises their
 * absence (visible / authored / registry-floored trust / null), and the app
 * cannot honestly self-assign them - ``trust_level`` is the registry's to
 * grant, ``review_status`` / ``ai_validated`` are author-workflow signals the
 * export does not know. They are omitted, not forgotten.
 */
export function buildSearchIndexJson(input: RepoExportInput): string {
    const {set, lessons, ownerRepo} = input;
    const index = {
        repo: ownerRepo,
        generated: new Date().toISOString(),
        schema_version: SEARCH_INDEX_SCHEMA_VERSION,
        sets: [
            {
                id: set.id,
                name: set.title,
                description: set.description ?? "",
                source_language: set.source_language,
                target_language: set.target_language,
                level: normalizeLevel(set.level),
                domain: exportDomain(set),
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
        `- Domain: ${exportDomain(set)}`,
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

/** The chosen lesson filenames plus whether they had to be renamed. */
export interface LessonFilenamePlan {
    /** One filename per input lesson, in source order. */
    filenames: string[];
    /** True when ordering prefixes were (re)assigned because the existing
     *  names did not sort into the source order. */
    reordered: boolean;
}

/**
 * Choose the exported lesson filenames (#2376 class 1).
 *
 * The display order of a set is the LEXICOGRAPHIC sort of the lesson ids
 * (learn-content-engine#106), so ``kapitel-1..kapitel-14 + epilog`` exported
 * verbatim displays as ``epilog, kapitel-1, kapitel-10..``. Existing names
 * are kept ONLY when their sort order already reproduces the source order;
 * otherwise every lesson gets a fresh ``NN-`` prefix (replacing any stale
 * numeric prefix, never stacking a second one).
 *
 * #3401 - "sort order" is the code-unit order every reader uses
 * (``.sort()``, Python ``sorted``), not a locale-aware one, and a set the
 * engine's ``lessonIdOrderingIssues`` flags (mixed prefixes, mixed prefix
 * widths, numbers that read differently than they sort) is renumbered too.
 */
export function planLessonFilenames(
    lessons: readonly RepoExportLesson[],
): LessonFilenamePlan {
    const chosen = lessons.map((l, i) =>
        lessonFilename(l.lesson, l.filename, i),
    );
    const inOrder = chosen.every((name, i) => i === 0 || chosen[i - 1] < name);
    const ids = chosen.map((name) => name.replace(/\.json$/, ""));
    if (inOrder && lessonIdOrderingIssues(ids).length === 0) {
        return {filenames: chosen, reordered: false};
    }
    const width = Math.max(2, String(lessons.length).length);
    const filenames = chosen.map((name, i) => {
        const base = name.replace(/^\d+-/, "");
        return `${String(i + 1).padStart(width, "0")}-${base}`;
    });
    return {filenames, reordered: true};
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
    const plan = planLessonFilenames(input.lessons);
    const setPath = exportSetPath(input.set);
    const files: RepoExportFile[] = [
        {
            path: "manifest.yaml",
            content: buildManifestYaml(input.set, input.lessons.length),
        },
        {
            path: `${setPath}/manifest.yaml`,
            content: buildSetManifestYaml(input.set, plan.filenames),
        },
    ];
    for (const manifest of files) assertValidManifest(manifest.path, manifest.content);
    input.lessons.forEach((l, i) => {
        files.push({
            path: `${setPath}/lessons/${plan.filenames[i]}`,
            content: JSON.stringify(lessonForExport(l.lesson, input.set), null, 2) + "\n",
        });
    });
    files.push({
        path: "search-index.json",
        content: buildSearchIndexJson(input),
    });
    files.push({path: "README.md", content: buildReadme(input)});
    return files;
}
