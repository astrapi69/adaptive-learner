/**
 * ContinueLearning — the "Weitermachen" / "Continue Learning"
 * section (UX overhaul C2). Shared between the Content Browser
 * (/content) and the Dashboard.
 *
 * Answers the learner's first question — "where was I, what do I
 * do next?" — by surfacing the most recently-touched lesson per
 * set (newest first), with a single sensible action each:
 *
 *   - resume        — the in-flight / paused lesson, with a step
 *                     counter.
 *   - next          — the just-completed lesson's stars + a pointer
 *                     to the next lesson in the set.
 *   - set complete  - every lesson in the set is done; the row carries a
 *                     visible completion tag and ranks below every actionable
 *                     row, so the finish is reported without being proposed
 *                     as the next thing to do (#2123 + #3020).
 *
 * Storage-mode-agnostic: every read routes through getStorage()
 * so the Dexie-mode GitHub-Pages build computes the section
 * client-side with no backend. Reads are individually guarded so
 * a transient failure on one set degrades that row, never the
 * whole section.
 *
 * Renders nothing while loading (no layout shift). When there is
 * no recent activity it shows a friendly empty state (Dashboard),
 * or hides entirely when ``showWhenEmpty`` is false (Content
 * Browser, where the set tree below already covers discovery).
 */

import {ArrowRight, CheckCircle2, History, Play, Star, X} from "lucide-react";
import {useEffect, useState} from "react";
import {Link} from "react-router";

import {useI18n} from "../../hooks/ui/useI18n";
import {useLessonProgressChangeTick} from "../../hooks/lesson/session/useLessonProgressChangeTick";
import {resumeStepNumber} from "../../lib/lesson/progress/resume-step";
import {
    classifyEntryCandidate,
    groupRecentProgress,
    lessonRoute,
    rankEntrySuggestions,
    resolveContinueAction,
    resolveLessonTitle,
    resolveSetTitle,
    rowStars,
    type ContinueMode,
    type EntryRankInput,
} from "../../lib/content/browse/continue-learning";
import {
    buildContentAvailability,
    filterAvailableProgress,
} from "../../lib/content/browse/lifecycle/content-availability";
import {getSetStatus} from "../../lib/content/browse/lifecycle/set-status-store";
import {
    dismissContinueRow,
    isContinueRowDismissed,
} from "../../lib/content/browse/prefs/continue-dismissed-store";
import {dedupeReviewQueueByElement} from "../../lib/review/review-lesson";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import ShareResultButton from "../share/ShareResultButton";
import type {ContentLesson, ContentSetEntry} from "../../storage/types";

export interface ContinueLearningProps {
    userId: string;
    /** Max sets to show (Dashboard 3, Content Browser 5). */
    maxItems?: number;
    /** When false (Content Browser), the section is hidden if there
     *  is no recent activity — the set tree below covers discovery.
     *  When true (Dashboard), a friendly empty state is shown. */
    showWhenEmpty?: boolean;
}

interface DisplayItem {
    source: string;
    setId: string;
    setTitle: string;
    mode: ContinueMode;
    targetRoute: string;
    /** Title shown for the row's lesson (resume target, or the
     *  just-completed lesson for the "next" pointer). */
    lessonTitle: string;
    /** Next lesson's title (mode === "next"). */
    nextTitle?: string;
    /** Resume step counter: the 1-based step the click lands on (#3076),
     *  of the lesson's step count. */
    resumeStep?: number;
    totalSteps?: number;
    /** Number of review cards due (mode "review"). */
    reviewDue?: number;
    /** Completed lesson's stars (modes "next" + "set_complete"). */
    stars?: number;
    /** Completed lesson's score (modes "next" + "set_complete"), for the
     *  #1073 share card. */
    correct?: number;
    total?: number;
    scorePct?: number;
    updatedAt: string;
}

/** Total exercise/theory steps in a lesson (best-effort; used for
 *  the resume "step n/total" hint). */
function lessonStepTotal(lesson: ContentLesson | null): number | undefined {
    if (!lesson) return undefined;
    return lesson.steps?.length ?? undefined;
}

