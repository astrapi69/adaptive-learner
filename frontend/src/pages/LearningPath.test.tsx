/**
 * Tests for the Learning Path page shell (Phase 66A).
 * @xyflow/react is mocked to lightweight stand-ins — the real
 * canvas (which needs a measured DOM) is exercised by the
 * Dexie-mode smoke gate in a real browser.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";

vi.mock("@xyflow/react", () => ({
    ReactFlow: ({
        children,
        nodes,
    }: {
        children?: React.ReactNode;
        nodes?: unknown[];
    }) => (
        <div data-testid="reactflow-mock" data-node-count={nodes?.length ?? 0}>
            {children}
        </div>
    ),
    Background: () => <div data-testid="rf-background" />,
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    BackgroundVariant: {Dots: "dots", Lines: "lines", Cross: "cross"},
    useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
}));

import LearningPath from "./LearningPath";

describe("LearningPath page", () => {
    it("renders the page + canvas with the React Flow surface", () => {
        render(
            <MemoryRouter>
                <LearningPath />
            </MemoryRouter>,
        );
        expect(screen.getByTestId("learning-path-page")).toBeInTheDocument();
        expect(screen.getByTestId("learning-path-canvas")).toBeInTheDocument();
        expect(screen.getByTestId("reactflow-mock")).toBeInTheDocument();
        // Background + controls + minimap mounted inside the canvas.
        expect(screen.getByTestId("rf-background")).toBeInTheDocument();
        expect(screen.getByTestId("rf-controls")).toBeInTheDocument();
        expect(screen.getByTestId("rf-minimap")).toBeInTheDocument();
    });

    it("seeds the demo graph nodes (66B/66C)", () => {
        render(
            <MemoryRouter>
                <LearningPath />
            </MemoryRouter>,
        );
        // 5 lesson nodes + 1 set-group node.
        expect(
            screen.getByTestId("reactflow-mock").getAttribute("data-node-count"),
        ).toBe("6");
    });
});
