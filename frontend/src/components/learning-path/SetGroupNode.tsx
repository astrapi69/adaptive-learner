/**
 * SetGroupNode — the React Flow group node type for a content set
 * (Phase 66C). Wraps the pure ``SetGroupNodeView``; the collapse
 * toggle is supplied via ``data.onToggle`` so the page owns the
 * collapsed state (wired to hide the set's lessons in 66E).
 */

import {type Node, type NodeProps} from "@xyflow/react";

import {SetGroupNodeView, type SetGroupNodeData} from "./SetGroupNodeView";

export type SetGroupFlowNode = Node<SetGroupNodeData, "setGroup">;

export default function SetGroupNode({data}: NodeProps<SetGroupFlowNode>) {
    const onToggle =
        typeof data.onToggle === "function"
            ? (data.onToggle as () => void)
            : undefined;
    return <SetGroupNodeView data={data} onToggle={onToggle} />;
}
