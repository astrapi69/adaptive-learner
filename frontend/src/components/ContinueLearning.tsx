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
 *   - set complete  — every lesson in the set is done.
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

import {ArrowRight, CheckCircle2, Play, Star} from "lucide-react";
import {useEffect, useState} from "react";
import {Link} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import {
    completedStepCount,
    groupRecentProgress,
    lessonLabelFromFilename,
    lessonRoute,
    resolveContinueAction,
    rowStars,
    type ContinueMode,
} from "../lib/content/continue-learning";
import {getStorage} from "../storage";
import type {ContentLesson, ContentSetEntry} from "../storage/types";

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
    /** Resume step counter. */
    stepsDone?: number;
    totalSteps?: number;
    /** Completed lesson's stars (modes "next" + "set_complete"). */
    stars?: number;
    updatedAt: string;
}

function setTitleOf(
    sets: ContentSetEntry[],
    source: string,
    setId: string,
): string {
    const entry = sets.find((s) => s.source === source && s.id === setId);
    return entry?.title ?? setId;
}

/** Total exercise/theory steps in a lesson (best-effort; used for
 *  the resume "step n/total" hint). */
function lessonStepTotal(lesson: ContentLesson | null): number | undefined {
    if (!lesson) return undefined;
    return lesson.steps?.length ?? undefined;
}

export default function ContinueLearning({
    userId,
    maxItems = 5,
    showWhenEmpty = true,
}: ContinueLearningProps) {
    const {t} = useI18n();
    const [items, setItems] = useState<DisplayItem[] | null>(null);

    useEffect(() => {
        if (!userId) {
            setItems([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            const storage = getStorage();
            const [progress, sets] = await Promise.all([
                storage.lessonProgress.list(userId).catch(() => []),
                storage.contentLoader.listSets().then((r) => r.sets).catch(
                    () => [] as ContentSetEntry[],
                ),
            ]);
            if (cancelled) return;

            const groups = groupRecentProgress(progress, maxItems);
            const resolved = await Promise.all(
                groups.map(async (group) => {
                    const listing = await storage.contentLoader
                        .listLessons(group.source, group.setId)
                        .catch(() => ({lessons: [] as string[]}));
                    const action = resolveContinueAction(
                        group.mostRecent,
                        listing.lessons,
                    );

                    // Fetch lesson detail for the displayed lessons —
                    // bounded by maxItems, cheap from the local cache,
                    // and guarded so a miss falls back to a filename
                    // label.
                    const rowLesson = await storage.contentLoader
                        .getLesson(
                            group.source,
                            group.setId,
                            group.mostRecent.lesson_filename,
                        )
                        .catch(() => null);
                    const nextLesson =
                        action.mode === "next"
                            ? await storage.contentLoader
                                  .getLesson(
                                      group.source,
                                      group.setId,
                                      action.targetFilename,
                                  )
                                  .catch(() => null)
                            : null;

                    const lessonTitle =
                        rowLesson?.title ??
                        lessonLabelFromFilename(
                            group.mostRecent.lesson_filename,
                        );
                    const item: DisplayItem = {
                        source: group.source,
                        setId: group.setId,
                        setTitle: setTitleOf(sets, group.source, group.setId),
                        mode: action.mode,
                        targetRoute: lessonRoute(
                            group.source,
                            group.setId,
                            action.targetFilename,
                        ),
                        lessonTitle,
                        updatedAt: group.mostRecent.updated_at,
                    };
                    if (action.mode === "resume") {
                        item.stepsDone = completedStepCount(group.mostRecent);
                        item.totalSteps = lessonStepTotal(rowLesson);
                    } else {
                        item.stars = rowStars(group.mostRecent);
                        if (action.mode === "next") {
                            item.nextTitle =
                                nextLesson?.title ??
                                lessonLabelFromFilename(action.targetFilename);
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
    }, [userId, maxItems]);

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
                        to="/content"
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
                    <li
                        key={`${item.source}#${item.setId}`}
                        data-testid={`continue-learning-item-${item.setId}`}
                    >
                        <Link
                            to={item.targetRoute}
                            className="flex min-h-[44px] items-center gap-3 rounded-app border border-transparent bg-background p-2 hover:border-border hover:bg-muted"
                            data-testid={`continue-learning-link-${item.setId}`}
                        >
                            <span className="text-accent" aria-hidden="true">
                                {item.mode === "set_complete" ? (
                                    <CheckCircle2 size={20} />
                                ) : item.mode === "next" ? (
                                    <ArrowRight size={20} />
                                ) : (
                                    <Play size={20} />
                                )}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-medium text-foreground">
                                    {item.setTitle}
                                    <span className="text-muted-foreground">
                                        {" — "}
                                        {item.lessonTitle}
                                    </span>
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {item.mode === "resume" && (
                                        <span data-testid={`continue-learning-resume-${item.setId}`}>
                                            {t(
                                                "content.continue_learning.resume",
                                                "Resume",
                                            )}
                                            {typeof item.totalSteps === "number" &&
                                            typeof item.stepsDone === "number"
                                                ? ` · ${t(
                                                      "content.continue_learning.progress",
                                                      "Step {n}/{total}",
                                                  )
                                                      .replace(
                                                          "{n}",
                                                          String(item.stepsDone),
                                                      )
                                                      .replace(
                                                          "{total}",
                                                          String(item.totalSteps),
                                                      )}`
                                                : ""}
                                        </span>
                                    )}
                                    {item.mode === "next" && (
                                        <span
                                            className="inline-flex items-center gap-1"
                                            data-testid={`continue-learning-next-${item.setId}`}
                                        >
                                            <StarRow stars={item.stars ?? 0} />
                                            {t(
                                                "content.continue_learning.next",
                                                "Next Lesson",
                                            )}
                                            {`: ${item.nextTitle}`}
                                        </span>
                                    )}
                                    {item.mode === "set_complete" && (
                                        <span
                                            className="inline-flex items-center gap-1"
                                            data-testid={`continue-learning-complete-${item.setId}`}
                                        >
                                            <StarRow stars={item.stars ?? 0} />
                                            {t(
                                                "content.continue_learning.completed",
                                                "Set completed",
                                            )}
                                        </span>
                                    )}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
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
