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
    type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {useI18n} from "../hooks/useI18n";

// Static demo graph (66A) — replaced by the real graph builder in 66E.
const DEMO_NODES: Node[] = [
    {id: "1", position: {x: 0, y: 0}, data: {label: "Lesson 1"}},
    {id: "2", position: {x: 0, y: 110}, data: {label: "Lesson 2"}},
    {id: "3", position: {x: 0, y: 220}, data: {label: "Lesson 3"}},
    {id: "4", position: {x: 220, y: 55}, data: {label: "Lesson 4"}},
    {id: "5", position: {x: 220, y: 165}, data: {label: "Lesson 5"}},
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
