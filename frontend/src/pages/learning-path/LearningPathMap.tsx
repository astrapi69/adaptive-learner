/**
 * /learning-path — Achievement Map view (Ansatz 4).
 *
 * The third view option alongside Personal (default) and Graph. Where
 * the Personal view answers "Wo bin ich? Was kommt als Nächstes?", the
 * Map answers "Wie viel habe ich INSGESAMT geschafft?" — a compact,
 * motivational, domain-grouped progress overview:
 *
 *   ┌────────────────────────────────────┐
 *   │ Gesamt: 42% abgeschlossen   ███░░░  │
 *   │ SPRACHEN                            │
 *   │  🏳  Französisch  ████████░░  60%   │
 *   │  🏳  Spanisch     ██████░░░░  45%   │
 *   │ WISSEN                              │
 *   │  🧠 Psychologie   ██████░░░░  55%   │
 *   │  </> Python       ████░░░░░░  35%   │
 *   └────────────────────────────────────┘
 *
 * Each set row is a 44px tap target that expands inline to the same
 * per-lesson LessonRow list the Personal view uses. Lazy-loaded (same
 * pattern as LearningPathGraph) and self-contained: it loads its own
 * usePersonalPath data and takes the shared view switcher as
 * ``headerExtra``.
 */

import {useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {
    BookOpen,
    Brain,
    ChevronDown,
    ChevronUp,
    Code,
    Languages as LanguagesIcon,
} from "lucide-react";

import {Progress} from "../../components/ui/progress";
import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/ui/useI18n";
import {usePersonalPath} from "../../hooks/learning/usePersonalPath";
import {readLearnerState} from "../../lib/learning/learnerState";
import type {PersonalPathSet} from "../../lib/learning-path/personal-path";
import LessonRow from "../../components/learning-path/LessonRow";

export interface LearningPathMapProps {
    /** The shared Personal/Map/Graph view switcher, rendered in the
     *  header so the user can flip views from here. */
    headerExtra?: React.ReactNode;
}

/** Domain icon: a flag-ish glyph for languages, brain for psychology,
 *  code for programming, book otherwise. */
function DomainIcon({domain}: {domain: string}) {
    const cls = "h-[18px] w-[18px] shrink-0 text-accent";
    if (domain === "language")
        return <LanguagesIcon className={cls} aria-hidden="true" />;
    if (domain === "psychology")
        return <Brain className={cls} aria-hidden="true" />;
    if (domain === "programming")
        return <Code className={cls} aria-hidden="true" />;
    return <BookOpen className={cls} aria-hidden="true" />;
}

function SetMapRow({
    set,
    isExpanded,
    onToggle,
}: {
    set: PersonalPathSet;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const {t} = useI18n();
    const Chevron = isExpanded ? ChevronUp : ChevronDown;
    return (
        <li>
            <Button
                variant="ghost"
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                data-testid={`map-set-${set.setId}`}
                className="flex w-full flex-col gap-2 rounded-app border border-border bg-card p-3 text-left hover:bg-muted"
            >
                <div className="flex items-center gap-2">
                    <DomainIcon domain={set.domain} />
                    <span className="flex-1 truncate font-medium text-foreground">
                        {set.title}
                    </span>
                    <span
                        className="text-sm font-semibold tabular-nums text-foreground"
                        data-testid={`map-set-percent-${set.setId}`}
                    >
                        {set.percentComplete}%
                    </span>
                    <Chevron
                        className="h-4 w-4 shrink-0 text-fg-muted"
                        aria-hidden="true"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Progress
                        value={set.percentComplete}
                        className="h-2 flex-1"
                        data-testid={`map-set-progress-${set.setId}`}
                    />
                    <span className="whitespace-nowrap text-xs text-fg-muted">
                        {t(
                            "learning_path.personal.lesson_count",
                            "{n} lessons",
                        ).replace("{n}", String(set.totalCount))}
                    </span>
                </div>
            </Button>
            {isExpanded && (
                <ul
                    className="mt-1 flex flex-col"
                    data-testid={`map-set-detail-${set.setId}`}
                >
                    {set.lessons.map((lesson) => (
                        <li key={lesson.filename}>
                            <LessonRow lesson={lesson} />
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function DomainGroup({
    titleKey,
    fallback,
    domainKey,
    sets,
    expanded,
    onToggle,
}: {
    titleKey: string;
    fallback: string;
    domainKey: string;
    sets: PersonalPathSet[];
    expanded: string | null;
    onToggle: (setId: string) => void;
}) {
    const {t} = useI18n();
    if (sets.length === 0) return null;
    return (
        <section
            className="mt-4 flex flex-col gap-2"
            data-testid={`map-group-${domainKey}`}
        >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
                {t(titleKey, fallback)}
            </h2>
            <ul className="flex flex-col gap-2">
                {sets.map((set) => (
                    <SetMapRow
                        key={`${set.source}#${set.setId}`}
                        set={set}
                        isExpanded={expanded === set.setId}
                        onToggle={() => onToggle(set.setId)}
                    />
                ))}
            </ul>
        </section>
    );
}

export default function LearningPathMap({headerExtra}: LearningPathMapProps) {
    const {t} = useI18n();
    const userId = useMemo(() => readLearnerState().userId ?? "", []);
    const {state, data} = usePersonalPath(userId);
    const [expanded, setExpanded] = useState<string | null>(null);

    const toggle = (setId: string) =>
        setExpanded((e) => (e === setId ? null : setId));

    const sets = data?.activeSets ?? [];
    const languageSets = sets.filter((s) => s.domain === "language");
    const knowledgeSets = sets.filter((s) => s.domain !== "language");

    // Total = completed lessons / total lessons across all active sets
    // (lesson-weighted, more honest than averaging per-set percentages).
    const totals = sets.reduce(
        (acc, s) => {
            acc.done += s.completedCount;
            acc.total += s.totalCount;
            return acc;
        },
        {done: 0, total: 0},
    );
    const totalPercent =
        totals.total > 0 ? Math.round((100 * totals.done) / totals.total) : 0;

    return (
        <main
            id="main"
            className="learning-path-page"
            data-testid="learning-path-page"
        >
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-foreground">
                    {t("learning_path.personal.title", "Your Learning Path")}
                </h1>
                {headerExtra}
            </header>

            {state === "loading" && (
                <p
                    className="text-fg-muted"
                    data-testid="learning-path-loading"
                    role="status"
                    aria-live="polite"
                >
                    {t("learning_path.loading", "Building your learning path…")}
                </p>
            )}

            {state === "error" && (
                <p
                    className="text-warning"
                    data-testid="learning-path-error"
                    role="alert"
                >
                    {t(
                        "learning_path.error",
                        "Could not load your learning path.",
                    )}
                </p>
            )}

            {state === "empty" && (
                <div
                    className="rounded-app border border-border bg-card p-6 text-center"
                    data-testid="learning-path-empty"
                >
                    <p className="mb-3 text-fg-muted">
                        {t(
                            "learning_path.personal.empty",
                            "Download a lesson set to begin.",
                        )}
                    </p>
                    <Button asChild variant="default">
                        <Link
                            to="/content?tab=my"
                            className="rounded-app bg-accent font-medium text-accent-fg"
                            data-testid="learning-path-to-content"
                        >
                            {t("learning_path.empty_cta", "Browse content")}
                        </Link>
                    </Button>
                </div>
            )}

            {state === "ready" && data && (
                <div data-testid="learning-path-map">
                    <div
                        className="rounded-app border border-border bg-card p-4"
                        data-testid="map-total"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                                {t(
                                    "learning_path.map.total",
                                    "Total: {n}% complete",
                                ).replace("{n}", String(totalPercent))}
                            </span>
                            <span className="text-lg font-bold tabular-nums text-foreground">
                                {totalPercent}%
                            </span>
                        </div>
                        <Progress
                            value={totalPercent}
                            className="mt-2 h-3"
                            data-testid="map-total-progress"
                        />
                    </div>

                    <DomainGroup
                        titleKey="learning_path.map.languages"
                        fallback="Languages"
                        domainKey="languages"
                        sets={languageSets}
                        expanded={expanded}
                        onToggle={toggle}
                    />
                    <DomainGroup
                        titleKey="learning_path.map.knowledge"
                        fallback="Knowledge"
                        domainKey="knowledge"
                        sets={knowledgeSets}
                        expanded={expanded}
                        onToggle={toggle}
                    />
                </div>
            )}
        </main>
    );
}
