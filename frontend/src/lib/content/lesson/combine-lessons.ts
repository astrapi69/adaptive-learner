/**
 * Combine several own lessons into one set (#1741).
 *
 * The learner selects several user-generated sets in "Meine Inhalte" and
 * groups their lessons into a NEW own set or appends them to an EXISTING
 * own set. Deterministic + storage-mode-agnostic: the result is a plain
 * ``SaveUserSetInput`` persisted through the same ``saveUserSet`` path as
 * every other user set, so the combined set is automatically compatible
 * with the existing set export (``manifest.yaml`` + ``lessons/``) — no
 * parallel format.
 *
 * Non-destructive: the source sets are never touched here; the caller
 * decides whether to keep them (the default) or remove them separately.
 */

import {slugify} from "../analysis/analysis-to-lesson";
import type {
    ContentLesson,
    ContentSetEntry,
    SaveUserSetInput,
} from "../../../storage/types";

/** One selected source: its set entry + that set's lessons. */
export interface CombineSource {
    entry: ContentSetEntry;
    lessons: ContentLesson[];
}

/** Where the gathered lessons go. */
export type CombineTarget =
    | {
          mode: "new";
          title: string;
          description?: string;
          /** CEFR/level for the new set; defaults to the derived level. */
          level?: string;
      }
    | {
          mode: "existing";
          /** The set to extend (its own lessons are prepended). */
          entry: ContentSetEntry;
          lessons: ContentLesson[];
      };

/** The languages/level a NEW combined set inherits, plus whether the
 *  selection is internally consistent (drives a non-blocking UI hint). */
export interface CombinedLanguages {
    targetLanguage: string;
    sourceLanguage: string;
    level: string;
    /** True when every source shares the same target/source/level. */
    consistent: boolean;
}

/** Flatten the sources' lessons in selection order (no dedupe yet). */
export function gatherLessons(sources: CombineSource[]): ContentLesson[] {
    return sources.flatMap((s) => s.lessons);
}

/** Ensure every lesson has a unique id (== its ``lessons/{id}.json``
 *  filename) so combining two sets that each carry an ``intro`` lesson
 *  doesn't silently overwrite one. The first occurrence keeps its id;
 *  later collisions gain a ``-2`` / ``-3`` … suffix. */
export function dedupeLessonIds(lessons: ContentLesson[]): ContentLesson[] {
    const seen = new Set<string>();
    return lessons.map((lesson) => {
        const base = lesson.id || "lesson";
        if (!seen.has(base)) {
            seen.add(base);
            return lesson;
        }
        let n = 2;
        let candidate = `${base}-${n}`;
        while (seen.has(candidate)) {
            n += 1;
            candidate = `${base}-${n}`;
        }
        seen.add(candidate);
        return {...lesson, id: candidate};
    });
}

function majority(values: string[]): string {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = values[0] ?? "";
    let bestCount = 0;
    for (const [v, c] of counts) {
        if (c > bestCount) {
            best = v;
            bestCount = c;
        }
    }
    return best;
}

/** Derive the new set's languages + level from the selection. Uses the
 *  most common value per field (ties resolve to the first source) and
 *  reports whether the selection was uniform. */
export function deriveCombinedLanguages(
    sources: CombineSource[],
): CombinedLanguages {
    const targets = sources.map((s) => s.entry.target_language);
    const srcs = sources.map((s) => s.entry.source_language);
    const levels = sources.map((s) => s.entry.level);
    const consistent =
        new Set(targets).size <= 1 &&
        new Set(srcs).size <= 1 &&
        new Set(levels).size <= 1;
    return {
        targetLanguage: majority(targets) || "en",
        sourceLanguage: majority(srcs) || "en",
        level: majority(levels) || "A1",
        consistent,
    };
}

/** A set id derived from ``base`` that does not collide with any id in
 *  ``existing``. Returns ``base`` when free, else ``base-2`` / ``base-3`` … */
export function uniqueSetId(base: string, existing: Set<string>): string {
    if (!existing.has(base)) return base;
    let n = 2;
    let candidate = `${base}-${n}`;
    while (existing.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
    }
    return candidate;
}

/** Build the ``SaveUserSetInput`` that persists the combined set. For a
 *  NEW set the languages/level are derived from the selection; for an
 *  EXISTING set its own metadata is kept and the gathered lessons are
 *  appended after its current ones. Lesson ids are de-duplicated across
 *  the whole result so no ``lessons/{id}.json`` file is overwritten. */
export function buildCombinedSetInput(
    sources: CombineSource[],
    target: CombineTarget,
    existingSetIds: Set<string> = new Set(),
): SaveUserSetInput {
    if (target.mode === "existing") {
        const combined = dedupeLessonIds([
            ...target.lessons,
            ...gatherLessons(sources),
        ]);
        const e = target.entry;
        return {
            set_id: e.id,
            title: e.title,
            title_native: e.title_native ?? e.title,
            language: e.target_language,
            target_language: e.target_language,
            source_language: e.source_language,
            level: e.level,
            origin: "imported",
            description: e.description ?? null,
            lessons: combined,
        };
    }

    const langs = deriveCombinedLanguages(sources);
    const title = target.title.trim() || "Combined set";
    const setId = uniqueSetId(
        `created-${slugify(title) || "set"}`,
        existingSetIds,
    );
    return {
        set_id: setId,
        title,
        title_native: title,
        language: langs.targetLanguage,
        target_language: langs.targetLanguage,
        source_language: langs.sourceLanguage,
        level: target.level?.trim() || langs.level,
        origin: "imported",
        description: target.description?.trim() || null,
        lessons: dedupeLessonIds(gatherLessons(sources)),
    };
}
