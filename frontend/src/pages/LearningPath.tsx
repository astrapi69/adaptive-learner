/**
 * /learning-path — Visual Learning Path (Phase 66 / EXP-022).
 *
 * An interactive, zoomable graph (React Flow / @xyflow) laid as a
 * pure presentation layer over real data: downloaded content sets,
 * lesson progress, per-direction mastery, and the adaptive
 * recommendation (66E). Nodes are draggable with per-user persisted
 * positions (66D); a Reset button restores the dagre auto-layout.
 *
 * Lazy-loaded (xyflow is ~100 KB) via App.tsx's React.lazy.
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

import {useI18n} from "../hooks/useI18n";
import {useLearningPathData} from "../hooks/useLearningPathData";
import LessonNode from "../components/learning-path/LessonNode";
import SetGroupNode from "../components/learning-path/SetGroupNode";
import {
    applyStoredPositions,
    clearPositions,
    layoutGraph,
    loadPositions,
    savePositions,
    snapshotPositions,
} from "../lib/learning-path/layout";
import {readLearnerState} from "../lib/learnerState";
import {
    DEFAULT_FILTERS,
    classifyNode,
    firstMatch,
    graphStats,
    type GraphFilters,
} from "../lib/learning-path/filters";
import type {LessonNodeData} from "../components/learning-path/LessonNodeView";

const nodeTypes = {lesson: LessonNode, setGroup: SetGroupNode};

export default function LearningPath() {
    const {t} = useI18n();
    const userId = useMemo(() => readLearnerState().userId ?? "", []);
    const {state, built} = useLearningPathData(userId);

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

    const lessonData = useMemo(
        () =>
            nodes
                .filter((n) => n.type === "lesson")
                .map((n) => n.data as LessonNodeData),
        [nodes],
    );
    const displayedNodes = useMemo(
        () =>
            nodes.map((n) => {
                if (n.type !== "lesson") return n;
                const disp = classifyNode(n.data as LessonNodeData, filters);
                const cls = [
                    disp.faded ? "lp-faded" : "",
                    disp.highlighted ? "lp-highlighted" : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                return {...n, hidden: disp.hidden, className: cls || undefined};
            }),
        [nodes, filters],
    );
    const stats = useMemo(() => graphStats(lessonData), [lessonData]);

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        const m = firstMatch(lessonData, filters.query);
        if (m) {
            navigate(
                `/lesson/${encodeURIComponent(m.setSlug)}/${encodeURIComponent(
                    m.setId,
                )}/${encodeURIComponent(m.lessonFilename)}`,
            );
        }
    };

    return (
        <main
            id="main"
            className="page learning-path-page"
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
                    <Link
                        to="/content"
                        className="btn btn-secondary"
                        data-testid="learning-path-to-content"
                    >
                        {t("learning_path.to_content", "Content Browser")}
                    </Link>
                    {state === "ready" && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            data-testid="learning-path-reset"
                            onClick={resetLayout}
                        >
                            {t("learning_path.reset_layout", "Reset layout")}
                        </button>
                    )}
                </div>
            </header>

            {state === "loading" && (
                <p className="muted" data-testid="learning-path-loading">
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
                    <Link to="/content" className="btn btn-primary">
                        {t("learning_path.empty_cta", "Browse content")}
                    </Link>
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
                    <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid="learning-path-stats-toggle"
                        aria-expanded={statsOpen}
                        onClick={() => setStatsOpen((v) => !v)}
                    >
                        {t("learning_path.stats.title", "Stats")}
                    </button>
                </div>
            )}

            {state === "ready" && statsOpen && (
                <aside
                    className="learning-path-stats"
                    data-testid="learning-path-stats"
                    aria-live="polite"
                >
                    <span data-testid="stat-lessons">
                        {t("learning_path.stats.lessons", "Lessons")}:{" "}
                        {stats.completed}/{stats.totalLessons}
                    </span>
                    <span data-testid="stat-receptive">
                        {t("learning_path.stats.receptive", "Receptive")}:{" "}
                        {stats.receptiveMastered}
                    </span>
                    <span data-testid="stat-productive">
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
