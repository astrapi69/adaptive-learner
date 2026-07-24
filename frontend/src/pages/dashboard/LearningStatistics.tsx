/**
 * LearningStatistics page (``/statistics``).
 *
 * Surfaces the learner-scoped progress the app already collects but
 * never showed beyond the header XP badge: headline counters (learning
 * time, completed lessons, average accuracy, current streak), the
 * weakest elements with a one-click practice entry, a 90-day activity
 * heatmap of lessons completed per day, and per-language-pair
 * completion split by CEFR level.
 *
 * Distinct from ``/progress`` (which is session/AI-coaching oriented):
 * this reads gamification + lessonProgress + elementErrors, while
 * Progress reads the tracking/session surface.
 *
 * Storage-mode-agnostic (everything routes through getStorage); each
 * read is independently guarded so a transient failure degrades one
 * panel rather than the whole page.
 */

import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Flame, GraduationCap, Target, Timer} from "lucide-react";

import ActivityHeatmap from "../../shared/gamification/ActivityHeatmap";
import ProgressByPair from "../../shared/data-display/ProgressByPair";
import WeakAreasList from "../../shared/gamification/WeakAreasList";
import {useI18n} from "../../hooks/ui/useI18n";
import {usePersonalPath} from "../../hooks/learning/usePersonalPath";
import {languageDisplayName} from "../../lib/content/language/language-names";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    buildLessonActivity,
    computeOverview,
    progressByPair,
    topWeakAreas,
} from "../../lib/statistics/summary";
import {getStorage} from "../../storage";
import type {
    ElementError,
    LessonProgress,
    StreakStateOut,
} from "../../storage/types";

const HEATMAP_DAYS = 90;

function formatDuration(
    totalSeconds: number,
    t: (key: string, fallback?: string) => string,
): string {
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return t("statistics.time_hm", "{h}h {m}m")
            .replace("{h}", String(hours))
            .replace("{m}", String(minutes));
    }
    return t("statistics.time_m", "{m}m").replace("{m}", String(minutes));
}

