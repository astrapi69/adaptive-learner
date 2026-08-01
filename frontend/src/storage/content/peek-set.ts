/**
 * peek-set — fetch the IDENTITIES an incoming set version contains, WITHOUT
 * applying it (#2128 update guard). Mirrors the fetch half of
 * ``downloadSetDexie`` (repo manifest -> set manifest -> lessons) but persists
 * nothing: it returns only the lesson filenames + per-exercise element_keys so
 * a prospective update can be diffed against a learner's progress before the
 * overwrite happens. Storage-mode-independent (pure HTTP), so the same guard
 * runs in API and Dexie mode.
 */

import { parseManifest, setBasePath } from "../../lib/content/engine";
import type { ParsedManifest } from "../../lib/content/engine";
import {
    buildIncomingIdentities,
    type IncomingSetIdentities,
    type PeekExercise,
    type PeekLesson,
} from "../../lib/content/update/update-impact";
import type { ContentSetSource } from "../types";
import {
    DEFAULT_SOURCES,
    fetchText,
    tokenForSource,
} from "./content-loader-sources";

/** Pull the exercises (id + answer-bearing fields) out of a raw lesson JSON. */
function lessonExercises(raw: unknown): PeekExercise[] {
    const steps = (raw as { steps?: unknown[] } | null)?.steps;
    if (!Array.isArray(steps)) return [];
    const out: PeekExercise[] = [];
    for (const step of steps) {
        const ex = (step as { exercise?: PeekExercise } | null)?.exercise;
        if (ex && typeof ex.id === "string") out.push(ex);
    }
    return out;
}

/**
 * Fetch the incoming identities for ``setId`` from ``source``. Throws on a
 * fetch/parse failure or when the set is not advertised — the caller decides
 * whether a failure means "hold" (auto-sync: skip, retry later) or "proceed"
 * (manual: the user initiated it).
 */
export async function peekSetIdentities(
    source: string,
    setId: string,
    sources: ContentSetSource[] = DEFAULT_SOURCES,
): Promise<IncomingSetIdentities> {
    return buildIncomingIdentities(await peekSetLessons(source, setId, sources));
}

/**
 * The incoming lessons themselves, in authored ORDER (#2308).
 *
 * ``peekSetIdentities`` folds these into sets, which is all the guard needs to
 * decide whether something is lost. Deriving a remap needs the ORDER too - the
 * position of a key is what separates a correction from a reorder - so the
 * planning path takes the lessons instead of the folded identities.
 */
export async function peekSetLessons(
    source: string,
    setId: string,
    sources: ContentSetSource[] = DEFAULT_SOURCES,
): Promise<PeekLesson[]> {
    const src = sources.find((s) => s.source === source) ?? {
        source,
        branch: "main",
    };
    const token = tokenForSource(src.source);

    const repoManifest = parseManifest(
        await fetchText(src.source, src.branch, "manifest.yaml", token),
    ) as ParsedManifest | null;
    const target = (repoManifest?.sets ?? []).find((s) => s.id === setId);
    if (!target) {
        throw new Error(`Set ${setId} not advertised by ${source}`);
    }

    const basePath = setBasePath(target);
    const setManifest = parseManifest(
        await fetchText(src.source, src.branch, `${basePath}/manifest.yaml`, token),
    ) as ParsedManifest | null;

    let lessonFilenames: string[];
    const metaLessons = setManifest?.metadata?.lessons;
    if (Array.isArray(metaLessons) && metaLessons.every((x) => typeof x === "string")) {
        lessonFilenames = metaLessons as string[];
    } else {
        lessonFilenames = [];
        for (let i = 1; i <= (target.lesson_count ?? 0); i++) {
            lessonFilenames.push(`${String(i).padStart(2, "0")}.json`);
        }
    }

    const lessons: PeekLesson[] = [];
    for (const filename of lessonFilenames) {
        const text = await fetchText(
            src.source,
            src.branch,
            `${basePath}/lessons/${filename}`,
            token,
        );
        let raw: unknown;
        try {
            raw = JSON.parse(text);
        } catch {
            raw = null;
        }
        lessons.push({ filename, exercises: lessonExercises(raw) });
    }

    return lessons;
}
