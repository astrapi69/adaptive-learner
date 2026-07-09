/**
 * Tests for the CustomPathsView host wiring (#1458): an empty path's
 * card offers "Add your first lesson" (opening the lesson picker)
 * instead of a dead Continue button; a path with lessons keeps the
 * Continue action. The presentational pieces (CurriculumCard,
 * LessonPicker) carry their own unit tests — this pins the host's
 * empty-state wiring on top of the real localStorage-backed
 * custom-paths store.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../storage", () => ({
    getStorage: () => ({
        lessonProgress: {list: async () => []},
        contentLoader: {
            listSets: async () => ({sets: [], sources: []}),
            listLessons: async () => ({lessons: []}),
        },
    }),
}));

import CustomPathsView from "./CustomPathsView";
import {
    addLessonToPath,
    createCustomPath,
    listCustomPaths,
} from "../../lib/learning-path/custom-paths";

function renderView() {
    return render(
        <MemoryRouter>
            <CustomPathsView userId="u1" />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    localStorage.clear();
});

describe("CustomPathsView empty-path action (#1458)", () => {
    it("offers 'add your first lesson' instead of Continue on an empty path", () => {
        createCustomPath("Mein Pfad");
        const id = listCustomPaths()[0].id;
        renderView();
        // No Continue in the DOM for the empty path...
        expect(
            screen.queryByTestId(`custom-path-card-${id}-continue`),
        ).toBeNull();
        // ...the active add-lessons action replaces it.
        const add = screen.getByTestId(`custom-path-card-${id}-add-lessons`);
        expect(add).toBeEnabled();
        // Clicking it opens the lesson picker below the card.
        fireEvent.click(add);
        expect(
            screen.getByTestId(`custom-path-picker-${id}`),
        ).toBeInTheDocument();
    });

    it("keeps the Continue action once the path has a lesson", () => {
        createCustomPath("Mein Pfad");
        const id = listCustomPaths()[0].id;
        addLessonToPath(id, {
            source: "bundled:x",
            setId: "fr-a1",
            filename: "01.json",
        });
        renderView();
        expect(
            screen.getByTestId(`custom-path-card-${id}-continue`),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId(`custom-path-card-${id}-add-lessons`),
        ).toBeNull();
    });
});
