/**
 * /learning-path — Visual Learning Path (Phase 66 / EXP-022).
 *
 * An interactive, zoomable graph (React Flow / @xyflow) laid as a
 * pure presentation layer over existing data (content sets, lesson
 * progress, mastery, the adaptive recommendation). 66A ships the
 * canvas + routing with a small static demo graph to verify the
 * setup; real-data nodes/edges land in 66B-66E.
 *
 * Lazy-loaded (xyflow is ~100 KB) via App.tsx's React.lazy.
 */

import {useCallback, useMemo} from "react";
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
import LessonNode, {
    type LessonFlowNode,
} from "../components/learning-path/LessonNode";
import SetGroupNode from "../components/learning-path/SetGroupNode";
import {
    applyStoredPositions,
    clearPositions,
    layoutGraph,
    loadPositions,
    makeEdge,
    savePositions,
    snapshotPositions,
} from "../lib/learning-path/layout";
import {readLearnerState} from "../lib/learnerState";

const nodeTypes = {lesson: LessonNode, setGroup: SetGroupNode};

function demo(
    id: string,
    x: number,
    y: number,
    data: Partial<LessonFlowNode["data"]>,
): LessonFlowNode {
    return {
        id,
        type: "lesson",
        position: {x, y},
        data: {
            lessonNumber: Number(id),
            title: `Lesson ${id}`,
            stars: 0,
            status: "not_started",
            receptiveMastered: false,
            productiveMastered: false,
            xp: 0,
            exerciseCount: 10,
            recommended: false,
            locked: false,
            setSlug: "demo",
            setId: "demo",
            lessonFilename: `${id}.json`,
            ...data,
        },
    };
}

// Static demo graph (66B/66C) — replaced by the real graph builder
// in 66E.
const DEMO_NODES: Node[] = [
    {
        id: "group-fr",
        type: "setGroup",
        position: {x: -320, y: 0},
        data: {
            setId: "fr-a1",
            title: "Français A1",
            sourceLanguage: "de",
            targetLanguage: "fr",
            completed: 2,
            total: 5,
            receptiveMastered: 8,
            productiveMastered: 3,
            collapsed: false,
        },
    },
    demo("1", 0, 0, {
        title: "Les articles",
        stars: 3,
        status: "mastered",
        receptiveMastered: true,
        productiveMastered: true,
        xp: 80,
    }),
    demo("2", 0, 140, {
        title: "Être et avoir",
        stars: 2,
        status: "completed",
        receptiveMastered: true,
        xp: 50,
    }),
    demo("3", 0, 280, {title: "Se présenter", stars: 1, status: "in_progress"}),
    demo("4", 260, 70, {title: "La famille", status: "paused"}),
    demo("5", 260, 210, {
        title: "Les couleurs",
        status: "not_started",
        recommended: true,
    }),
];

const DEMO_EDGES: Edge[] = [
    makeEdge("e1-2", "1", "2", "completed"),
    makeEdge("e2-3", "2", "3", "upcoming"),
    makeEdge("e1-4", "1", "4", "upcoming"),
    makeEdge("e4-5", "4", "5", "adaptive"),
];

export default function LearningPath() {
    const {t} = useI18n();
    const userId = useMemo(() => readLearnerState().userId ?? "", []);
    const initialNodes = useMemo(
        () =>
            applyStoredPositions(
                layoutGraph(DEMO_NODES, DEMO_EDGES),
                loadPositions(userId),
            ),
        [userId],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(DEMO_EDGES);

    // Persist custom positions after a drag (per user, localStorage).
    const persist = useCallback(
        () => savePositions(userId, snapshotPositions(nodes)),
        [userId, nodes],
    );
    const resetLayout = useCallback(() => {
        clearPositions(userId);
        setNodes(layoutGraph(DEMO_NODES, DEMO_EDGES));
    }, [userId, setNodes]);

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
                    <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid="learning-path-reset"
                        onClick={resetLayout}
                    >
                        {t("learning_path.reset_layout", "Reset layout")}
                    </button>
                </div>
            </header>
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
        </main>
    );
}
