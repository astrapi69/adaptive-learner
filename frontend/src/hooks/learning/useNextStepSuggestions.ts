/**
 * useNextStepSuggestions — Smart Next-Step Suggestions after a
 * lesson completes (Phase 64 / smart-next-steps).
 *
 * Computes a set of intelligent "what's next?" suggestions from
 * EXISTING learning data, surfaced on the lesson summary screen:
 *
 *   - nextLesson      — the sequential successor in the set
 *                       (Phase 46A index lookup) + Phase 63
 *                       paused-status awareness so the card can
 *                       offer "Resume" instead of "Start".
 *   - adaptiveLesson  — derived from the errors made in THIS
 *                       lesson run (analyzer + classifier from
 *                       v1.36.0); hidden on a perfect score.
 *   - reviewSession   — the SRS review queue scoped to the set
 *                       (v1.30.0 elementErrors.reviewQueue).
 *   - setComplete     — true when this was the last lesson; a
 *                       suggestedSet (same source language, not
 *                       yet 100% completed) is offered alongside.
 *   - primaryAction   — which card gets the accent-coloured
 *                       primary CTA, driven by the star rating.
 *
 * Storage-mode-agnostic: every read routes through
 * ``getStorage()`` so the Dexie-mode build on GitHub Pages
 * computes the suggestions client-side with no backend. Every
 * read is individually guarded — a transient failure on any one
 * source degrades that suggestion to "unavailable" rather than
 * throwing, so the lesson summary always renders (graceful
 * degradation; the demoted Repeat / Back links + the parent's
 * fallback Next-lesson button remain a working exit at all
 * times).
 *
 * The signature extends the original spec's
 * ``(setId, lessonId, stars, sessionErrors)`` with the
 * ``source`` (set slug, resolved to a path) and ``userId`` the
 * storage reads require, passed as one options object so the
 * call site reads cleanly. ``nextLesson.lessonFilename`` carries
 * the successor's filename (lessons are keyed by filename in
 * this codebase, not by an opaque id).
 */

import {useEffect, useMemo, useState} from "react";

import {analyzeErrors} from "../../lib/adaptive/error-analyzer";
import {focusAreaTags} from "../../lib/adaptive/error-classifier";
import type {ErrorTag} from "../../lib/adaptive/error-classifier";
import {getStorage} from "../../storage";
import type {ElementError} from "../../storage/types";

export type PrimaryAction = "next" | "adaptive" | "review" | "error_replay";

export interface NextStepSuggestions {
    /** True until the first round of storage reads resolves. */
    loading: boolean;
    nextLesson: {
        available: boolean;
        lessonFilename?: string;
        title?: string;
        /** Phase 63 — the successor is in the ``paused`` state, so
         *  the card offers "Resume" + a step counter. */
        isPaused: boolean;
        pausedStep?: number;
        totalSteps?: number;
    };
    /** Replay ONLY the exercises failed in THIS lesson (the exact
     *  same exercises, one more try) — distinct from the adaptive
     *  card (all errors, regenerated) and the review queue (SRS,
     *  all lessons). Available whenever this run had ≥ 1 failed
     *  exercise; hidden on a clean run. */
    errorReplay: {
        available: boolean;
        /** Exercises STILL open (not yet corrected in a replay). */
        errorCount: number;
        /** Exercises already corrected in a replay (of the original
         *  failed set) — drives the "{corrected} von {total}" progress. */
        correctedCount: number;
        /** True when every originally-failed exercise is now corrected
         *  (``errorCount === 0`` with ``correctedCount > 0``): the replay
         *  CTA is replaced by a short success card. */
        allCorrected: boolean;
    };
    adaptiveLesson: {
        available: boolean;
        /** Top classified weakness for the focus headline, or null
         *  when no grammatical heuristic matched (vocabulary). */
        focusTag: ErrorTag | null;
        /** Raw element_type of the top focus element (fallback
         *  label source when ``focusTag`` is null). */
        focusType?: string;
        errorCount: number;
    };
    reviewSession: {
        available: boolean;
        dueCount: number;
    };
    setComplete: boolean;
    /** Current set's display title (for the set-complete card). */
    setTitle?: string;
    /** Current set's total lesson count (for the set-complete
     *  card "all N lessons" line). */
    lessonCount?: number;
    suggestedSet?: {
        setId: string;
        title: string;
    };
    primaryAction: PrimaryAction;
}

export interface UseNextStepArgs {
    /** Resolved set source path (slug with ``--`` → ``/``). */
    source: string;
    setId: string;
    lessonFilename: string;
    userId: string;
    stars: number;
    /** ElementError rows recorded for THIS lesson (lesson_id ===
     *  lessonFilename). Used for the adaptive card's error count
     *  + weakness classification. Passed in (rather than fetched
     *  here) so the hook stays trivially testable. */
    sessionErrors: readonly ElementError[];
    /** Number of exercises the learner FAILED in this run (computed
     *  by the caller from ``lesson`` + ``step_results`` via
     *  ``collectFailedExercises``). Drives the error-replay card +
     *  its priority. Defaults to 0 (no replay) when omitted. */
    failedExerciseCount?: number;
    /** Of the originally-failed exercises, how many are already
     *  corrected in a replay (live SRS). Drives the "{corrected} von
     *  {total}" progress + the all-corrected success card. Defaults 0. */
    correctedExerciseCount?: number;
}

