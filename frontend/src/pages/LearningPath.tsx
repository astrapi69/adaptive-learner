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

import {useCallback, useEffect, useMemo} from "react";
import {Link} from "react-router-dom";
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
                    className="learning-path-canvas"
                    data-testid="learning-path-canvas"
                >
                    <ReactFlow
                        nodes={nodes}
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
