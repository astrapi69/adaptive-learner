import {useState} from "react";

import {useButtonTooltips} from "../hooks/settings/useButtonTooltips";
import {useI18n} from "../hooks/ui/useI18n";
import {useSwipe} from "../hooks/ui/useSwipe";
import type {TypedTreeNode} from "../lib/tree";
import {readGesturePref} from "../lib/gesturePref";
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
    const tooltipsOn = useButtonTooltips();
    const [expanded, setExpanded] = useState(true);
    const [actionsRevealed, setActionsRevealed] = useState(false);
    const value = node.value;
    const children = node.children();
    const hasChildren = children.length > 0;

    // v1.10.0 / Phase 23D — iOS-style swipe-to-reveal on touch.
    // The actions are hidden by default on mobile (CSS media
    // query); swipe-left exposes them, swipe-right collapses
    // back. Desktop keeps the current always-visible behavior.
    const {ref: swipeRef} = useSwipe<HTMLDivElement>({
        enabled: readGesturePref(),
        onSwipeLeft: () => setActionsRevealed(true),
        onSwipeRight: () => setActionsRevealed(false),
    });

    return (
        <li className="topic-node" data-testid={`topic-node-${value.id}`}>
            <div
                ref={swipeRef}
                className="topic-row"
                data-actions-revealed={actionsRevealed ? "true" : "false"}
                data-testid={`topic-row-${value.id}`}
                onClick={(e) => {
                    // Tap-anywhere-else (not on an action button)
                    // collapses the revealed state. Mirrors iOS
                    // Mail behaviour.
                    const target = e.target as HTMLElement;
                    if (
                        actionsRevealed &&
                        !target.closest(".topic-action-btn")
                    ) {
                        setActionsRevealed(false);
                    }
                }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        className="topic-toggle"
                        data-testid={`topic-toggle-${value.id}`}
                        onClick={() => setExpanded((v) => !v)}
                        aria-expanded={expanded}
                        aria-label={
                            expanded
                                ? t("ui.tooltips.collapse", "Collapse")
                                : t("ui.tooltips.expand", "Expand")
                        }
                        title={
                            tooltipsOn
                                ? expanded
                                    ? t("ui.tooltips.collapse", "Collapse")
                                    : t("ui.tooltips.expand", "Expand")
                                : undefined
                        }
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
                        aria-label={t(
                            "ui.tooltips.add_subtopic",
                            "Add subtopic",
                        )}
                        title={
                            tooltipsOn
                                ? t(
                                      "ui.tooltips.add_subtopic",
                                      "Add subtopic",
                                  )
                                : undefined
                        }
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className="topic-action-btn"
                        data-testid={`topic-rename-${value.id}`}
                        onClick={() => onRename(value.id, value.title)}
                        aria-label={t("ui.tooltips.rename", "Rename")}
                        title={
                            tooltipsOn
                                ? t("ui.tooltips.rename", "Rename")
                                : undefined
                        }
                    >
                        ✎
                    </button>
                    <button
                        type="button"
                        className="topic-action-btn is-danger"
                        data-testid={`topic-delete-${value.id}`}
                        onClick={() => onDelete(value.id)}
                        aria-label={t("ui.tooltips.delete", "Delete")}
                        title={
                            tooltipsOn
                                ? t("ui.tooltips.delete", "Delete")
                                : undefined
                        }
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