/** The portion of the suggestions derived from async storage
 *  reads. Kept separate from the synchronous error analysis so a
 *  change in ``sessionErrors`` re-derives only the adaptive card
 *  (no re-fetch, no loading flicker that would blink the other
 *  cards out and back in). */
interface FetchedState {
    loading: boolean;
    nextLesson: NextStepSuggestions["nextLesson"];
    reviewSession: NextStepSuggestions["reviewSession"];
    setComplete: boolean;
    setTitle?: string;
    lessonCount?: number;
    suggestedSet?: NextStepSuggestions["suggestedSet"];
}

const INITIAL_FETCHED: FetchedState = {
    loading: true,
    nextLesson: {available: false, isPaused: false},
    reviewSession: {available: false, dueCount: 0},
    setComplete: false,
};

/** Run an async storage read, swallowing failures to null so a
 *  single unreachable source never breaks the whole hook. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch {
        return null;
    }
}

/** Human-readable fallback title from a lesson filename, used
 *  only when ``getLesson`` fails (e.g. offline edge). Strips the
 *  extension and turns separators into spaces. */
function deriveTitle(filename: string): string {
    return filename
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
}

/** Pick which card gets the accent-coloured primary CTA.
 *
 *   - 0-1 stars + failed exercises → fix them first: "error_replay"
 *     (the most immediate, highest-signal action after a weak run)
 *   - 2-3 stars → advance: "next" (error replay stays a secondary
 *     option when there are residual errors)
 *   - last lesson → "adaptive" (if errors) / "review" (if due) / "next"
 *   - 0-1 stars without a replay but with errors → "adaptive"
 *
 * Exported for direct unit testing.
 */
export function computePrimaryAction(
    stars: number,
    hasNext: boolean,
    hasAdaptive: boolean,
    hasReview: boolean,
    hasErrorReplay = false,
): PrimaryAction {
    // After a weak run, retrying the exact failed exercises is the
    // single most useful next step — it outranks everything else.
    if (stars <= 1 && hasErrorReplay) return "error_replay";
    if (!hasNext) {
        // Last lesson in the set.
        if (hasAdaptive) return "adaptive";
        if (hasReview) return "review";
        return "next";
    }
    if (stars <= 1 && hasAdaptive) return "adaptive";
    return "next";
}

/** The storage facade type, derived so the helpers stay decoupled
 *  from the concrete ApiStorage / DexieStorage implementations. */
type NextStepStorage = ReturnType<typeof getStorage>;
type LessonListResult = Awaited<
    ReturnType<NextStepStorage["contentLoader"]["listLessons"]>
> | null;
type SetsListResult = Awaited<
    ReturnType<NextStepStorage["contentLoader"]["listSets"]>
> | null;
type ProgressListResult = Awaited<
    ReturnType<NextStepStorage["lessonProgress"]["list"]>
> | null;

/** Resolve the sequential successor lesson (Phase 46A index lookup)
 *  from an already-fetched lesson list: its title, step count and
 *  paused status, plus whether THIS lesson was the last in the set.
 *  Every read is guarded, so an unreachable source degrades to an
 *  unavailable next-lesson card rather than throwing. */
async function resolveNextLesson(
    storage: NextStepStorage,
    source: string,
    setId: string,
    lessonFilename: string,
    userId: string,
    lessonList: LessonListResult,
): Promise<{
    nextLesson: NextStepSuggestions["nextLesson"];
    setComplete: boolean;
}> {
    let nextFilename: string | undefined;
    let setComplete = false;
    if (lessonList) {
        const idx = lessonList.lessons.indexOf(lessonFilename);
        if (idx >= 0) {
            if (idx < lessonList.lessons.length - 1) {
                nextFilename = lessonList.lessons[idx + 1];
            } else {
                setComplete = true;
            }
        }
    }

    if (!nextFilename) {
        return {nextLesson: {available: false, isPaused: false}, setComplete};
    }

    const [detail, nextProgress] = await Promise.all([
        safe(() =>
            storage.contentLoader.getLesson(
                source,
                setId,
                nextFilename as string,
            ),
        ),
        userId
            ? safe(() =>
                  storage.lessonProgress.get(
                      userId,
                      source,
                      setId,
                      nextFilename as string,
                  ),
              )
            : Promise.resolve(null),
    ]);
    const isPaused = nextProgress?.status === "paused";
    return {
        nextLesson: {
            available: true,
            lessonFilename: nextFilename,
            title: detail?.title ?? deriveTitle(nextFilename),
            totalSteps: detail?.steps.length,
            isPaused,
            pausedStep:
                isPaused && nextProgress
                    ? Object.keys(nextProgress.step_results).length
                    : undefined,
        },
        setComplete,
    };
}

/** Derive the set-complete card's title + lesson count and, when the
 *  set is finished, a suggested next set (same source language, not
 *  yet 100% completed) from the user's full progress list. */
