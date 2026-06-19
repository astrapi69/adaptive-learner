/**
 * PausedLessonsCard — Dashboard widget for in-flight paused
 * lessons (Phase 63D / EXP-020).
 *
 * Reads the user's lessonProgress list, filters to
 * ``status === "paused"``, shows the most recently-paused
 * first (up to 5). Navigating to a paused lesson triggers
 * the Phase 63C resume-or-start-over prompt automatically.
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
    MAX_PAUSED,
    readRetentionDays,
} from "../../lib/learning/pausedRetentionPref";
import {getStorage} from "../../storage";
import type {LessonProgress} from "../../storage/types";

export interface PausedLessonsCardProps {
    userId: string;
}

const MAX_SHOWN = 5;

function lessonUrl(p: LessonProgress): string {
    const slug = p.source.replace(/\//g, "--");
    return `/lesson/${slug}/${p.set_id}/${p.lesson_filename}`;
}

/** Display-friendly label from a lesson filename + set_id.
 *  e.g. "03-articles.json" in "fr-a1" → "03-articles (fr-a1)" */
function lessonLabel(p: LessonProgress): string {
    const name = p.lesson_filename.replace(/\.json$/, "");
    return `${name} (${p.set_id})`;
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

export default function PausedLessonsCard({
    userId,
}: PausedLessonsCardProps) {
    const {t} = useI18n();
    const [paused, setPaused] = useState<LessonProgress[] | null>(null);

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
                setPaused(filtered);
            } catch {
                if (!cancelled) setPaused([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

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
                className="paused-lessons-list"
                data-testid="paused-lessons-list"
            >
                {paused.map((p) => (
                    <li
                        key={`${p.source}/${p.set_id}/${p.lesson_filename}`}
                        className="paused-lessons-item"
                        data-testid={`paused-lesson-${p.lesson_filename}`}
                    >
                        <Link
                            to={lessonUrl(p)}
                            className="paused-lessons-link"
                            data-testid={`paused-lesson-resume-${p.lesson_filename}`}
                        >
                            {lessonLabel(p)}
                        </Link>
                        {p.paused_at && (
                            <span className="paused-lessons-when muted">
                                <Clock
                                    size={12}
                                    aria-hidden="true"
                                />
                                {formatPausedAt(p.paused_at)}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </article>
    );
}
