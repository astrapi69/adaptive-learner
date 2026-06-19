/**
 * Tests for the Learning Path page (Phase 66A/E). @xyflow/react and
 * the data hook are mocked — the real canvas + data loading are
 * covered by the Dexie smoke gate + the graph-builder unit tests.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("@xyflow/react", () => ({
    ReactFlow: ({children}: {children?: React.ReactNode}) => (
        <div data-testid="reactflow-mock">{children}</div>
    ),
    Background: () => <div data-testid="rf-background" />,
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    BackgroundVariant: {Dots: "dots"},
    useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
}));

const useDataMock = vi.fn();
vi.mock("../../hooks/learning/useLearningPathData", () => ({
    useLearningPathData: () => useDataMock(),
}));

import LearningPath from "./LearningPathGraph";

function renderPage() {
    return render(
        <MemoryRouter>
            <LearningPath />
        </MemoryRouter>,
    );
}

beforeEach(() => useDataMock.mockReset());

describe("LearningPath page", () => {
    it("shows the loading state", () => {
        useDataMock.mockReturnValue({state: "loading", built: null});
        renderPage();
        expect(screen.getByTestId("learning-path-page")).toBeInTheDocument();
        expect(
            screen.getByTestId("learning-path-loading"),
        ).toBeInTheDocument();
    });

    it("shows the empty state with a content link when no sets", () => {
        useDataMock.mockReturnValue({state: "empty", built: null});
        renderPage();
        expect(screen.getByTestId("learning-path-empty")).toBeInTheDocument();
        expect(
            screen.queryByTestId("learning-path-canvas"),
        ).not.toBeInTheDocument();
    });

    it("renders the canvas when ready", () => {
        useDataMock.mockReturnValue({
            state: "ready",
            built: {nodes: [], edges: []},
        });
        renderPage();
        expect(screen.getByTestId("learning-path-canvas")).toBeInTheDocument();
        expect(screen.getByTestId("reactflow-mock")).toBeInTheDocument();
        expect(screen.getByTestId("learning-path-reset")).toBeInTheDocument();
    });

    it("renders the filter/search controls + stats sidebar when ready", () => {
        useDataMock.mockReturnValue({
            state: "ready",
            built: {nodes: [], edges: []},
            clusters: [],
        });
        renderPage();
        expect(
            screen.getByTestId("learning-path-controls"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("learning-path-filter-status"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("learning-path-filter-direction"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("learning-path-search")).toBeInTheDocument();
        expect(screen.getByTestId("learning-path-stats")).toBeInTheDocument();
    });

    it("toggles the error-cluster panel and lists clusters", () => {
        useDataMock.mockReturnValue({
            state: "ready",
            built: {nodes: [], edges: []},
            clusters: [
                {
                    tag: "article_gender",
                    lessonKeys: ["fr-a1::03.json", "fr-a1::07.json"],
                    errorCount: 5,
                    setId: "fr-a1",
                },
            ],
        });
        renderPage();
        // Hidden until toggled.
        expect(
            screen.queryByTestId("learning-path-clusters"),
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("learning-path-clusters-toggle"));
        expect(
            screen.getByTestId("learning-path-clusters"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("cluster-article_gender")).toBeInTheDocument();
        expect(
            screen.getByTestId("cluster-adaptive-article_gender"),
        ).toBeInTheDocument();
    });
});