function resolveSuggestedSet(
    setsList: SetsListResult,
    setId: string,
    allProgress: ProgressListResult,
    setComplete: boolean,
): {
    setTitle?: string;
    lessonCount?: number;
    suggestedSet?: NextStepSuggestions["suggestedSet"];
} {
    if (!setsList) return {};
    const current = setsList.sets.find((s) => s.id === setId);
    const setTitle = current?.title;
    const lessonCount = current?.lesson_count;
    let suggestedSet: NextStepSuggestions["suggestedSet"];
    if (setComplete && current) {
        // Count completed lessons per set so we never suggest a set
        // the learner already finished 100%.
        const completedBySet = new Map<string, Set<string>>();
        for (const p of allProgress ?? []) {
            if (p.status !== "completed") continue;
            const bucket = completedBySet.get(p.set_id) ?? new Set<string>();
            bucket.add(p.lesson_filename);
            completedBySet.set(p.set_id, bucket);
        }
        const candidate = setsList.sets.find(
            (s) =>
                s.id !== setId &&
                s.source_language === current.source_language &&
                (completedBySet.get(s.id)?.size ?? 0) < s.lesson_count,
        );
        if (candidate) {
            suggestedSet = {setId: candidate.id, title: candidate.title};
        }
    }
    return {setTitle, lessonCount, suggestedSet};
}

export function useNextStepSuggestions(
    args: UseNextStepArgs,
): NextStepSuggestions {
    const {
        source,
        setId,
        lessonFilename,
        userId,
        stars,
        sessionErrors,
        failedExerciseCount = 0,
        correctedExerciseCount = 0,
    } = args;
    const [fetched, setFetched] = useState<FetchedState>(INITIAL_FETCHED);

    // Async storage reads — keyed ONLY on the stable identifiers so
    // a change in ``sessionErrors`` (which affects only the adaptive
    // card, computed synchronously below) never re-triggers a fetch
    // or flickers ``loading``.
    useEffect(() => {
        let cancelled = false;
        setFetched((prev) => ({...prev, loading: true}));

        void (async () => {
            const storage = getStorage();

            // Parallel reads — each guarded to null on failure.
            const [lessonList, reviewQueue, setsList, allProgress] =
                await Promise.all([
                    safe(() =>
                        storage.contentLoader.listLessons(source, setId),
                    ),
                    userId
                        ? safe(() =>
                              storage.elementErrors.reviewQueue(userId, {
                                  setId,
                              }),
                          )
                        : Promise.resolve(null),
                    safe(() => storage.contentLoader.listSets()),
                    userId
                        ? safe(() => storage.lessonProgress.list(userId))
                        : Promise.resolve(null),
                ]);
            if (cancelled) return;

            const {nextLesson, setComplete} = await resolveNextLesson(
                storage,
                source,
                setId,
                lessonFilename,
                userId,
                lessonList,
            );
            if (cancelled) return;

            const dueCount = reviewQueue?.length ?? 0;
            const {setTitle, lessonCount, suggestedSet} = resolveSuggestedSet(
                setsList,
                setId,
                allProgress,
                setComplete,
            );

            setFetched({
                loading: false,
                nextLesson,
                reviewSession: {
                    available: dueCount > 0,
                    dueCount,
                },
                setComplete,
                setTitle,
                lessonCount,
                suggestedSet,
            });
        })();

        return () => {
            cancelled = true;
        };
    }, [source, setId, lessonFilename, userId]);

    // Adaptive card — pure, synchronous analysis of this run's
    // errors. Re-derives on a sessionErrors change without touching
    // the fetched cards.
    const adaptiveLesson = useMemo(() => {
        const analysis = analyzeErrors(sessionErrors);
        const tags = focusAreaTags(analysis.suggested_focus, sessionErrors);
        const focusTag: ErrorTag | null = tags[0] ?? null;
        return {
            available: analysis.total_errors > 0,
            focusTag,
            focusType: analysis.suggested_focus[0]?.element_type,
            errorCount: analysis.total_errors,
        };
    }, [sessionErrors]);

    const errorReplay = useMemo(
        () => ({
            available: failedExerciseCount > 0,
            errorCount: failedExerciseCount,
            correctedCount: correctedExerciseCount,
            allCorrected:
                failedExerciseCount === 0 && correctedExerciseCount > 0,
        }),
        [failedExerciseCount, correctedExerciseCount],
    );

    return useMemo<NextStepSuggestions>(
        () => ({
            loading: fetched.loading,
            nextLesson: fetched.nextLesson,
            errorReplay,
            adaptiveLesson,
            reviewSession: fetched.reviewSession,
            setComplete: fetched.setComplete,
            setTitle: fetched.setTitle,
            lessonCount: fetched.lessonCount,
            suggestedSet: fetched.suggestedSet,
            primaryAction: computePrimaryAction(
                stars,
                fetched.nextLesson.available,
                adaptiveLesson.available,
                fetched.reviewSession.available,
                errorReplay.available,
            ),
        }),
        [fetched, errorReplay, adaptiveLesson, stars],
    );
}
