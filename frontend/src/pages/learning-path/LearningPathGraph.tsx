/**
 * Learning Path — Graph view (Phase 66 / EXP-022).
 *
 * An interactive, zoomable graph (React Flow / @xyflow) laid as a
 * pure presentation layer over real data: downloaded content sets,
 * lesson progress, per-direction mastery, and the adaptive
 * recommendation (66E). Nodes are draggable with per-user persisted
 * positions (66D); a Reset button restores the dagre auto-layout.
 *
 * Since the learning-path redesign this is the ALTERNATIVE view: the
 * default route renders the personal two-level list
 * (LearningPathPersonal) and lazy-loads THIS component (with its
 * ~100 KB xyflow dependency) only when the user switches to the graph
 * view — keeping xyflow out of the default bundle. ``headerExtra``
 * lets the parent inject the view switcher into the toolbar.
 */

import {useCallback, useEffect, useMemo, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    useEdgesState,
    useNodesState,
    type Edge,
    type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../hooks/ui/useI18n";
import {useLearningPathData} from "../../hooks/learning/useLearningPathData";
import LessonNode from "../../components/learning-path/LessonNode";
import SetGroupNode from "../../components/learning-path/SetGroupNode";
import {
    applyStoredPositions,
    clearPositions,
    layoutGraph,
    loadPositions,
    savePositions,
    snapshotPositions,
} from "../../lib/learning-path/layout";
import {readLearnerState} from "../../lib/learning/learnerState";
import {
    DEFAULT_FILTERS,
    classifyNode,
    firstMatch,
    graphStats,
    type GraphFilters,
} from "../../lib/learning-path/filters";
import type {LessonNodeData} from "../../components/learning-path/LessonNodeView";
import type {ErrorTag} from "../../lib/adaptive/error-classifier";

const nodeTypes = {lesson: LessonNode, setGroup: SetGroupNode};

const CLUSTER_TAG_LABELS: Record<ErrorTag, [string, string]> = {
    article_gender: ["dashboard.focus_areas.tag.article_gender", "Article gender"],
    spelling_accent: [
        "dashboard.focus_areas.tag.spelling_accent",
        "Spelling & accents",
    ],
    verb_conjugation: [
        "dashboard.focus_areas.tag.verb_conjugation",
        "Verb conjugation",
    ],
    word_order: ["dashboard.focus_areas.tag.word_order", "Word order"],
};

export interface LearningPathGraphProps {
    /** Optional view switcher injected by the parent (personal page). */
    headerExtra?: React.ReactNode;
}

export default function LearningPathGraph({
    headerExtra,
}: LearningPathGraphProps) {
    const {t} = useI18n();
    const userId = useMemo(() => readLearnerState().userId ?? "", []);
    const {state, built, clusters} = useLearningPathData(userId);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    useEffect(() => {
        if (state === "ready" && built) {
            setNodes(
                applyStoredPositions(
                    layoutGraph(built.nodes, built.edges),
                    loadPositions(userId),
                ),
            );
            setEdges(built.edges);
        }
    }, [state, built, userId, setNodes, setEdges]);

    const persist = useCallback(
        () => savePositions(userId, snapshotPositions(nodes)),
        [userId, nodes],
    );
    const resetLayout = useCallback(() => {
        if (!built) return;
        clearPositions(userId);
        setNodes(layoutGraph(built.nodes, built.edges));
    }, [userId, setNodes, built]);

    // Filters + search (66F).
    const navigate = useNavigate();
    const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
    const [statsOpen, setStatsOpen] = useState(true);
    const [showClusters, setShowClusters] = useState(false);
    const [selectedTag, setSelectedTag] = useState<ErrorTag | null>(null);

    const lessonData = useMemo(
        () =>
            nodes
                .filter((n) => n.type === "lesson")
                .map((n) => n.data as LessonNodeData),
        [nodes],
    );
    const selectedKeys = useMemo(() => {
        if (!showClusters || !selectedTag) return new Set<string>();
        const cluster = clusters.find((c) => c.tag === selectedTag);
        return new Set(cluster?.lessonKeys ?? []);
    }, [showClusters, selectedTag, clusters]);
    const displayedNodes = useMemo(
        () =>
            nodes.map((n) => {
                if (n.type !== "lesson") return n;
                const disp = classifyNode(n.data as LessonNodeData, filters);
                const cls = [
                    disp.faded ? "lp-faded" : "",
                    disp.highlighted ? "lp-highlighted" : "",
                    selectedKeys.has(n.id) ? "lp-cluster" : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                return {...n, hidden: disp.hidden, className: cls || undefined};
            }),
        [nodes, filters, selectedKeys],
    );
    const stats = useMemo(() => graphStats(lessonData), [lessonData]);

    const onSearchKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== "Enter") return;
            const m = firstMatch(lessonData, filters.query);
            if (m) {
                navigate(
                    `/lesson/${encodeURIComponent(m.setSlug)}/${encodeURIComponent(
                        m.setId,
                    )}/${encodeURIComponent(m.lessonFilename)}`,
                );
            }
        },
        [lessonData, filters.query, navigate],
    );

    return (
        <main
            id="main"
            className="learning-path-page"
            data-testid="learning-path-page"
        >
            <header className="learning-path-header">
                <h1>{t("learning_path.title", "Learning Path")}</h1>
                <p className="muted">
                    {t(
                        "learning_path.subtitle",
                        "Where you are and what comes next.",
                    )}
                </p>
                <div className="learning-path-toolbar">
                    {headerExtra}
                    <Button asChild variant="secondary">
                        <Link
                            to="/content?tab=my"
                            data-testid="learning-path-to-content"
                        >
                            {t("learning_path.to_content", "Content Browser")}
                        </Link>
                    </Button>
                    {state === "ready" && (
                        <Button
                            type="button"
                            variant="secondary"
                            data-testid="learning-path-reset"
                            onClick={resetLayout}
                        >
                            {t("learning_path.reset_layout", "Reset layout")}
                        </Button>
                    )}
                </div>
            </header>

            {state === "loading" && (
                <p
                    className="muted"
                    data-testid="learning-path-loading"
                    role="status"
                    aria-live="polite"
                >
                    {t("learning_path.loading", "Building your learning path…")}
                </p>
            )}

            {state === "empty" && (
                <div
                    className="content-empty"
                    data-testid="learning-path-empty"
                >
                    <p>
                        {t(
                            "learning_path.empty",
                            "Download a lesson set first to see your learning path.",
                        )}
                    </p>
                    <Button asChild variant="default">
                        <Link to="/content?tab=my">
                            {t("learning_path.empty_cta", "Browse content")}
                        </Link>
                    </Button>
                </div>
            )}

            {state === "error" && (
                <p
                    className="form-hint form-hint-warning"
                    data-testid="learning-path-error"
                    role="alert"
                >
                    {t(
                        "learning_path.error",
                        "Could not load your learning path.",
                    )}
                </p>
            )}

            {state === "ready" && (
                <div
                    className="learning-path-controls"
                    data-testid="learning-path-controls"
                >
                    <select
                        data-testid="learning-path-filter-status"
                        value={filters.status}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                status: e.target
                                    .value as GraphFilters["status"],
                            }))
                        }
                        aria-label={t(
                            "learning_path.filter.status",
                            "Status filter",
                        )}
                    >
                        <option value="all">
                            {t("learning_path.filter.all", "All")}
                        </option>
                        <option value="not_started">
                            {t(
                                "learning_path.filter.not_started",
                                "Not started",
                            )}
                        </option>
                        <option value="in_progress">
                            {t(
                                "learning_path.filter.in_progress",
                                "In progress",
                            )}
                        </option>
                        <option value="mastered">
                            {t("learning_path.filter.mastered", "Mastered")}
                        </option>
                    </select>
                    <select
                        data-testid="learning-path-filter-direction"
                        value={filters.direction}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                direction: e.target
                                    .value as GraphFilters["direction"],
                            }))
                        }
                        aria-label={t(
                            "learning_path.filter.direction",
                            "Direction filter",
                        )}
                    >
                        <option value="all">
                            {t("learning_path.filter.all", "All")}
                        </option>
                        <option value="receptive">
                            {t(
                                "learning_path.filter.receptive",
                                "Receptive only",
                            )}
                        </option>
                        <option value="productive">
                            {t(
                                "learning_path.filter.productive",
                                "Productive only",
                            )}
                        </option>
                    </select>
                    <input
                        type="search"
                        data-testid="learning-path-search"
                        className="learning-path-search"
                        aria-label={t(
                            "learning_path.search_label",
                            "Search lessons — press Enter to navigate to the first match",
                        )}
                        placeholder={t(
                            "learning_path.search_placeholder",
                            "Search lessons…",
                        )}
                        value={filters.query}
                        onChange={(e) =>
                            setFilters((f) => ({...f, query: e.target.value}))
                        }
                        onKeyDown={onSearchKeyDown}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid="learning-path-stats-toggle"
                        aria-expanded={statsOpen}
                        onClick={() => setStatsOpen((v) => !v)}
                    >
                        {t("learning_path.stats.title", "Stats")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid="learning-path-clusters-toggle"
                        aria-pressed={showClusters}
                        onClick={() => setShowClusters((v) => !v)}
                    >
                        {t(
                            "learning_path.clusters.toggle",
                            "Show error clusters",
                        )}
                    </Button>
                </div>
            )}

            {state === "ready" && showClusters && (
                <aside
                    className="learning-path-clusters"
                    data-testid="learning-path-clusters"
                    aria-live="polite"
                    aria-label={t(
                        "learning_path.clusters.region_label",
                        "Error clusters panel",
                    )}
                >
                    {clusters.length === 0 ? (
                        <p
                            className="muted"
                            data-testid="learning-path-clusters-empty"
                        >
                            {t(
                                "learning_path.clusters.empty",
                                "No shared error patterns yet — keep practising.",
                            )}
                        </p>
                    ) : (
                        clusters.map((c) => (
                            <div
                                key={c.tag}
                                className={`learning-path-cluster${
                                    selectedTag === c.tag ? " is-active" : ""
                                }`}
                                data-testid={`cluster-${c.tag}`}
                            >
                                <button
                                    type="button"
                                    className="learning-path-cluster-label"
                                    onClick={() =>
                                        setSelectedTag((prev) =>
                                            prev === c.tag ? null : c.tag,
                                        )
                                    }
                                >
                                    {t(...CLUSTER_TAG_LABELS[c.tag])} ·{" "}
                                    {t(
                                        "learning_path.clusters.lessons",
                                        "{n} lessons",
                                    ).replace("{n}", String(c.lessonKeys.length))}
                                </button>
                                <Button
                                    type="button"
                                    variant="default"
                                    data-testid={`cluster-adaptive-${c.tag}`}
                                    onClick={() =>
                                        navigate(
                                            `/adaptive-lesson/${encodeURIComponent(
                                                c.setId,
                                            )}`,
                                        )
                                    }
                                >
                                    {t(
                                        "learning_path.clusters.start_adaptive",
                                        "Start adaptive lesson",
                                    )}
                                </Button>
                            </div>
                        ))
                    )}
                </aside>
            )}

            {state === "ready" && statsOpen && (
                <aside
                    className="learning-path-stats"
                    data-testid="learning-path-stats"
                    aria-label={t(
                        "learning_path.stats.region_label",
                        "Learning path statistics",
                    )}
                    aria-live="polite"
                >
                    <span
                        data-testid="stat-lessons"
                        aria-label={t(
                            "learning_path.stats.lessons_aria",
                            "{done} of {total} lessons completed",
                        )
                            .replace("{done}", String(stats.completed))
                            .replace("{total}", String(stats.totalLessons))}
                    >
                        {t("learning_path.stats.lessons", "Lessons")}:{" "}
                        {stats.completed}/{stats.totalLessons}
                    </span>
                    <span
                        data-testid="stat-receptive"
                        aria-label={t(
                            "learning_path.stats.receptive_aria",
                            "{n} lessons receptive mastered",
                        ).replace("{n}", String(stats.receptiveMastered))}
                    >
                        {t("learning_path.stats.receptive", "Receptive")}:{" "}
                        {stats.receptiveMastered}
                    </span>
                    <span
                        data-testid="stat-productive"
                        aria-label={t(
                            "learning_path.stats.productive_aria",
                            "{n} lessons productive mastered",
                        ).replace("{n}", String(stats.productiveMastered))}
                    >
                        {t("learning_path.stats.productive", "Productive")}:{" "}
                        {stats.productiveMastered}
                    </span>
                </aside>
            )}

            {state === "ready" && (
                <div
                    className="learning-path-canvas"
                    data-testid="learning-path-canvas"
                >
                    <ReactFlow
                        nodes={displayedNodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeDragStop={persist}
                        fitView
                        minZoom={0.2}
                        maxZoom={2}
                        aria-label={t(
                            "learning_path.aria_canvas",
                            "Learning path graph",
                        )}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={18} />
                        <Controls />
                        <MiniMap pannable zoomable />
                    </ReactFlow>
                </div>
            )}
        </main>
    );
}
