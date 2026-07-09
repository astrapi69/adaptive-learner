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
vi.mock("../../hooks/learning/usePersonalPath", () => ({
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

vi.mock("./LearningPathMap", () => ({
    default: ({headerExtra}: {headerExtra?: React.ReactNode}) => (
        <main data-testid="learning-path-page">
            <div data-testid="map-mock">map</div>
            {headerExtra}
        </main>
    ),
}));

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));

// CustomPathsView reads getStorage(); stub the namespaces it uses so
// the "paths" view mounts without IndexedDB / a backend.
vi.mock("../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: async () => []},
        contentLoader: {
            listSets: async () => ({sets: [], sources: []}),
            listLessons: async () => ({lessons: []}),
        },
    }),
}));

import LearningPathPersonal from "./LearningPathPersonal";
import {TestFeatureProvider} from "../../features/testFeatureProvider";

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
        // Default to a STARTED set (progress present) so it is visible under
        // the default "Only mine" filter (#1453). Tests that need a
        // downloaded-but-never-started set pass ``lastActivity: null``.
        lastActivity: "2026-01-01T00:00:00Z",
        currentLesson: lesson(1, {isCurrent: true}),
        mode: "start",
        errorCount: 0,
        nextLevel: null,
        ...over,
    };
}

function renderPage() {
    return render(
        <TestFeatureProvider>
            <MemoryRouter>
                <LearningPathPersonal />
            </MemoryRouter>
        </TestFeatureProvider>,
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
        ).toHaveAttribute("href", "/content?tab=my");
    });

    it("shows the error state", () => {
        useHookMock.mockReturnValue({state: "error", data: null});
        renderPage();
        expect(screen.getByTestId("learning-path-error")).toBeInTheDocument();
    });

    it("switches to the map view within the session (not persisted, #1453)", async () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        fireEvent.click(screen.getByTestId("learning-path-view-map"));
        await waitFor(() =>
            expect(screen.getByTestId("map-mock")).toBeInTheDocument(),
        );
        // #1453 - the view is NOT persisted: opening the page always starts
        // on Personal ("where am I?"), never the last-visited tab.
        expect(
            localStorage.getItem("adaptive-learner.learning-path-view"),
        ).toBeNull();
    });

    it("always opens on Personal, ignoring any previously stored view (#1453)", async () => {
        // A stale persisted selection from before the change must not win.
        localStorage.setItem("adaptive-learner.learning-path-view", "map");
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        // The Map view never mounts; the personal set list shows instead.
        expect(screen.queryByTestId("map-mock")).toBeNull();
        expect(screen.getByTestId("learning-path-sets")).toBeInTheDocument();
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

    it("switches to the My Paths view within the session (not persisted, #1453)", async () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        fireEvent.click(screen.getByTestId("learning-path-view-paths"));
        await waitFor(() =>
            expect(
                screen.getByTestId("custom-paths-view"),
            ).toBeInTheDocument(),
        );
        expect(
            screen.getByTestId("custom-path-create-form"),
        ).toBeInTheDocument();
        expect(
            localStorage.getItem("adaptive-learner.learning-path-view"),
        ).toBeNull();
    });

    // #1453 BEFUND 1 - the "Only mine / All sets" filter now actually filters
    // the main set list: "Only mine" shows sets the user began (progress
    // present), "All sets" adds downloaded-but-never-started sets.
    it("filters the set list: Only mine shows started sets, All sets adds never-started ones (#1453)", () => {
        const started = set({
            setId: "psych",
            title: "Psychologie",
            lastActivity: "2026-02-01T00:00:00Z",
        });
        const neverStarted = set({
            setId: "fresh",
            title: "Fresh set",
            lastActivity: null,
        });
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [started, neverStarted], notDownloadedSets: []},
        });
        renderPage();
        // Default filter is "Only mine".
        expect(
            screen.getByTestId("learning-path-filter-mine"),
        ).toHaveAttribute("aria-pressed", "true");
        // Only the started set is shown.
        expect(screen.getByTestId("set-row-psych")).toBeInTheDocument();
        expect(screen.queryByTestId("set-row-fresh")).toBeNull();
        // Switch to "All sets": the never-started downloaded set appears too.
        fireEvent.click(screen.getByTestId("learning-path-filter-all"));
        expect(screen.getByTestId("set-row-psych")).toBeInTheDocument();
        expect(screen.getByTestId("set-row-fresh")).toBeInTheDocument();
    });

    // #1453 BEFUND 2 - the personal-tab progress is computed over STARTED
    // sets only. A downloaded-but-never-started set must not move the number
    // (regression pin against the catalog-wide metric that fell when someone
    // else added sets).
    it("computes personal progress over started sets only; a never-started set does not change it (#1453)", () => {
        const started = set({
            setId: "psych",
            completedCount: 1,
            totalCount: 2,
            percentComplete: 50,
            lastActivity: "2026-02-01T00:00:00Z",
        });
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [started], notDownloadedSets: []},
        });
        const {rerender} = renderPage();
        expect(
            screen.getByTestId("learning-path-personal-progress"),
        ).toHaveTextContent("50%");
        // Add a downloaded-but-never-started set (0/10). Over ALL sets that
        // would drop to 1/12 = 8%; over STARTED sets it stays 1/2 = 50%.
        const neverStarted = set({
            setId: "fresh",
            completedCount: 0,
            totalCount: 10,
            percentComplete: 0,
            lastActivity: null,
        });
        useHookMock.mockReturnValue({
            state: "ready",
            data: {
                activeSets: [started, neverStarted],
                notDownloadedSets: [],
            },
        });
        rerender(
            <TestFeatureProvider>
                <MemoryRouter>
                    <LearningPathPersonal />
                </MemoryRouter>
            </TestFeatureProvider>,
        );
        expect(
            screen.getByTestId("learning-path-personal-progress"),
        ).toHaveTextContent("50%");
    });

    it("hides the Graph tab while LEARNING_PATH_GRAPH is disabled (#900)", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        // Other tabs render; the graph tab is gated off by default.
        expect(
            screen.getByTestId("learning-path-view-map"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("learning-path-view-graph"),
        ).toBeNull();
    });

    it("falls back to the personal view when graph is persisted but disabled (#900)", () => {
        localStorage.setItem("adaptive-learner.learning-path-view", "graph");
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set()], notDownloadedSets: []},
        });
        renderPage();
        // The lazy graph view never mounts; the personal set list shows.
        expect(screen.queryByTestId("graph-mock")).toBeNull();
        expect(screen.getByTestId("learning-path-sets")).toBeInTheDocument();
    });
});
