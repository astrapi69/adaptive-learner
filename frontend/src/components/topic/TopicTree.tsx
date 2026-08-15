import {buildTreeFromFlat} from "@astrapi69/tree-kit";

import TopicNode from "./TopicNode";
import type {LearningTopic} from "../../types";

interface TopicTreeProps {
    topics: readonly LearningTopic[];
    onAddSubtopic: (parentId: string) => void;
    onRename: (topicId: string, currentTitle: string) => void;
    onDelete: (topicId: string) => void;
}

/**
 * Renders a forest of topic trees from a flat
 * ``LearningTopic`` list. Uses the TypedTreeNode adapter +
 * ``buildTreeFromFlat`` from the Phase 4A foundation, sorting
 * siblings by ``order_index`` then ``created_at`` for a stable
 * order across reloads.
 *
 * Empty-state: an explicit empty <ul> so the parent's "add
 * topic" UI surface stays the only affordance for an empty
 * curriculum.
 */
export default function TopicTree({
    topics,
    onAddSubtopic,
    onRename,
    onDelete,
}: TopicTreeProps) {
    const forest = buildTreeFromFlat(topics, {
        getId: (t) => t.id,
        getParentId: (t) => t.parent_id,
        sort: (a, b) => {
            if (a.order_index !== b.order_index) {
                return a.order_index - b.order_index;
            }
            return a.created_at.localeCompare(b.created_at);
        },
        // A dangling parent_id (parent deleted, child survived a sync)
        // must render at top level, not crash the whole curriculum view -
        // tree-kit's strict default throws on the first bad row.
        onInvalidParent: "promoteToRoot",
    });
    return (
        <ul className="topic-tree" data-testid="topic-tree">
            {forest.map((root) => (
                <TopicNode
                    key={root.id}
                    node={root}
                    onAddSubtopic={onAddSubtopic}
                    onRename={onRename}
                    onDelete={onDelete}
                />
            ))}
        </ul>
    );
}
