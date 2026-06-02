/**
 * LessonNode — the React Flow node type for a lesson (Phase 66B).
 * Wraps the pure ``LessonNodeView`` with the graph Handles and the
 * click-to-navigate behaviour. Registered as nodeType ``"lesson"``.
 */

import {Handle, Position, type Node, type NodeProps} from "@xyflow/react";
import {useNavigate} from "react-router-dom";

import {LessonNodeView, type LessonNodeData} from "./LessonNodeView";

export type LessonFlowNode = Node<LessonNodeData, "lesson">;

export default function LessonNode({data}: NodeProps<LessonFlowNode>) {
    const navigate = useNavigate();
    return (
        <>
            <Handle
                type="target"
                position={Position.Top}
                className="lesson-node-handle"
            />
            <LessonNodeView
                data={data}
                onActivate={() =>
                    navigate(
                        `/lesson/${encodeURIComponent(
                            data.setSlug,
                        )}/${encodeURIComponent(
                            data.setId,
                        )}/${encodeURIComponent(data.lessonFilename)}`,
                    )
                }
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="lesson-node-handle"
            />
        </>
    );
}
