/**
 * Tests for the redesigned (personal) Learning Path page. The data
 * hook and the lazy graph view are mocked — buildPersonalPath +
 * SetRow/LessonRow are covered by their own unit tests, and the real
 * data loading by the Dexie smoke gate.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useHookMock = vi.fn();
vi.mock("../hooks/usePersonalPath", () => ({
    usePersonalPath: () => useHookMock(),
}));

// Avoid pulling xyflow into the test when the graph view mounts.
vi.mock("./LearningPathGraph", () => ({
    default: ({headerExtra}: {headerExtra?: React.ReactNode}) => (
        <main data-testid="learning-path-page">
            <div data-testid="graph-mock">graph</div>
            {headerExtra}
        </main>
    ),
}));

vi.mock("../lib/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));

import LearningPathPersonal from "./LearningPathPersonal";

function lesson(n: number, over = {}) {
    return {
        source: "src",
        setId: "psych",
        filename: `0${n}.json`,
        number: n,
        title: `Lesson ${n}`,
        stars: 0,
        status: "not_started",
        dot: "not_started",
        receptive: "na",
        productive: "na",
        lastActivity: null,
        isCurrent: false,
        ...over,
    };
}

function set(over = {}) {
    return {
        source: "src",
        setId: "psych",
        title: "Psychologie",
        titleNative: null,
        domain: "psychology",
        sourceLanguage: "de",
        targetLanguage: "de",
        level: "a1",
        lessons: [lesson(1), lesson(2)],
        completedCount: 0,
        totalCount: 2,
        percentComplete: 0,
        lastActivity: null,
        currentLesson: lesson(1, {isCurrent: true}),
        mode: "start",
        errorCount: 0,
        nextLevel: null,
        ...over,
    };
}

function renderPage() {
    return render(
        <MemoryRouter>
            <LearningPathPersonal />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    useHookMock.mockReset();
    localStorage.clear();
});

describe("LearningPathPersonal", () => {
    it("shows the loading state", () => {
        useHookMock.mockReturnValue({state: "loading", data: null});
        renderPage();
        expect(screen.getByTestId("learning-path-loading")).toBeInTheDocument();
    });

    it("shows the empty state with a content link", () => {
        useHookMock.mockReturnValue({
            state: "empty",
            data: {activeSets: [], notDownloadedSets: []},
        });
        renderPage();
        expect(screen.getByTestId("learning-path-empty")).toBeInTheDocument();
        expect(
            screen.getByTestId("learning-path-to-content"),
        ).toHaveAttribute("href", "/content");
    });

    it("shows the error state", () => {
        useHookMock.mockReturnValue({state: "error", data: null});
        renderPage();
        expect(screen.getByTestId("learning-path-error")).toBeInTheDocument();
    });

    it("renders one SetRow per active set", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        expect(screen.getByTestId("learning-path-sets")).toBeInTheDocument();
        expect(screen.getByTestId("set-row-psych")).toBeInTheDocument();
        // Detail hidden until expanded.
        expect(screen.queryByTestId("set-detail-psych")).toBeNull();
    });

    it("expands a set to reveal its detail on click", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        fireEvent.click(screen.getByTestId("set-toggle-psych"));
        expect(screen.getByTestId("set-detail-psych")).toBeInTheDocument();
    });

    it("renders the not-downloaded section and persists the filter", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {
                activeSets: [set()],
                notDownloadedSets: [
                    {
                        source: "src",
                        setId: "fra2",
                        title: "Französisch A2",
                        domain: "language",
                        lessonCount: 15,
                    },
                ],
            },
        });
        renderPage();
        expect(
            screen.getByTestId("learning-path-not-downloaded"),
        ).toBeInTheDocument();
        // Default filter = mine → section collapsed.
        expect(screen.queryByTestId("not-downloaded-list")).toBeNull();
        // Switch to "Alle Sets" → expands + persists.
        fireEvent.click(screen.getByTestId("learning-path-filter-all"));
        expect(screen.getByTestId("not-downloaded-list")).toBeInTheDocument();
        expect(
            localStorage.getItem("adaptive-learner.learning-path-filter"),
        ).toBe("all");
    });

    it("switches to the lazy graph view and persists the choice", async () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        fireEvent.click(screen.getByTestId("learning-path-view-graph"));
        await waitFor(() =>
            expect(screen.getByTestId("graph-mock")).toBeInTheDocument(),
        );
        expect(localStorage.getItem("adaptive-learner.learning-path-view")).toBe(
            "graph",
        );
    });
});