/** Run an async read, swallowing failures (including a synchronous
 *  throw from a missing storage namespace) to null so a single
 *  unreachable source never breaks the whole section. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch {
        return null;
    }
}

export default function ContinueLearning({
    userId,
    maxItems = 5,
    showWhenEmpty = true,
}: ContinueLearningProps) {
    const {t} = useI18n();
    const [items, setItems] = useState<DisplayItem[] | null>(null);
    // Derived once so the effect depends on a stable primitive string, not the
    // t function identity (which is fresh per render under the i18n test mock
    // and would re-run the effect spuriously). The label still re-localizes on
    // a real language change because its string value changes.
    const importedAnalysisLabel = t(
        "content.continue_learning.imported_analysis",
        "Imported analysis",
    );
    const lessonFallbackLabel = t(
        "content.continue_learning.lesson_fallback",
        "Lesson",
    );

    // #3075 - re-read when a lesson row is written in this tab (the pause
    // an in-app exit performs lands in the commit this section mounts in).
    const progressTick = useLessonProgressChangeTick();

    useEffect(() => {
        if (!userId) {
            // No identified user — render nothing (null = the same
            // "render nothing" path as loading). The Dashboard +
            // Content Browser already gate on userId; this is defensive.
            setItems(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            const storage = getStorage();
            const [progress, setsRes, reviewQueue] = await Promise.all([
                safe(() => storage.lessonProgress.list(userId)),
                safe(() => storage.contentLoader.listSets()),
                safe(() => storage.elementErrors.reviewQueue(userId)),
            ]);
            if (cancelled) return;
            const sets: ContentSetEntry[] = setsRes?.sets ?? [];

            // #2123 — how many review cards are currently overdue per set, so
            // the suggestion can rank due reviews first and drop a finished /
            // deferred set that has nothing due. Deduped across EXP-018
            // directions, matching the NavReviewsBadge / reminder counts.
            const dueBySet = new Map<string, number>();
            for (const qItem of dedupeReviewQueueByElement(
                (reviewQueue ?? []).filter((item) => item.overdue),
            )) {
                dueBySet.set(qItem.set_id, (dueBySet.get(qItem.set_id) ?? 0) + 1);
            }

            // #1445 Part A — hide progress whose content can no longer be
            // loaded (its source repo was removed). The Dexie rows are left
            // untouched; re-adding the repo brings the cards back.
            const availability = buildContentAvailability(sets);
            const loadable = filterAvailableProgress(progress ?? [], availability);
            // Group ALL sets with progress (no early cap): the suggestion rule
            // may drop the newest set (finished, nothing due) in favour of an
            // older still-open one, so ranking has to see every candidate.
            const groups = groupRecentProgress(loadable, loadable.length).filter(
                // #3023 - rows the learner took out with the X. Keyed on the
                // row's updated_at, so new progress on the set brings it back.
                (group) =>
                    !isContinueRowDismissed(
                        group.source,
                        group.setId,
                        group.mostRecent.updated_at,
                    ),
            );
            const rankInputs: EntryRankInput[] = await Promise.all(
                groups.map(async (group) => {
                    const listing = await safe(() =>
                        storage.contentLoader.listLessons(
                            group.source,
                            group.setId,
                        ),
                    );
                    const action = resolveContinueAction(
                        group.mostRecent,
                        listing?.lessons ?? [],
                    );
                    return {
                        group,
                        action,
                        status: getSetStatus(group.source, group.setId) ?? "active",
                        dueCount: dueBySet.get(group.setId) ?? 0,
                    };
                }),
            );
            if (cancelled) return;

            const ranked = rankEntrySuggestions(rankInputs, maxItems);
            const resolved = await Promise.all(
                ranked.map(async (input) => {
                    const {group, action} = input;
                    const tier = classifyEntryCandidate(input);
                    const isReview = tier === "review";
                    // #3020 - a finished set is reported as finished even when
                    // its most-recent row still resolves to a forward action
                    // (the learner marked the set completed by hand). The
                    // revisit target is then the lesson they last worked on,
                    // not an unstarted successor.
                    const isDone = tier === "done";

                    // Fetch lesson detail for the displayed lessons — bounded
                    // by maxItems, cheap from the local cache, and guarded so
                    // a miss falls back to a filename label.
                    const rowLesson = await safe(() =>
                        storage.contentLoader.getLesson(
                            group.source,
                            group.setId,
                            group.mostRecent.lesson_filename,
                        ),
                    );
                    const nextLesson =
                        !isReview && !isDone && action.mode === "next"
                            ? await safe(() =>
                                  storage.contentLoader.getLesson(
                                      group.source,
                                      group.setId,
                                      action.targetFilename,
                                  ),
                              )
                            : null;

                    const lessonTitle = resolveLessonTitle(
                        rowLesson,
                        group.mostRecent.lesson_filename,
                        lessonFallbackLabel,
                    );
                    const setTitle = resolveSetTitle(
                        sets,
                        group.source,
                        group.setId,
                        importedAnalysisLabel,
                    );

                    // A finished / deferred set with cards due surfaces as a
                    // review nudge routed to the set's review session, never
                    // as a misleading "Set completed" row (#2123).
                    if (isReview) {
                        const item: DisplayItem = {
                            source: group.source,
                            setId: group.setId,
                            setTitle,
                            mode: "review",
                            targetRoute: `/review/${encodeURIComponent(group.setId)}`,
                            lessonTitle,
                            reviewDue: input.dueCount,
                            updatedAt: group.mostRecent.updated_at,
                        };
                        return item;
                    }

                    const mode: ContinueMode = isDone
                        ? "set_complete"
                        : action.mode;
                    const item: DisplayItem = {
                        source: group.source,
                        setId: group.setId,
                        setTitle,
                        mode,
                        targetRoute: lessonRoute(
                            group.source,
                            group.setId,
                            isDone
                                ? group.mostRecent.lesson_filename
                                : action.targetFilename,
                        ),
                        lessonTitle,
                        updatedAt: group.mostRecent.updated_at,
                    };
                    if (mode === "resume" && rowLesson?.steps) {
                        // #3076 - the same rule the lesson page restores
                        // with, not the count of graded exercises.
                        const stepIds = rowLesson.steps.map((step) => step.id);
                        item.resumeStep = resumeStepNumber(stepIds, group.mostRecent);
                        item.totalSteps = lessonStepTotal(rowLesson);
                    } else if (
                        mode === "set_complete" &&
                        group.mostRecent.status !== "completed"
                    ) {
                        // A hand-marked set whose last row is unfinished has no
                        // honest score - show the tag without stars.
                        item.stars = 0;
                    } else {
                        item.stars = rowStars(group.mostRecent);
                        const correct = group.mostRecent.score_correct ?? 0;
                        const scoredTotal = group.mostRecent.score_total ?? 0;
                        item.correct = correct;
                        item.total = scoredTotal;
                        item.scorePct =
                            scoredTotal > 0
                                ? Math.round((correct / scoredTotal) * 100)
                                : 0;
                        if (action.mode === "next") {
                            item.nextTitle = resolveLessonTitle(
                                nextLesson,
                                action.targetFilename,
                                lessonFallbackLabel,
                            );
                        }
                    }
                    return item;
                }),
            );
            if (!cancelled) setItems(resolved);
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, maxItems, importedAnalysisLabel, lessonFallbackLabel, progressTick]);

    /** #3023 - take one row out of the block. Hides the row, nothing else:
     *  no progress, no review cards, no set is touched. */
    function handleDismiss(item: DisplayItem) {
        dismissContinueRow(item.source, item.setId, item.updatedAt);
        setItems((previous) =>
            previous
                ? previous.filter(
                      (row) =>
                          row.source !== item.source || row.setId !== item.setId,
                  )
                : previous,
        );
        notify.success(
            t(
                "content.continue_learning.dismissed",
                "Removed from Continue Learning. It comes back as soon as you keep learning.",
            ),
        );
    }

    // Loading — render nothing to avoid layout shift.
    if (items === null) return null;

    if (items.length === 0) {
        if (!showWhenEmpty) return null;
        return (
            <section
                className="rounded-app border border-border bg-card p-4"
                data-testid="continue-learning"
            >
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                    {t("content.continue_learning.title", "Continue Learning")}
                </h2>
                <p className="text-sm text-muted-foreground">
                    <Link
                        to="/content?tab=my"
                        className="text-accent hover:underline"
                        data-testid="continue-learning-empty-link"
                    >
                        {t(
                            "content.continue_learning.empty",
                            "Start your first lesson!",
                        )}
                    </Link>
                </p>
            </section>
        );
    }

    return (
        <section
            className="rounded-app border border-border bg-card p-4"
            data-testid="continue-learning"
        >
            <h2 className="mb-3 text-lg font-semibold text-foreground">
                {t("content.continue_learning.title", "Continue Learning")}
            </h2>
            <ul className="flex flex-col gap-2" data-testid="continue-learning-list">
                {items.map((item) => (
                    <ContinueLearningRow
                        key={`${item.source}#${item.setId}`}
                        item={item}
                        onDismiss={handleDismiss}
                    />
                ))}
            </ul>
        </section>
    );
}

