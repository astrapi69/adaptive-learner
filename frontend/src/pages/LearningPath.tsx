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

import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {useI18n} from "../hooks/useI18n";
import LessonNode, {
    type LessonFlowNode,
} from "../components/learning-path/LessonNode";

const nodeTypes = {lesson: LessonNode};

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

// Static demo graph (66B) — replaced by the real graph builder in 66E.
const DEMO_NODES: LessonFlowNode[] = [
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
    {id: "e1-2", source: "1", target: "2"},
    {id: "e2-3", source: "2", target: "3"},
    {id: "e1-4", source: "1", target: "4"},
    {id: "e4-5", source: "4", target: "5"},
];

export default function LearningPath() {
    const {t} = useI18n();
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
            </header>
            <div
                className="learning-path-canvas"
                data-testid="learning-path-canvas"
            >
                <ReactFlow
                    nodes={DEMO_NODES}
                    edges={DEMO_EDGES}
                    nodeTypes={nodeTypes}
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
