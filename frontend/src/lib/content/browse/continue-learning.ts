/**
 * continue-learning — pure helpers behind the "Weitermachen" /
 * "Continue Learning" section (UX overhaul C2).
 *
 * The section answers the learner's first question on opening the
 * app: "Where was I? What do I do next?" — so it surfaces the most
 * recently-touched lesson per set, sorted newest-first, and decides
 * the single sensible next action for each (resume the in-flight
 * lesson, start the next lesson in the set, or mark the set
 * complete).
 *
 * Everything here is synchronous + side-effect-free so it is
 * trivially unit-testable; the component (ContinueLearning.tsx)
 * does the storage reads and feeds the results in.
 */

import {computeStars, type StarRating} from "../../lesson/lesson-summary";
import type {LessonProgress} from "../../../storage/types";

/** One set's most-recently-touched lesson-progress row. */
export interface ContinueLearningGroup {
    source: string;
    setId: string;
    mostRecent: LessonProgress;
}

/** What the learner should do next for a given set. */
export type ContinueMode = "resume" | "next" | "set_complete";

export interface ResolvedContinueAction {
    mode: ContinueMode;
    /** Lesson filename the row should navigate to (resume target,
     *  next lesson, or — for a completed set — the last lesson so a
     *  revisit still works). */
    targetFilename: string;
    /** When mode === "next", the lesson that was just completed
     *  (so the card can show its stars alongside the next pointer). */
    completedFilename?: string;
}

/**
 * Group lesson-progress rows by set (``source#set_id``), keep the
 * most-recently-touched row per set, sort sets by that row's
 * ``updated_at`` descending, and limit to ``maxItems``.
 *
 * Abandoned rows are skipped entirely — an abandoned lesson is a
 * deliberate give-up and surfacing it as "continue" would be noise.
 * A set whose ONLY progress is abandoned therefore drops out.
 */
export function groupRecentProgress(
    progress: readonly LessonProgress[],
    maxItems: number,
): ContinueLearningGroup[] {
    const byKey = new Map<string, LessonProgress>();
    for (const row of progress) {
        if (row.status === "abandoned") continue;
        const key = `${row.source}#${row.set_id}`;
        const existing = byKey.get(key);
        if (!existing || row.updated_at > existing.updated_at) {
            byKey.set(key, row);
        }
    }
    return [...byKey.values()]
        .sort((a, b) => (a.updated_at > b.updated_at ? -1 : 1))
        .slice(0, Math.max(0, maxItems))
        .map((mostRecent) => ({
            source: mostRecent.source,
            setId: mostRecent.set_id,
            mostRecent,
        }));
}

/** Number of steps the learner has finished in a row (keys of
 *  ``step_results``). Drives the "step n/total" resume hint. */
export function completedStepCount(row: LessonProgress): number {
    return Object.keys(row.step_results ?? {}).length;
}

/** Star rating for a completed row, from its stored score. */
export function rowStars(row: LessonProgress): StarRating {
    return computeStars(row.score_correct, row.score_total);
}

/**
 * Decide the next action for a set from its most-recent row + the
 * set's ordered lesson filenames.
 *
 *   - in_progress / paused → resume that lesson.
 *   - completed with a successor → start the next lesson.
 *   - completed last lesson → set complete (target stays the last
 *     lesson so a revisit click still resolves).
 *
 * When the lesson list is empty/unknown (a transient listLessons
 * failure), a completed row falls back to ``set_complete`` rather
 * than throwing.
 */
export function resolveContinueAction(
    mostRecent: LessonProgress,
    orderedLessons: readonly string[],
): ResolvedContinueAction {
    if (mostRecent.status === "in_progress" || mostRecent.status === "paused") {
        return {mode: "resume", targetFilename: mostRecent.lesson_filename};
    }
    const idx = orderedLessons.indexOf(mostRecent.lesson_filename);
    if (idx >= 0 && idx < orderedLessons.length - 1) {
        return {
            mode: "next",
            targetFilename: orderedLessons[idx + 1],
            completedFilename: mostRecent.lesson_filename,
        };
    }
    return {mode: "set_complete", targetFilename: mostRecent.lesson_filename};
}

/** Human-readable label from a lesson filename. Strips the
 *  extension + numbering prefix-friendly separators. e.g.
 *  ``"03-articles.json"`` → ``"03 articles"``. */
export function lessonLabelFromFilename(filename: string): string {
    return filename
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
}

/**
 * True when ``value`` looks like an opaque machine id rather than a
 * human name — a bare UUID, an ``analysis-<uuid>`` set id, or a long
 * hex/base-ish token with no word structure. Such values must never be
 * shown to the learner (#729: "Continue Learning showed hashes instead
 * of names" — a user-generated / analysis / snapshot set whose title or
 * lesson filename fell back to its raw id).
 *
 * #854: imported analyses are auto-split (``lesson-splitter``), so the
 * title / filename that reaches this guard is rarely the bare id. It is
 * one of ``analysis-<uuid> — Part 2 of 3`` (split title), ``analysis-
 * <uuid>-part-2`` (split id), or the filename-derived spaced label
 * ``analysis b8ff9ed4 e201 …`` (separators turned into spaces). The
 * checks therefore match the ``analysis`` marker + leading UUID block in
 * any separator form REGARDLESS of what trails it, not an exact anchor.
 */
export function looksLikeOpaqueId(value: string): boolean {
    const v = value.trim();
    if (!v) return true;
    // ``analysis-<uuid>…`` set ids in any separator form (dash or the
    // filename-derived space), with any trailing suffix ("…-part-2",
    // "… — Part 2 of 3").
    if (/^analysis[\s-]+[0-9a-f]{8}[\s-]/i.test(v)) return true;
    // A UUID at the start (dash- or space-separated), with or without a
    // short word prefix like "set-", regardless of what trails it.
    if (
        /^(?:[a-z]+[\s-])?[0-9a-f]{8}[\s-][0-9a-f]{4}[\s-][0-9a-f]{4}[\s-][0-9a-f]{4}[\s-][0-9a-f]{12}\b/i.test(
            v,
        )
    ) {
        return true;
    }
    // A long single token of hex / id chars with no spaces (a hash).
    if (!/\s/.test(v) && /^[0-9a-f]{16,}$/i.test(v)) return true;
    return false;
}

/** Build the /lesson/... route for a set source + lesson. */
export function lessonRoute(
    source: string,
    setId: string,
    filename: string,
): string {
    const slug = source.replace(/\//g, "--");
    return `/lesson/${slug}/${setId}/${filename}`;
}
