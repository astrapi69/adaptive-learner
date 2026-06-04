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
 * stays out of the default bundle. The chosen view persists in
 * localStorage.
 *
 * Storage-mode-agnostic via usePersonalPath → getStorage(); renders
 * nothing user-hostile in Dexie mode (no raw API errors).
 */

import {lazy, Suspense, useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {LayoutList, Network} from "lucide-react";

import {useI18n} from "../hooks/useI18n";
import {usePersonalPath} from "../hooks/usePersonalPath";
import {readLearnerState} from "../lib/learnerState";
import SetRow from "../components/learning-path/SetRow";
import SetDetail from "../components/learning-path/SetDetail";
import NotDownloadedSection from "../components/learning-path/NotDownloadedSection";
import {cn} from "../lib/utils";

const LearningPathGraph = lazy(() => import("./LearningPathGraph"));

type ViewMode = "personal" | "graph";
type FilterMode = "mine" | "all";
const VIEW_KEY = "adaptive-learner.learning-path-view";
const FILTER_KEY = "adaptive-learner.learning-path-filter";

function loadView(): ViewMode {
    try {
        return localStorage.getItem(VIEW_KEY) === "graph"
            ? "graph"
            : "personal";
    } catch {
        return "personal";
    }
}

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
        <button
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={filter === mode}
            data-testid={`learning-path-filter-${mode}`}
            className={cn(
                "inline-flex min-h-[44px] items-center rounded-app px-3 py-2 text-sm font-medium",
                filter === mode
                    ? "bg-accent text-accent-fg"
                    : "text-fg-secondary hover:bg-muted",
            )}
        >
            {label}
        </button>
    );
    return (
        <div
            role="group"
            aria-label={t("learning_path.filter.label", "Filter sets")}
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
}: {
    view: ViewMode;
    onChange: (v: ViewMode) => void;
}) {
    const {t} = useI18n();
    const btn = (mode: ViewMode, label: string, icon: React.ReactNode) => (
        <button
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={view === mode}
            data-testid={`learning-path-view-${mode}`}
            className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-app px-3 py-2 text-sm font-medium",
                view === mode
                    ? "bg-accent text-accent-fg"
                    : "text-fg-secondary hover:bg-muted",
            )}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
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
    const [view, setView] = useState<ViewMode>(loadView);
    const [filter, setFilter] = useState<FilterMode>(loadFilter);
    const [expanded, setExpanded] = useState<string | null>(null);

    const changeView = (v: ViewMode) => {
        setView(v);
        try {
            localStorage.setItem(VIEW_KEY, v);
        } catch {
            /* private mode — view simply doesn't persist */
        }
    };

    const changeFilter = (f: FilterMode) => {
        setFilter(f);
        try {
            localStorage.setItem(FILTER_KEY, f);
        } catch {
            /* private mode — filter simply doesn't persist */
        }
    };

    const switcher = <ViewSwitcher view={view} onChange={changeView} />;

    if (view === "graph") {
        return (
            <Suspense
                fallback={
                    <main id="main" className="page" data-testid="learning-path-page">
                        <p className="muted" role="status" aria-live="polite">
                            {t("learning_path.loading", "Building your learning path…")}
                        </p>
                    </main>
                }
            >
                <LearningPathGraph headerExtra={switcher} />
            </Suspense>
        );
    }

    return (
        <main
            id="main"
            className="page learning-path-page"
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
                    <FilterToggle filter={filter} onChange={changeFilter} />
                </div>
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
                    <Link
                        to="/content"
                        className="inline-flex min-h-[44px] items-center rounded-app bg-accent px-4 py-2 font-medium text-accent-fg"
                        data-testid="learning-path-to-content"
                    >
                        {t("learning_path.empty_cta", "Browse content")}
                    </Link>
                </div>
            )}

            {state === "ready" && data && (
                <ul
                    className="flex flex-col gap-3"
                    data-testid="learning-path-sets"
                >
                    {data.activeSets.map((set) => (
                        <li key={`${set.source}#${set.setId}`}>
                            <SetRow
                                set={set}
                                isExpanded={expanded === set.setId}
                                onToggle={() =>
                                    setExpanded((e) =>
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