export default function LearningStatistics() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();
    const userId = readLearnerState().userId;

    const [progress, setProgress] = useState<LessonProgress[] | null>(null);
    const [streak, setStreak] = useState<StreakStateOut | null>(null);
    const [errors, setErrors] = useState<ElementError[] | null>(null);

    const path = usePersonalPath(userId ?? "");

    useEffect(() => {
        if (!userId) {
            navigate("/onboarding", {replace: true});
            return;
        }
        let cancelled = false;
        const storage = getStorage();
        void (async () => {
            const [progressRes, streakRes, errorsRes] = await Promise.all([
                storage.lessonProgress.list(userId).catch(() => []),
                storage.gamification.getStreak(userId).catch(() => null),
                storage.elementErrors
                    .list(userId, {includeMastered: true})
                    .catch(() => []),
            ]);
            if (cancelled) return;
            setProgress(progressRes);
            setStreak(streakRes);
            setErrors(errorsRes);
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, navigate]);

    const overview = useMemo(
        () => computeOverview(progress ?? []),
        [progress],
    );
    const activity = useMemo(
        () => buildLessonActivity(progress ?? [], HEATMAP_DAYS),
        [progress],
    );
    const weakAreas = useMemo(() => topWeakAreas(errors ?? [], 10), [errors]);
    const pairs = useMemo(() => {
        const sets = path.data?.activeSets ?? [];
        return progressByPair(sets).map((pair) => {
            const targetName = languageDisplayName(pair.target, lang);
            const name =
                pair.source === pair.target
                    ? targetName
                    : `${languageDisplayName(pair.source, lang)} → ${targetName}`;
            return {
                name,
                percent: pair.percent,
                levels: pair.levels.map((level) => ({
                    level: level.level.toUpperCase(),
                    percent: level.percent,
                    barLabel: t(
                        "statistics.pair_level_aria",
                        "{level}: {percent}% complete",
                    )
                        .replace("{level}", level.level.toUpperCase())
                        .replace("{percent}", String(level.percent)),
                })),
            };
        });
    }, [path.data, lang, t]);

    const loading = progress === null;

    if (loading) {
        return (
            <main
                id="main"
                data-testid="statistics-loading"
                className="dashboard-page"
            >
                <p className="muted" role="status">
                    {t("common.loading", "Loading…")}
                </p>
            </main>
        );
    }

    const stats = [
        {
            key: "time",
            icon: <Timer size={18} aria-hidden="true" />,
            label: t("statistics.total_time", "Learning time"),
            value: formatDuration(overview.totalTimeSeconds, t),
            testId: "stat-total-time",
        },
        {
            key: "completed",
            icon: <GraduationCap size={18} aria-hidden="true" />,
            label: t("statistics.completed_lessons", "Completed lessons"),
            value: String(overview.completedLessons),
            testId: "stat-completed",
        },
        {
            key: "accuracy",
            icon: <Target size={18} aria-hidden="true" />,
            label: t("statistics.avg_accuracy", "Average accuracy"),
            value:
                overview.averageAccuracy === null
                    ? "-"
                    : `${overview.averageAccuracy}%`,
            testId: "stat-accuracy",
        },
        {
            key: "streak",
            icon: <Flame size={18} aria-hidden="true" />,
            label: t("statistics.current_streak", "Current streak"),
            value: t("statistics.streak_days", "{n} days").replace(
                "{n}",
                String(streak?.current_streak_days ?? 0),
            ),
            testId: "stat-streak",
        },
    ];

    return (
        <main id="main" data-testid="statistics" className="dashboard-page">
            <header className="dashboard-header">
                <h1>{t("statistics.title", "Learning statistics")}</h1>
            </header>

            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map((stat) => (
                    <article
                        key={stat.key}
                        className="dashboard-card"
                        data-testid={stat.testId}
                    >
                        <div className="flex items-center gap-2 text-fg-muted">
                            {stat.icon}
                            <span className="text-sm">{stat.label}</span>
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-fg-primary">
                            {stat.value}
                        </p>
                    </article>
                ))}
            </section>

            <section className="dashboard-card dashboard-card-wide">
                <h2 className="dashboard-card-title">
                    {t("statistics.weak_areas_title", "Areas to improve")}
                </h2>
                <WeakAreasList
                    items={weakAreas.map((area) => ({
                        id: `${area.setId}:${area.elementKey}`,
                        element: area.elementKey,
                        errors: area.errorCount,
                        last: area.lastAnswer,
                        onPractice: () =>
                            navigate(
                                `/review/${encodeURIComponent(area.setId)}`,
                            ),
                    }))}
                    practiceLabel={t("statistics.practice", "Practice")}
                    errorsLabel={t("statistics.errors", "errors")}
                    lastAnswerLabel={t(
                        "statistics.last_answer",
                        "Your last answer:",
                    )}
                    emptyLabel={t(
                        "statistics.weak_areas_empty",
                        "No mistakes tracked yet - keep going!",
                    )}
                    testId="statistics-weak-areas"
                />
            </section>

            <section className="dashboard-card dashboard-card-wide">
                <h2 className="dashboard-card-title">
                    {t("statistics.activity_title", "Activity (last 90 days)")}
                </h2>
                <ActivityHeatmap
                    data={activity}
                    ariaLabel={t(
                        "statistics.activity_aria",
                        "Lessons completed per day over the last 90 days",
                    )}
                    cellLabel={(date, count) =>
                        t("statistics.activity_cell", "{count} lessons on {date}")
                            .replace("{count}", String(count))
                            .replace("{date}", date)
                    }
                    emptyLabel={t(
                        "statistics.activity_empty",
                        "No activity yet.",
                    )}
                    testId="statistics-activity"
                />
            </section>

            <section className="dashboard-card dashboard-card-wide">
                <h2 className="dashboard-card-title">
                    {t("statistics.pairs_title", "Progress by language pair")}
                </h2>
                <ProgressByPair
                    pairs={pairs}
                    emptyLabel={t(
                        "statistics.pairs_empty",
                        "Download a lesson set to start tracking progress.",
                    )}
                    testId="statistics-pairs"
                />
            </section>
        </main>
    );
}