/** Icon for a row's mode. */
function ModeIcon({mode}: {mode: ContinueMode}) {
    if (mode === "review") return <History size={20} />;
    if (mode === "set_complete") return <CheckCircle2 size={20} />;
    if (mode === "next") return <ArrowRight size={20} />;
    return <Play size={20} />;
}

/** One row: the link to the row's target plus the share button for a
 *  scored row. Extracted from the list so each render unit stays inside
 *  the complexity ratchet's ceiling. */
function ContinueLearningRow({
    item,
    onDismiss,
}: {
    item: DisplayItem;
    onDismiss: (item: DisplayItem) => void;
}) {
    const {t} = useI18n();
    const dismissLabel = t(
        "content.continue_learning.dismiss",
        "Remove from Continue Learning",
    );
    return (
        <li
            data-testid={`continue-learning-item-${item.setId}`}
            className="flex items-center gap-1"
        >
            <Link
                to={item.targetRoute}
                className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-app border border-transparent bg-background p-2 hover:border-border hover:bg-muted"
                data-testid={`continue-learning-link-${item.setId}`}
            >
                <span className="text-accent" aria-hidden="true">
                    <ModeIcon mode={item.mode} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                        <span
                            className="truncate font-medium text-foreground"
                            title={`${item.setTitle} - ${item.lessonTitle}`}
                        >
                            {item.setTitle}
                            <span className="text-muted-foreground">
                                {" - "}
                                {item.lessonTitle}
                            </span>
                        </span>
                        {/* #3020 - the finish itself is the message: a
                            completed set carries a visible tag so the learner
                            sees the set is done instead of watching the row
                            silently disappear. */}
                        {item.mode === "set_complete" && (
                            <span
                                className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                data-testid={`continue-learning-badge-${item.setId}`}
                            >
                                {t(
                                    "content.continue_learning.completed",
                                    "Set completed",
                                )}
                            </span>
                        )}
                    </span>
                    <RowDetail item={item} />
                </span>
            </Link>
            {item.mode !== "resume" && (item.total ?? 0) > 0 && (
                <ShareResultButton
                    iconOnly
                    result={{
                        lessonTitle: item.lessonTitle,
                        correct: item.correct ?? 0,
                        total: item.total ?? 0,
                        scorePct: item.scorePct ?? 0,
                        stars: item.stars ?? 0,
                    }}
                    testId={`continue-learning-share-${item.setId}`}
                />
            )}
            {/* #3023 - every row, whatever its mode, can be taken out of the
                block. This hides the row only; progress, review cards and the
                set itself stay untouched. */}
            <button
                type="button"
                onClick={() => onDismiss(item)}
                aria-label={dismissLabel}
                title={dismissLabel}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-app text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid={`continue-learning-dismiss-${item.setId}`}
            >
                <X size={16} aria-hidden="true" />
            </button>
        </li>
    );
}

