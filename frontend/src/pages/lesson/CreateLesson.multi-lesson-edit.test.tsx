/**
 * Integration test for editing a MULTI-LESSON set (#1971).
 *
 * A book-text multi-section upload (#1949) stores one ContentLesson per
 * section in one set. Before the fix the edit flow hard-coded editIndex = 0, so
 * only the first lesson was ever reachable in the editor. These tests pin the
 * lesson picker: every lesson is reachable, switching shows that lesson's
 * exercises, a single-lesson set shows NO picker, an unsaved-edit switch is
 * guarded, and a save preserves the set-level metadata + all sibling lessons.
 */

import "@testing-library/jest-dom/vitest";

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router", async (orig) => ({
    ...(await orig<typeof import("react-router")>()),
    useNavigate: () => navigateMock,
}));

const saveUserSetMock = vi.fn(
    async (input: {set_id: string; title: string}) => ({
        id: input.set_id,
        source: "user-generated",
        title: input.title,
    }),
);
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listSetsMock = vi.fn();
vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            saveUserSet: saveUserSetMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
            listSets: listSetsMock,
        },
    }),
}));
vi.mock("../../utils/notify", () => ({
    notify: {success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));
vi.mock("../../lib/content/lesson/lesson-export", () => ({
    downloadLessonJson: vi.fn(),
}));

import CreateLesson from "./CreateLesson";
import {buildBookLessons} from "../../lib/content/lesson/book-to-lesson";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

const META: LessonMeta = {
    title: "Buch-Set",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "de",
    level: "A1",
    description: "Ein Buch in Abschnitten.",
    author: "Asterios Raptis",
    domain: "language",
};

/** ``idPrefix`` must be slug-safe (lowercase); ``label`` shows in prompts so a
 *  test can tell the two lessons' exercises apart. */
function freeText(idPrefix: string, label: string): ContentLessonExercise[] {
    return [0, 1, 2, 3, 4].map((i) => ({
        id: `${idPrefix}-ft-${i}`,
        type: "free_text",
        prompt: `${label} Frage ${i}`,
        card_ids: [],
        accept: [`${label} Antwort ${i}`],
        distractors: [],
    }));
}

/** Two book lessons (sections A + B) in one set. */
function twoLessons() {
    return buildBookLessons(META, [
        {
            title: "Abschnitt A",
            theorySteps: [{id: "a1", title: "A", body: "Text A"}],
            exercises: freeText("sa", "A"),
        },
        {
            title: "Abschnitt B",
            theorySteps: [{id: "b1", title: "B", body: "Text B"}],
            exercises: freeText("sb", "B"),
        },
    ]);
}

function renderEdit() {
    return render(
        <MemoryRouter
            initialEntries={["/create-lesson/edit/user-generated/created-buch"]}
        >
            <Routes>
                <Route
                    path="/create-lesson/edit/:source/:setId"
                    element={<CreateLesson />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

function seedSet(lessons: ReturnType<typeof twoLessons>) {
    listLessonsMock.mockResolvedValue({
        set_id: "created-buch",
        source: "user-generated",
        version: "1.0.0",
        lessons: lessons.map((l) => `${l.id}.json`),
    });
    getLessonMock.mockImplementation(async (_src, _set, file: string) => {
        const id = file.replace(/\.json$/, "");
        return lessons.find((l) => l.id === id) ?? lessons[0];
    });
    // The SET title differs from every lesson title — so we can prove it is
    // preserved (not overwritten by the edited lesson's title).
    listSetsMock.mockResolvedValue({
        sets: [
            {
                source: "user-generated",
                id: "created-buch",
                title: "Buch-Set",
                title_native: "",
                language: "de",
                target_language: "de",
                source_language: "de",
                level: "A1",
                domain: "imported",
                description: "Ein Buch in Abschnitten.",
            },
        ],
    });
}

beforeEach(() => {
    navigateMock.mockReset();
    saveUserSetMock.mockClear();
    localStorage.clear();
    seedSet(twoLessons());
});

async function goToExercises() {
    await screen.findByTestId("create-lesson-step-indicator");
    await waitFor(() =>
        expect(
            screen.getByTestId("create-lesson-step-indicator"),
        ).toHaveTextContent(/1/),
    );
    fireEvent.click(screen.getByTestId("create-lesson-next"));
    await screen.findByTestId("create-lesson-step-3");
}

describe("CreateLesson — editing a multi-lesson set (#1971)", () => {
    it("shows a lesson picker and every lesson is reachable", async () => {
        renderEdit();
        const picker = await screen.findByTestId("create-lesson-lesson-select");
        // Both sections are listed.
        expect(picker).toBeInTheDocument();
        expect(
            (picker as HTMLSelectElement).options.length,
        ).toBe(2);

        // Lesson A's exercises are shown first.
        await goToExercises();
        expect(screen.getByTestId("exercise-list")).toHaveTextContent("A Frage 0");
        expect(screen.getByTestId("exercise-list")).not.toHaveTextContent(
            "B Frage 0",
        );

        // Switch to lesson B (no unsaved edits -> switches directly).
        fireEvent.change(
            screen.getByTestId("create-lesson-lesson-select"),
            {target: {value: "1"}},
        );
        // Back on step 1 for the newly-selected lesson; advance to its exercises.
        await goToExercises();
        expect(screen.getByTestId("exercise-list")).toHaveTextContent("B Frage 0");
        expect(screen.getByTestId("exercise-list")).not.toHaveTextContent(
            "A Frage 0",
        );
    });

    it("a single-lesson set shows no picker", async () => {
        seedSet(
            buildBookLessons(META, [
                {
                    title: "Nur A",
                    theorySteps: [{id: "a1", title: "A", body: "Text"}],
                    exercises: freeText("sa", "A"),
                },
            ]),
        );
        renderEdit();
        await screen.findByTestId("create-lesson-step-indicator");
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-step-indicator"),
            ).toHaveTextContent(/1/),
        );
        expect(screen.queryByTestId("create-lesson-lesson-picker")).toBeNull();
    });

    it("guards an unsaved-edit switch with a confirm dialog", async () => {
        renderEdit();
        await screen.findByTestId("create-lesson-lesson-select");
        await goToExercises();
        // Delete an exercise to make the draft dirty.
        const delButtons = screen.getAllByTestId(/^exercise-delete-/);
        fireEvent.click(delButtons[0]);

        // Attempting to switch now prompts instead of switching immediately.
        fireEvent.change(
            screen.getByTestId("create-lesson-lesson-select"),
            {target: {value: "1"}},
        );
        expect(
            await screen.findByTestId("create-lesson-switch-confirm"),
        ).toBeInTheDocument();
    });

    it("saving lesson B preserves the set title and both lessons", async () => {
        renderEdit();
        await screen.findByTestId("create-lesson-lesson-select");
        // Switch to lesson B, go to review, save.
        fireEvent.change(
            screen.getByTestId("create-lesson-lesson-select"),
            {target: {value: "1"}},
        );
        await goToExercises();
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        const save = await screen.findByTestId("create-lesson-save-local");
        fireEvent.click(save);

        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalledTimes(1));
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            title: string;
            lessons: Array<{id: string}>;
        };
        // Set title preserved (NOT renamed to lesson B's title).
        expect(input.title).toBe("Buch-Set");
        // Both lessons survive.
        expect(input.lessons).toHaveLength(2);
    });
});
