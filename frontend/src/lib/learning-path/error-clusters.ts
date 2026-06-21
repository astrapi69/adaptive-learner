/**
 * Error clusters for the learning path (Phase 66G / EXP-022).
 *
 * Groups lessons that share the same error CATEGORY using the
 * EXISTING error classifier (v1.36.0 / EXP-007) — no new
 * classification logic. A cluster = an error tag (article_gender,
 * spelling_accent, verb_conjugation, word_order) shared by 2+
 * lessons, with the total error volume + the set to launch an
 * adaptive lesson from. Pure; tested without React.
 */

import {classifyError, type ErrorTag} from "../adaptive/error-classifier";
import type {ElementError} from "../../storage/types";
import {lessonKey} from "./graph-builder";

export interface ErrorCluster {
    tag: ErrorTag;
    /** ``lessonKey`` of each affected lesson. */
    lessonKeys: string[];
    /** Summed error_count across the tagged rows. */
    errorCount: number;
    /** Set to launch an adaptive lesson from (most-affected set). */
    setId: string;
}

const MIN_CLUSTER_LESSONS = 2;

/** Group lessons by shared error tag into clusters (each tag shared
 *  by 2+ lessons), summing error volume and picking the
 *  most-affected set to launch an adaptive lesson from. Returns
 *  clusters sorted by descending error count. */
export function buildErrorClusters(
    errorsByLesson: Record<string, ElementError[]>,
): ErrorCluster[] {
    const byTag = new Map<ErrorTag, {keys: Set<string>; count: number}>();
    for (const [key, rows] of Object.entries(errorsByLesson)) {
        for (const row of rows) {
            for (const tag of classifyError(row)) {
                const entry = byTag.get(tag) ?? {keys: new Set(), count: 0};
                entry.keys.add(key);
                entry.count += row.error_count;
                byTag.set(tag, entry);
            }
        }
    }

    const clusters: ErrorCluster[] = [];
    for (const [tag, entry] of byTag) {
        if (entry.keys.size < MIN_CLUSTER_LESSONS) continue;
        // Most-common set among the affected lessons.
        const setCounts = new Map<string, number>();
        for (const k of entry.keys) {
            const setId = k.split("::")[0];
            setCounts.set(setId, (setCounts.get(setId) ?? 0) + 1);
        }
        const setId = [...setCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        clusters.push({
            tag,
            lessonKeys: [...entry.keys],
            errorCount: entry.count,
            setId,
        });
    }
    return clusters.sort((a, b) => b.errorCount - a.errorCount);
}

export {lessonKey};