/** The row's second line: what the mode means for this set (due count,
 *  resume step counter, next-lesson pointer, or the completion stars). */
function RowDetail({item}: {item: DisplayItem}) {
    const {t} = useI18n();
    const stepHint =
        typeof item.totalSteps === "number" && typeof item.resumeStep === "number"
            ? ` · ${t("content.continue_learning.progress", "Step {n}/{total}")
                  .replace("{n}", String(item.resumeStep))
                  .replace("{total}", String(item.totalSteps))}`
            : "";
    const nextLabel = t("content.continue_learning.next", "Next Lesson");
    return (
        <span className="flex min-w-0 text-sm text-muted-foreground">
            {item.mode === "review" && (
                <span
                    className="min-w-0 truncate"
                    data-testid={`continue-learning-review-${item.setId}`}
                >
                    {t("lesson.next_step.review_due", "{count} due").replace(
                        "{count}",
                        String(item.reviewDue ?? 0),
                    )}
                </span>
            )}
            {item.mode === "resume" && (
                <span
                    className="min-w-0 truncate"
                    data-testid={`continue-learning-resume-${item.setId}`}
                >
                    {t("content.continue_learning.resume", "Resume")}
                    {stepHint}
                </span>
            )}
            {item.mode === "next" && (
                <span
                    className="flex min-w-0 items-center gap-1"
                    data-testid={`continue-learning-next-${item.setId}`}
                >
                    <span className="shrink-0">
                        <StarRow stars={item.stars ?? 0} />
                    </span>
                    <span
                        className="min-w-0 truncate"
                        title={`${nextLabel}: ${item.nextTitle}`}
                    >
                        {nextLabel}
                        {`: ${item.nextTitle}`}
                    </span>
                </span>
            )}
            {item.mode === "set_complete" && (
                <span
                    className="flex min-w-0 items-center gap-1"
                    data-testid={`continue-learning-complete-${item.setId}`}
                >
                    <span className="shrink-0">
                        <StarRow stars={item.stars ?? 0} />
                    </span>
                </span>
            )}
        </span>
    );
}

/** Compact filled/empty star row (0-3). */
function StarRow({stars}: {stars: number}) {
    return (
        <span className="inline-flex" aria-label={`${stars}/3`}>
            {[1, 2, 3].map((n) => (
                <Star
                    key={n}
                    size={12}
                    className={
                        n <= stars
                            ? "fill-[var(--star,currentColor)] text-accent"
                            : "text-muted-foreground"
                    }
                    aria-hidden="true"
                />
            ))}
        </span>
    );
}
