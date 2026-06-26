/**
 * PausedLessonsCard — Dashboard "Weiterlernen" widget for in-flight
 * paused lessons (Phase 63D / EXP-020).
 *
 * Reads the user's lessonProgress list, filters to
 * ``status === "paused"``, shows the most recently-paused
 * first (up to 5). Navigating to a paused lesson triggers
 * the Phase 63C resume-or-start-over prompt automatically.
 *
 * Each row resolves a human-readable title (cached lesson title →
 * filename label → localized fallback) instead of leaking the raw
 * ``lesson_filename`` / ``set_id`` — which for imported-chat analyses
 * is a UUID-shaped string (#729). The same opaque-id guard the
 * Continue-Learning section uses is applied here, with split
 * ``-part-N`` lessons surfacing their part number.
 *
 * Phase 63F: on each load, abandoned lessons that are older
 * than the retention preference AND excess lessons beyond
 * ``MAX_PAUSED`` (oldest first) are automatically abandoned
 * so stale entries don't pile up indefinitely.
 *
 * Hidden entirely when there are no paused lessons (common
 * case for most users most of the time).
 *
 * Storage-mode-agnostic: routes through getStorage() so
 * Dexie + Api modes both work.
 */

import {BookOpen, Clock} from "lucide-react";
import {useEffect, useState} from "react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";
import {
    resolveLessonTitle,
    resolveSetTitle,
} from "../../lib/content/browse/continue-learning";
import {
    MAX_PAUSED,
    readRetentionDays,
} from "../../lib/learning/pausedRetentionPref";
import {getStorage} from "../../storage";
import type {LessonProgress} from "../../storage/types";

export interface PausedLessonsCardProps {
    userId: string;
}

const MAX_SHOWN = 5;

/** One resolved, display-ready paused-lesson row. */
interface PausedRow {
    key: string;
    /** Raw lesson filename — kept for stable ``data-testid`` selectors. */
    filename: string;
    url: string;
    setTitle: string;
    lessonTitle: string;
    pausedAt: string | null;
}

