import {act, render, screen, fireEvent} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import TopicTree from "./TopicTree";
import type {LearningTopic} from "../../types";

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

describe("TopicNode swipe-to-reveal (Phase 23D)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.setItem("adaptive-learner.gestures_enabled", "true");
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    function simulateSwipe(
        node: HTMLElement,
        opts: {fromX: number; toX: number},
    ) {
        const ev = (type: string, x: number) => {
            const e = new Event(type, {bubbles: true}) as TouchEvent;
            (e as unknown as {touches: {clientX: number; clientY: number}[]}).touches =
                type === "touchend" ? [] : [{clientX: x, clientY: 100}];
            return e;
        };
        act(() => {
            node.dispatchEvent(ev("touchstart", opts.fromX));
            vi.advanceTimersByTime(50);
            node.dispatchEvent(ev("touchmove", opts.toX));
            node.dispatchEvent(ev("touchend", opts.toX));
        });
    }

    it("starts with actions hidden (data-actions-revealed=false)", () => {
        render(
            <TopicTree
                topics={[topic("t1", null, "Topic")]}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        const row = screen.getByTestId("topic-row-t1");
        expect(row.getAttribute("data-actions-revealed")).toBe("false");
    });

    it("swipe-left reveals the actions (data-actions-revealed=true)", () => {
        render(
            <TopicTree
                topics={[topic("t1", null, "Topic")]}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        const row = screen.getByTestId("topic-row-t1");
        simulateSwipe(row, {fromX: 250, toX: 50});
        expect(row.getAttribute("data-actions-revealed")).toBe("true");
    });

    it("swipe-right collapses the revealed state", () => {
        render(
            <TopicTree
                topics={[topic("t1", null, "Topic")]}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        const row = screen.getByTestId("topic-row-t1");
        simulateSwipe(row, {fromX: 250, toX: 50});
        expect(row.getAttribute("data-actions-revealed")).toBe("true");
        simulateSwipe(row, {fromX: 50, toX: 250});
        expect(row.getAttribute("data-actions-revealed")).toBe("false");
    });

    it("tap on the title (not an action button) collapses revealed state", () => {
        render(
            <TopicTree
                topics={[topic("t1", null, "Topic")]}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        const row = screen.getByTestId("topic-row-t1");
        simulateSwipe(row, {fromX: 250, toX: 50});
        expect(row.getAttribute("data-actions-revealed")).toBe("true");
        // Click somewhere inside the row that isn't an action.
        act(() => {
            fireEvent.click(row);
        });
        expect(row.getAttribute("data-actions-revealed")).toBe("false");
    });

    it("clicking an action button does NOT collapse the revealed state", () => {
        const onRename = vi.fn();
        render(
            <TopicTree
                topics={[topic("t1", null, "Topic")]}
                onAddSubtopic={() => {}}
                onRename={onRename}
                onDelete={() => {}}
            />,
        );
        const row = screen.getByTestId("topic-row-t1");
        simulateSwipe(row, {fromX: 250, toX: 50});
        expect(row.getAttribute("data-actions-revealed")).toBe("true");
        act(() => {
            fireEvent.click(screen.getByTestId("topic-rename-t1"));
        });
        // Rename fired AND the row stays revealed (no toggle on action clicks).
        expect(onRename).toHaveBeenCalled();
        expect(row.getAttribute("data-actions-revealed")).toBe("true");
    });

    it("does NOT reveal when gestures_enabled=false", () => {
        localStorage.setItem("adaptive-learner.gestures_enabled", "false");
        render(
            <TopicTree
                topics={[topic("t1", null, "Topic")]}
                onAddSubtopic={() => {}}
                onRename={() => {}}
                onDelete={() => {}}
            />,
        );
        const row = screen.getByTestId("topic-row-t1");
        simulateSwipe(row, {fromX: 250, toX: 50});
        expect(row.getAttribute("data-actions-revealed")).toBe("false");
    });
});
