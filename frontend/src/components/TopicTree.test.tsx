import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import TopicTree from "./TopicTree";
import type {LearningTopic} from "../types";

function topic(
    id: string,
    parentId: string | null,
    title: string,
    orderIndex = 0,
    createdAt = "2026-05-18T00:00:00Z",
): LearningTopic {
    return {
        id,
        curriculum_id: "c1",
        parent_id: parentId,
        title,
        description: null,
        order_index: orderIndex,
        created_at: createdAt,
        updated_at: createdAt,
    };
}

describe("TopicTree", () => {
    it("renders nested topics in a hierarchical structure", () => {
        const topics: LearningTopic[] = [
            topic("a", null, "Algebra"),
            topic("a1", "a", "Linear"),
            topic("a2", "a", "Polynomials"),
            topic("g", null, "Geometry"),
        ];
        render(
            <TopicTree
                topics={topics}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        expect(screen.getByTestId("topic-tree")).toBeInTheDocument();
        for (const id of ["a", "a1", "a2", "g"]) {
            expect(screen.getByTestId(`topic-node-${id}`)).toBeInTheDocument();
        }
    });

    it("sorts siblings by order_index then created_at", () => {
        const topics: LearningTopic[] = [
            topic("late", null, "Late", 2, "2026-05-18T01:00:00Z"),
            topic("early", null, "Early", 0),
            topic("mid", null, "Mid", 2, "2026-05-18T00:30:00Z"),
        ];
        const {container} = render(
            <TopicTree
                topics={topics}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        // Roots in the rendered tree are direct children of
        // the .topic-tree <ul>.
        const tree = container.querySelector(".topic-tree") as HTMLElement;
        const ids = Array.from(tree.children).map(
            (li) => (li as HTMLElement).getAttribute("data-testid"),
        );
        expect(ids).toEqual(["topic-node-early", "topic-node-mid", "topic-node-late"]);
    });

    it("fires onAddSubtopic / onRename / onDelete with the right id", () => {
        const onAdd = vi.fn();
        const onRename = vi.fn();
        const onDelete = vi.fn();
        const topics: LearningTopic[] = [topic("t1", null, "Topic 1")];
        render(
            <TopicTree
                topics={topics}
                onAddSubtopic={onAdd}
                onRename={onRename}
                onDelete={onDelete}
            />,
        );
        fireEvent.click(screen.getByTestId("topic-add-t1"));
        expect(onAdd).toHaveBeenCalledWith("t1");
        fireEvent.click(screen.getByTestId("topic-rename-t1"));
        expect(onRename).toHaveBeenCalledWith("t1", "Topic 1");
        fireEvent.click(screen.getByTestId("topic-delete-t1"));
        expect(onDelete).toHaveBeenCalledWith("t1");
    });

    it("toggles a parent collapses + reveals its children", () => {
        const topics: LearningTopic[] = [
            topic("a", null, "Parent"),
            topic("a1", "a", "Child"),
        ];
        render(
            <TopicTree
                topics={topics}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        // Child is visible by default.
        expect(screen.getByTestId("topic-node-a1")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("topic-toggle-a"));
        expect(screen.queryByTestId("topic-node-a1")).not.toBeInTheDocument();
        // Click again to expand.
        fireEvent.click(screen.getByTestId("topic-toggle-a"));
        expect(screen.getByTestId("topic-node-a1")).toBeInTheDocument();
    });
});
