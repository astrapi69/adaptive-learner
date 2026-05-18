import {useState} from "react";

import {useI18n} from "../hooks/useI18n";
import type {TypedTreeNode} from "../lib/tree";
import type {LearningTopic} from "../types";

interface TopicNodeProps {
    node: TypedTreeNode<LearningTopic, string>;
    onAddSubtopic: (parentId: string) => void;
    onRename: (topicId: string, currentTitle: string) => void;
    onDelete: (topicId: string) => void;
}

/**
 * Renders one topic + its descendants recursively. Pure
 * presentational: the page (``Curriculum.tsx``) owns the data
 * + the CRUD callbacks. Expand/collapse state is local per
 * node so unrelated nodes don't re-render together.
 */
export default function TopicNode({
    node,
    onAddSubtopic,
    onRename,
    onDelete,
}: TopicNodeProps) {
    const {t} = useI18n();
    const [expanded, setExpanded] = useState(true);
    const value = node.value;
    const children = node.children();
    const hasChildren = children.length > 0;

    return (
        <li className="topic-node" data-testid={`topic-node-${value.id}`}>
            <div className="topic-row">
                {hasChildren ? (
                    <button
                        type="button"
                        className="topic-toggle"
                        data-testid={`topic-toggle-${value.id}`}
                        onClick={() => setExpanded((v) => !v)}
                        aria-expanded={expanded}
                    >
                        {expanded ? "▼" : "▶"}
                    </button>
                ) : (
                    <span className="topic-toggle is-leaf" aria-hidden="true">
                        •
                    </span>
                )}
                <span className="topic-title">{value.title}</span>
                <span className="topic-actions">
                    <button
                        type="button"
                        className="topic-action-btn"
                        data-testid={`topic-add-${value.id}`}
                        onClick={() => onAddSubtopic(value.id)}
                        title={t("curriculum.add_subtopic", "Add subtopic")}
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className="topic-action-btn"
                        data-testid={`topic-rename-${value.id}`}
                        onClick={() => onRename(value.id, value.title)}
                        title={t("common.edit", "Edit")}
                    >
                        ✎
                    </button>
                    <button
                        type="button"
                        className="topic-action-btn is-danger"
                        data-testid={`topic-delete-${value.id}`}
                        onClick={() => onDelete(value.id)}
                        title={t("common.delete", "Delete")}
                    >
                        ✕
                    </button>
                </span>
            </div>
            {hasChildren && expanded && (
                <ul className="topic-children">
                    {children.map((child) => (
                        <TopicNode
                            key={child.id}
                            node={child}
                            onAddSubtopic={onAddSubtopic}
                            onRename={onRename}
                            onDelete={onDelete}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}
