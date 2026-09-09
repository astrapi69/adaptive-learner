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
import type {LessonProgress, SetStatus} from "../../../storage/types";

/** One set's most-recently-touched lesson-progress row. */
export interface ContinueLearningGroup {
    source: string;
    setId: string;
    mostRecent: LessonProgress;
}

/** What the learner should do next for a given set. ``"review"`` is a
 *  display-only tier (a finished/deferred set with cards due, #2123) — it is
 *  never returned by ``resolveContinueAction``, only assigned by the consumer
 *  when the ranking classifies the set into the review tier. */
export type ContinueMode = "resume" | "next" | "set_complete" | "review";

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

/**
 * Which tier a candidate set falls into for the entry ("Weitermachen")
 * suggestion. ``"review"`` — cards are due; ``"started"`` — an active,
 * still-open set to resume/continue; ``"done"`` - finished, nothing left to
 * do, shown only as a completion tag (#3020). Dropped candidates return
 * ``null``.
 */
export type EntryTier = "review" | "started" | "done";

/** How many ``"done"`` rows the entry may carry (#3020). The section answers
 *  "what now?", so exactly the most recently finished set is tagged; more
 *  would turn it into a completion archive. */
const DONE_TIER_LIMIT = 1;

/**
 * The per-set inputs the entry-suggestion ranking needs beyond the grouped
 * progress row: the resolved next action, the set's effective lifecycle
 * status, and how many review cards are currently due for it.
 */
export interface EntryRankInput {
    group: ContinueLearningGroup;
    action: ResolvedContinueAction;
    /** Effective lifecycle status from the set-status store (default "active"). */
    status: SetStatus;
    /** Count of review cards currently overdue for this set. */
    dueCount: number;
}

/**
 * Classify a candidate set for the entry suggestion, or return ``null`` to
 * DROP it (#2123, refined by #3020).
 *
 * The entry proposes something worth doing next, and reports a finish:
 *   - A finished set (lifecycle ``"completed"`` OR its most-recent row
 *     resolves to ``"set_complete"``) with due cards is a ``"review"``
 *     suggestion; with nothing due it is ``"done"`` - not an action, just the
 *     visible completion tag the learner otherwise never gets (#3020). The
 *     #2123 bug (a finished set proposed as the TOP continue target) stays
 *     fixed by the tier order in {@link rankEntrySuggestions}, not by hiding
 *     the finish.
 *   - A ``"deferred"`` set is surfaced only when reviews are due; otherwise it
 *     is DROPPED - the learner put it aside on purpose, so there is no finish
 *     to report.
 *   - Any other set is active and still open → a ``"started"`` suggestion
 *     (resume / next lesson).
 *
 * Note: a still-open set that also has due cards stays ``"started"`` — the
 * natural next step is to resume the lesson, not to jump into review; the
 * review nudge is for sets with no forward progress left.
 */
export function classifyEntryCandidate(input: EntryRankInput): EntryTier | null {
    const finished =
        input.status === "completed" || input.action.mode === "set_complete";
    if (finished) {
        return input.dueCount > 0 ? "review" : "done";
    }
    if (input.status === "deferred") {
        return input.dueCount > 0 ? "review" : null;
    }
    return "started";
}

/**
 * Filter + order the entry suggestions (#2123, #3020). Review-tier sets first
 * (cards are due), then started sets, then at most {@link DONE_TIER_LIMIT}
 * finished set as a completion tag - each tier newest-touched first; dropped
 * candidates removed; capped at ``maxItems``.
 *
 * The done tier is deliberately last AND capped: an actionable suggestion
 * always outranks a finish (the #2123 fix), and the section stays an answer to
 * "what now?" instead of degenerating into a list of everything ever finished.
 * When everything drops, the caller shows the honest empty state rather than a
 * filler set.
 */