function lessonUrl(p: LessonProgress): string {
    const slug = p.source.replace(/\//g, "--");
    return `/lesson/${slug}/${p.set_id}/${p.lesson_filename}`;
}

function formatPausedAt(iso: string | null): string {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

/** Run an async read, swallowing failures (including a synchronous throw
 *  from a missing storage namespace) to null so an unreachable content
 *  source never breaks the widget. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch {
        return null;
    }
}

export default function PausedLessonsCard({
    userId,
}: PausedLessonsCardProps) {
    const {t} = useI18n();
    const [paused, setPaused] = useState<PausedRow[] | null>(null);

    // Derived to stable primitive strings so the effect doesn't re-run on the
    // fresh ``t`` identity the i18n test mock returns each render.
    const importedAnalysisLabel = t(
        "content.continue_learning.imported_analysis",
        "Imported analysis",
    );
    const lessonFallbackLabel = t(
        "content.continue_learning.lesson_fallback",
        "Lesson",
    );
    const lessonPartTemplate = t(
        "content.continue_learning.lesson_part",
        "{label} · Part {n}",
    );

    useEffect(() => {
        if (!userId) {
            setPaused([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const all = await getStorage().lessonProgress.list(userId);
                if (cancelled) return;

                // Phase 63F — auto-abandon stale / excess paused
                // lessons. Fire-and-forget; failures don't block
                // the display of the surviving entries.
                const retentionDays = readRetentionDays();
                const allPaused = all
                    .filter((p) => p.status === "paused")
                    .sort((a, b) =>
                        (a.paused_at ?? "") < (b.paused_at ?? "") ? -1 : 1,
                    );
                const cutoffMs =
                    retentionDays > 0
                        ? Date.now() - retentionDays * 86_400_000
                        : null;
                const toAbandon = new Set<string>();
                // Oldest excess entries first.
                allPaused
                    .slice(0, Math.max(0, allPaused.length - MAX_PAUSED))
                    .forEach((p) => toAbandon.add(p.id));
                // Entries older than the retention cutoff.
                if (cutoffMs !== null) {
                    allPaused.forEach((p) => {
                        if (
                            p.paused_at &&
                            new Date(p.paused_at).getTime() < cutoffMs
                        ) {
                            toAbandon.add(p.id);
                        }
                    });
                }
                if (toAbandon.size > 0) {
                    const storage = getStorage();
                    void Promise.allSettled(
                        allPaused
                            .filter((p) => toAbandon.has(p.id))
                            .map((p) =>
                                storage.lessonProgress.upsert(userId, {
                                    source: p.source,
                                    set_id: p.set_id,
                                    lesson_filename: p.lesson_filename,
                                    mark_abandoned: true,
                                }),
                            ),
                    );
                }

                const filtered = allPaused
                    .filter((p) => !toAbandon.has(p.id))
                    .sort((a, b) =>
                        (a.paused_at ?? "") > (b.paused_at ?? "") ? -1 : 1,
                    )
                    .slice(0, MAX_SHOWN);

                // Resolve a readable title per row, never leaking a raw id.
                const storage = getStorage();
                const sets =
                    (await safe(() => storage.contentLoader.listSets()))?.sets ??
                    [];
                const partLabel = (part: number): string =>
                    lessonPartTemplate
                        .replace("{label}", lessonFallbackLabel)
                        .replace("{n}", String(part));
                const rows = await Promise.all(
                    filtered.map(async (p): Promise<PausedRow> => {
                        const lesson = await safe(() =>
                            storage.contentLoader.getLesson(
                                p.source,
                                p.set_id,
                                p.lesson_filename,
                            ),
                        );
                        return {
                            key: `${p.source}/${p.set_id}/${p.lesson_filename}`,
                            filename: p.lesson_filename,
                            url: lessonUrl(p),
                            setTitle: resolveSetTitle(
                                sets,
                                p.source,
                                p.set_id,
                                importedAnalysisLabel,
                            ),
                            lessonTitle: resolveLessonTitle(
                                lesson,
                                p.lesson_filename,
                                lessonFallbackLabel,
                                partLabel,
                            ),
                            pausedAt: p.paused_at,
                        };
                    }),
                );
                if (!cancelled) setPaused(rows);
            } catch {
                if (!cancelled) setPaused([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, importedAnalysisLabel, lessonFallbackLabel, lessonPartTemplate]);

    // Still loading — render nothing to avoid layout shift.
    if (paused === null) return null;

    // No paused lessons — widget is invisible (common case).
    if (paused.length === 0) return null;

    return (
        <article
            className="dashboard-card"
            data-testid="paused-lessons-card"
        >
            <h2 className="dashboard-card-title">
                <BookOpen size={16} aria-hidden="true" />
                {t("dashboard.card_paused_lessons", "Continue learning")}
            </h2>

            <ul
                className="flex flex-col gap-1"
                data-testid="paused-lessons-list"
            >
                {paused.map((row) => (
                    <li
                        key={row.key}
                        data-testid={`paused-lesson-${row.filename}`}
                    >
                        <Link
                            to={row.url}
                            className="flex min-h-[44px] items-center justify-between gap-3 rounded-app border border-transparent bg-background p-2 hover:border-border hover:bg-muted"
                            data-testid={`paused-lesson-resume-${row.filename}`}
                        >
                            <span
                                className="min-w-0 flex-1 truncate font-medium text-foreground"
                                data-testid={`paused-lesson-title-${row.filename}`}
                            >
                                {row.setTitle}
                                <span className="font-normal text-muted-foreground">
                                    {" — "}
                                    {row.lessonTitle}
                                </span>
                            </span>
                            {row.pausedAt && (
                                <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                                    <Clock size={12} aria-hidden="true" />
                                    {formatPausedAt(row.pausedAt)}
                                </span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </article>
    );
}
