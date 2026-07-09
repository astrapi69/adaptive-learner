/**
 * /learning-path — Personal Learning Path (redesign).
 *
 * Replaces the all-225-lessons xyflow graph as the DEFAULT view. It
 * answers the learner's real question ("Wo bin ich? Was kommt als
 * Nächstes?") with two zoom levels:
 *
 *   Level 1 — one compact SetRow per downloaded set (progress track,
 *             percentage, last activity, current/next lesson, one
 *             action), sorted by last activity.
 *   Level 2 — expand a row to per-lesson detail (SetDetail).
 *
 * The old graph is kept as an ALTERNATIVE view (LearningPathGraph),
 * lazy-loaded only when the user switches to it — so xyflow (~100 KB)
 * stays out of the default bundle. The chosen view is NOT persisted:
 * the page always opens on Personal ("where am I?", #1453).
 *
 * Storage-mode-agnostic via usePersonalPath → getStorage(); renders
 * nothing user-hostile in Dexie mode (no raw API errors).
 */

import {lazy, Suspense, useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {LayoutList, ListChecks, Map as MapIcon, Network} from "lucide-react";

import {useFeature} from "@astrapi69/feature-strategy-react";

import {useI18n} from "../../hooks/ui/useI18n";
import {FEATURES} from "../../features/featureConfig";
import {usePersonalPath} from "../../hooks/learning/usePersonalPath";
import type {PersonalPathState} from "../../hooks/learning/usePersonalPath";
import type {PersonalPathData} from "../../lib/learning-path/personal-path";
import {readLearnerState} from "../../lib/learning/learnerState";
import SetRow from "../../components/learning-path/SetRow";
import SetDetail from "../../components/learning-path/SetDetail";
import NotDownloadedSection from "../../components/learning-path/NotDownloadedSection";
import CustomPathsView from "../../components/learning-path/CustomPathsView";
import {Progress} from "../../components/ui/progress";
import {Button} from "@/components/ui/button";
import {cn} from "../../lib/utils";

const LearningPathGraph = lazy(() => import("./LearningPathGraph"));
const LearningPathMap = lazy(() => import("./LearningPathMap"));

type ViewMode = "personal" | "graph" | "map" | "paths";
type FilterMode = "mine" | "all";
const FILTER_KEY = "adaptive-learner.learning-path-filter";

// #1453 - the active view is deliberately NOT persisted. Opening the
// Learning Path always starts on "Personal" (the learner's "where am I?"
// question), never the last-visited tab. The prior localStorage-backed
// ``loadView`` is gone on purpose.

function loadFilter(): FilterMode {
    try {
        return localStorage.getItem(FILTER_KEY) === "all" ? "all" : "mine";
    } catch {
        return "mine";
    }
}

/** [Nur meine ◉] [Alle Sets ○] — controls how prominent the
 *  not-downloaded section is (collapsed vs expanded). */
function FilterToggle({
    filter,
    onChange,
}: {
    filter: FilterMode;
    onChange: (f: FilterMode) => void;
}) {
    const {t} = useI18n();
    const btn = (mode: FilterMode, label: string) => (
        <Button
            variant="ghost"
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={filter === mode}
            data-testid={`learning-path-filter-${mode}`}
            className={cn(
                "rounded-app px-3 py-2 font-medium",
                filter === mode
                    ? "bg-accent text-accent-fg"
                    : "text-fg-secondary hover:bg-muted",
            )}
        >
            {label}
        </Button>
    );
    return (
        <div
            role="group"
            aria-label={t("learning_path.filter_label", "Filter sets")}
            className="inline-flex items-center gap-1 rounded-app border border-border p-0.5"
            data-testid="learning-path-filter-switch"
        >
            {btn("mine", t("learning_path.filter_mine", "Only mine"))}
            {btn("all", t("learning_path.filter_all", "All sets"))}
        </div>
    );
}

function ViewSwitcher({
    view,
    onChange,
    graphEnabled,
}: {
    view: ViewMode;
    onChange: (v: ViewMode) => void;
    graphEnabled: boolean;
}) {
    const {t} = useI18n();
    const btn = (mode: ViewMode, label: string, icon: React.ReactNode) => (
        <Button
            variant="ghost"
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={view === mode}
            data-testid={`learning-path-view-${mode}`}
            className={cn(
                "gap-1.5 rounded-app px-3 py-2 font-medium",
                view === mode
                    ? "bg-accent text-accent-fg"
                    : "text-fg-secondary hover:bg-muted",
            )}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </Button>
    );
    return (
        <div
            role="group"
            aria-label={t("learning_path.view.label", "View")}
            className="inline-flex items-center gap-1 rounded-app border border-border p-0.5"
            data-testid="learning-path-view-switch"
        >
            {btn(
                "personal",
                t("learning_path.view.personal", "Personal"),
                <LayoutList size={16} aria-hidden="true" />,
            )}
            {btn(
                "paths",
                t("learning_path.view.paths", "My paths"),
                <ListChecks size={16} aria-hidden="true" />,
            )}
            {btn(
                "map",
                t("learning_path.view.map", "Map"),
                <MapIcon size={16} aria-hidden="true" />,
            )}
            {/* Graph view gated behind LEARNING_PATH_GRAPH (disabled until the
                graph layout is fixed, #900). */}
            {graphEnabled &&
                btn(
                    "graph",
                    t("learning_path.view.graph", "Graph"),
                    <Network size={16} aria-hidden="true" />,
                )}
        </div>
    );
}

export default function LearningPathPersonal() {
    const {t} = useI18n();
    const userId = useMemo(() => readLearnerState().userId ?? "", []);
    const {state, data, reload} = usePersonalPath(userId);
    const graphEnabled = useFeature(FEATURES.LEARNING_PATH_GRAPH).isActive;
    // #1453 - always start on "personal"; the view is not persisted.
    const [view, setView] = useState<ViewMode>("personal");
    const [filter, setFilter] = useState<FilterMode>(loadFilter);
    const [expanded, setExpanded] = useState<string | null>(null);

    const changeView = (v: ViewMode) => {
        setView(v);
    };

    const changeFilter = (f: FilterMode) => {
        setFilter(f);
        try {
            localStorage.setItem(FILTER_KEY, f);
        } catch {
            /* private mode — filter simply doesn't persist */
        }
    };

    // A persisted view=graph selection falls back to the personal view while
    // the Graph feature is disabled (#900), so the gate also covers reloads.
    const effectiveView: ViewMode =
        view === "graph" && !graphEnabled ? "personal" : view;

    const switcher = (
        <ViewSwitcher
            view={effectiveView}
            onChange={changeView}
            graphEnabled={graphEnabled}
        />
    );

    const viewFallback = (
        <main id="main" className="page" data-testid="learning-path-page">
            <p className="muted" role="status" aria-live="polite">
                {t("learning_path.loading", "Building your learning path…")}
            </p>
        </main>
    );

    if (effectiveView === "map") {
        return (
            <Suspense fallback={viewFallback}>
                <LearningPathMap headerExtra={switcher} />
            </Suspense>
        );
    }

    if (effectiveView === "graph") {
        return (
            <Suspense fallback={viewFallback}>
                <LearningPathGraph headerExtra={switcher} />
            </Suspense>
        );
    }

    if (effectiveView === "paths") {
        return (
            <main
                id="main"
                className="learning-path-page"
                data-testid="learning-path-page"
            >
                <header className="mb-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h1 className="text-2xl font-bold text-foreground">
                            {t(
                                "learning_path.custom.title",
                                "My Learning Paths",
                            )}
                        </h1>
                        {switcher}
                    </div>
                    <p className="text-sm text-fg-muted">
                        {t(
                            "learning_path.custom.subtitle",
                            "Assemble lessons into your own ordered path.",
                        )}
                    </p>
                </header>
                <CustomPathsView userId={userId} />
            </main>
        );
    }

    return (
        <PersonalListView
            state={state}
            data={data}
            filter={filter}
            onChangeFilter={changeFilter}
            expanded={expanded}
            onToggleExpand={setExpanded}
            switcher={switcher}
            reload={reload}
        />
    );
}

interface PersonalListViewProps {
    state: PersonalPathState;
    data: PersonalPathData | null;
    filter: FilterMode;
    onChangeFilter: (f: FilterMode) => void;
    expanded: string | null;
    onToggleExpand: (updater: (prev: string | null) => string | null) => void;
    switcher: React.ReactNode;
    reload: () => void;
}

/**
 * The default (personal) list view: header + overall progress (computed
 * over started sets) + the filtered set rows + the not-downloaded
 * section. Split out of {@link LearningPathPersonal} so each function's
 * cyclomatic complexity stays under the gate (#1453).
 */
function PersonalListView({
    state,
    data,
    filter,
    onChangeFilter,
    expanded,
    onToggleExpand,
    switcher,
    reload,
}: PersonalListViewProps) {
    const {t} = useI18n();
    // #1453 - a set counts as "started" once the learner has touched any of
    // its lessons (a progress row exists → ``lastActivity`` is set).
    const activeSets = data?.activeSets ?? [];
    const startedSets = activeSets.filter((s) => s.lastActivity !== null);
    // BEFUND 1: "Only mine" shows started sets; "All sets" adds the
    // downloaded-but-never-started ones. The filter finally drives the list.
    const visibleSets = filter === "mine" ? startedSets : activeSets;
    // BEFUND 2: overall progress is lesson-weighted over STARTED sets only, so
    // a never-started set (or a new set added to the app) cannot move it.
    const startedTotals = startedSets.reduce(
        (acc, set) => {
            acc.done += set.completedCount;
            acc.total += set.totalCount;
            return acc;
        },
        {done: 0, total: 0},
    );
    const personalPercent =
        startedTotals.total > 0
            ? Math.round((100 * startedTotals.done) / startedTotals.total)
            : 0;
    const noneStartedButDownloaded =
        state === "ready" &&
        filter === "mine" &&
        visibleSets.length === 0 &&
        activeSets.length > 0;

    return (
        <main
            id="main"
            className="learning-path-page"
            data-testid="learning-path-page"
        >
            <header className="mb-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                        {t("learning_path.personal.title", "Your Learning Path")}
                    </h1>
                    {switcher}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-fg-muted">
                        {t(
                            "learning_path.subtitle",
                            "Where you are and what comes next.",
                        )}
                    </p>
                    <FilterToggle filter={filter} onChange={onChangeFilter} />
                </div>
            </header>

            {state === "ready" && startedSets.length > 0 && (
                <div
                    className="mb-4 rounded-app border border-border bg-card p-4"
                    data-testid="learning-path-personal-progress"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                            {t(
                                "learning_path.personal.progress",
                                "Overall: {n}% complete",
                            ).replace("{n}", String(personalPercent))}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-foreground">
                            {personalPercent}%
                        </span>
                    </div>
                    <Progress
                        value={personalPercent}
                        className="mt-2 h-3"
                        data-testid="learning-path-personal-progress-bar"
                    />
                </div>
            )}

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
                <ul
                    className="flex flex-col gap-3"
                    data-testid="learning-path-sets"
                >
                    {visibleSets.map((set) => (
                        <li key={`${set.source}#${set.setId}`}>
                            <SetRow
                                set={set}
                                isExpanded={expanded === set.setId}
                                onToggle={() =>
                                    onToggleExpand((e) =>
                                        e === set.setId ? null : set.setId,
                                    )
                                }
                            >
                                <SetDetail set={set} />
                            </SetRow>
                        </li>
                    ))}
                </ul>
            )}

            {noneStartedButDownloaded && (
                <p
                    className="rounded-app border border-border bg-card p-4 text-sm text-fg-muted"
                    data-testid="learning-path-none-started"
                >
                    {t(
                        "learning_path.personal.none_started",
                        'You have not started any set yet. Switch to "All sets" to see your downloaded sets.',
                    )}
                </p>
            )}

            {(state === "ready" || state === "empty") && data && (
                <NotDownloadedSection
                    sets={data.notDownloadedSets}
                    expanded={filter === "all"}
                    onDownloaded={reload}
                />
            )}
        </main>
    );
}
