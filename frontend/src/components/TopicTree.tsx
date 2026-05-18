import TopicNode from "./TopicNode";
import {buildTreeFromFlat} from "../lib/tree";
import type {LearningTopic} from "../types";

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