export function rankEntrySuggestions(
    inputs: readonly EntryRankInput[],
    maxItems: number,
): EntryRankInput[] {
    const tierRank: Record<EntryTier, number> = {review: 0, started: 1, done: 2};
    let doneShown = 0;
    return inputs
        .map((input) => ({input, tier: classifyEntryCandidate(input)}))
        .filter(
            (x): x is {input: EntryRankInput; tier: EntryTier} => x.tier !== null,
        )
        .sort((a, b) => {
            const byTier = tierRank[a.tier] - tierRank[b.tier];
            if (byTier !== 0) return byTier;
            return a.input.group.mostRecent.updated_at >
                b.input.group.mostRecent.updated_at
                ? -1
                : 1;
        })
        .filter((x) => x.tier !== "done" || ++doneShown <= DONE_TIER_LIMIT)
        .slice(0, Math.max(0, maxItems))
        .map((x) => x.input);
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

/**
 * Extract the 1-based part number from a split-analysis id, filename, or
 * title — e.g. ``"analysis-<uuid>-part-3"`` or ``"… — Part 2 of 3"`` → 3 / 2.
 * Imported chats are auto-split (``lesson-splitter``), so each part carries a
 * ``part-N`` marker; surfacing N keeps the row readable when the underlying
 * title is itself an opaque id (#729). Returns ``null`` when no marker exists.
 *
 * @example
 * partNumberOf("analysis-b8ff9ed4-...-part-3"); // 3
 * partNumberOf("03-articles.json");             // null
 */
export function partNumberOf(value: string): number | null {
    const match = value.match(/part[\s-]*(\d+)/i);
    return match ? Number(match[1]) : null;
}

/**
 * Resolve a set's display title, never leaking a raw machine id. A set absent
 * from ``listSets`` (or carrying an empty / opaque title) would otherwise show
 * its bare ``set_id`` — a UUID/hash for user-generated / analysis / snapshot
 * sets (#729, generalizing the #368 analysis-id fix). Shared by the "Continue
 * Learning" and the "Weiterlernen" (paused-lessons) dashboard surfaces.
 *
 * @param sets - The cached set listing (``listSets().sets``).
 * @param source - The progress row's content source.
 * @param setId - The progress row's set id.
 * @param opaqueFallback - Localized label shown when the title resolves to an
 *   opaque id (e.g. "Importierte Analyse").
 */
export function resolveSetTitle(
    sets: ReadonlyArray<{source: string; id: string; title?: string | null}>,
    source: string,
    setId: string,
    opaqueFallback: string,
): string {
    const entry = sets.find((s) => s.source === source && s.id === setId);
    const resolved = entry?.title ?? setId;
    return looksLikeOpaqueId(resolved) ? opaqueFallback : resolved;
}

/**
 * Resolve a lesson's display title, falling back from the cached lesson title
 * to a filename-derived label and finally to a generic label when even that is
 * opaque (#729). For an opaque split-analysis lesson a ``part-N`` marker is
 * preserved via ``partLabel`` so an imported-chat part shows e.g.
 * "Lektion · Teil 3" instead of the raw UUID.
 *
 * @param lesson - The cached lesson detail, or ``null`` when uncached.
 * @param filename - The progress row's lesson filename.
 * @param opaqueFallback - Localized generic label (e.g. "Lektion").
 * @param partLabel - Optional localized formatter for a split part number.
 */
export function resolveLessonTitle(
    lesson: {title?: string | null} | null,
    filename: string,
    opaqueFallback: string,
    partLabel?: (part: number) => string,
): string {
    const label = lesson?.title ?? lessonLabelFromFilename(filename);
    if (!looksLikeOpaqueId(label)) return label;
    const part = partNumberOf(filename) ?? partNumberOf(label);
    if (part !== null && partLabel) return partLabel(part);
    return opaqueFallback;
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

/**
 * Where "leave the lesson" should land (#2811).
 *
 * Pausing or finishing used to drop the learner on ``/content?tab=my`` - a
 * flat overview with no relation to the set they were just working through.
 * Since #2810 the set page lists that set's lessons with their progress and
 * marks where to continue, so it is the natural place to come back to. A
 * lesson without a set (an own lesson, a standalone import) keeps the old
 * target.
 *
 * @param setId - The lesson's set id, if it has one.
 * @returns The route to navigate to on exit.
 *
 * @example
 * exitRouteForLesson("es-a1"); // "/content/set/es-a1"
 * exitRouteForLesson(null);    // "/content?tab=my"
 */
export function exitRouteForLesson(setId: string | null | undefined): string {
    const trimmed = (setId ?? "").trim();
    if (!trimmed) return "/content?tab=my";
    return `/content/set/${encodeURIComponent(trimmed)}`;
}
