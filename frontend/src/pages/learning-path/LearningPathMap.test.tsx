/**
 * Tests for the Achievement Map view. usePersonalPath + LessonRow are
 * mocked (LessonRow has its own unit tests, the real data loading is
 * covered by the Dexie smoke gate). Verifies the domain grouping, the
 * per-set + lesson-weighted total percentages, and the click-to-expand.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useHookMock = vi.fn();
vi.mock("../../hooks/learning/usePersonalPath", () => ({
    usePersonalPath: () => useHookMock(),
}));
vi.mock("../../lib/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));
vi.mock("../../components/learning-path/LessonRow", () => ({
    default: ({lesson}: {lesson: {filename: string; title: string}}) => (
        <div data-testid={`lesson-row-${lesson.filename}`}>{lesson.title}</div>
    ),
}));

import LearningPathMap from "./LearningPathMap";

function lesson(n: number, over = {}) {
    return {
        source: "src",
        setId: "s",
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

function set(over: Record<string, unknown> = {}) {
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
        currentLesson: null,
        mode: "start",
        errorCount: 0,
        nextLevel: null,
        ...over,
    };
}

function renderMap() {
    return render(
        <MemoryRouter>
            <LearningPathMap />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    useHookMock.mockReset();
});

describe("LearningPathMap", () => {
    it("groups sets into language (Sprachen) and knowledge (Wissen)", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {
                activeSets: [
                    set({setId: "fra1", title: "Französisch", domain: "language"}),
                    set({setId: "psych", title: "Psychologie", domain: "psychology"}),
                ],
                notDownloadedSets: [],
            },
        });
        renderMap();
        expect(screen.getByTestId("map-group-languages")).toBeInTheDocument();
        expect(screen.getByTestId("map-group-knowledge")).toBeInTheDocument();
        expect(screen.getByText("Französisch")).toBeInTheDocument();
        expect(screen.getByText("Psychologie")).toBeInTheDocument();
    });

    it("hides the language group when no language sets exist", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set({domain: "programming"})], notDownloadedSets: []},
        });
        renderMap();
        expect(screen.queryByTestId("map-group-languages")).toBeNull();
        expect(screen.getByTestId("map-group-knowledge")).toBeInTheDocument();
    });

    it("shows per-set percentage and a lesson-weighted total", () => {
        // FR 3/5 + Psych 1/2 → total = (3+1)/(5+2) = 4/7 = 57%.
        useHookMock.mockReturnValue({
            state: "ready",
            data: {
                activeSets: [
                    set({
                        setId: "fra1",
                        domain: "language",
                        completedCount: 3,
                        totalCount: 5,
                        percentComplete: 60,
                    }),
                    set({
                        setId: "psych",
                        domain: "psychology",
                        completedCount: 1,
                        totalCount: 2,
                        percentComplete: 50,
                    }),
                ],
                notDownloadedSets: [],
            },
        });
        renderMap();
        expect(screen.getByTestId("map-set-percent-fra1")).toHaveTextContent(
            "60%",
        );
        expect(screen.getByTestId("map-set-progress-fra1")).toHaveAttribute(
            "aria-valuenow",
            "60",
        );
        expect(screen.getByTestId("map-total")).toHaveTextContent("57%");
    });

    it("expands a set to its lessons on click", () => {
        useHookMock.mockReturnValue({
            state: "ready",
            data: {activeSets: [set({setId: "fra1", domain: "language"})], notDownloadedSets: []},
        });
        renderMap();
        expect(screen.queryByTestId("map-set-detail-fra1")).toBeNull();
        fireEvent.click(screen.getByTestId("map-set-fra1"));
        expect(screen.getByTestId("map-set-detail-fra1")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-row-01.json")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-row-02.json")).toBeInTheDocument();
    });

    it("shows the empty state with a content link", () => {
        useHookMock.mockReturnValue({
            state: "empty",
            data: {activeSets: [], notDownloadedSets: []},
        });
        renderMap();
        expect(screen.getByTestId("learning-path-empty")).toBeInTheDocument();
        expect(screen.getByTestId("learning-path-to-content")).toHaveAttribute(
            "href",
            "/content",
        );
    });
});
