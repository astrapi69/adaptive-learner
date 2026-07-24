/**
 * Integration test for editing a SMALL book-text lesson (#1970).
 *
 * The book generator (``cardsToExercises``) skips types it cannot render
 * (word_tiles/picture_choice/multiple_choice need example sentences/images),
 * so a book lesson is legitimately saved with fewer than the create-time
 * ``MIN_EXERCISES`` (5) exercises. The #1967 cardless-edit flow wrongly
 * enforced that create-time minimum on the already-valid lesson, blocking
 * "Next" ("4 Übungen / 5 nötig") and disabling save.
 *
 * These tests pin the corrected behaviour: editing an existing, previously-
 * valid lesson is NOT blocked by the create-time count minimums, and the
 * generate-config / "missing types" hint (irrelevant without cards) does not
 * appear in the cardless-edit flow.
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
import {buildBookLesson} from "../../lib/content/lesson/book-to-lesson";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

const META: LessonMeta = {
    title: "Von den Augen eines Vaters",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "de",
    level: "A1",
    description: "Ein Kapitel aus einem Buch.",
    author: "Asterios Raptis",
    domain: "language",
};

/** A legitimately-small book lesson: four free-text exercises (one type) —
 *  under both MIN_EXERCISES (5) and the two-type minimum, exactly the shape
 *  cardsToExercises leaves when only free-text cards survive. */
function smallBookLesson() {
    const exercises: ContentLessonExercise[] = [
        "Wer blickt auf das Kind?",
        "Was erzaehlt eine Geschichte?",
        "Nenne ein Symbol der Liebe.",
        "Was sieht der Vater im Kind?",
    ].map((prompt, i) => ({
        id: `ex-ft-${i}`,
        type: "free_text",
        prompt,
        card_ids: [],
        accept: [`Antwort ${i}`],
        distractors: [],
    }));
    return buildBookLesson({
        meta: META,
        theorySteps: [
            {id: "t1", title: "Einleitung", body: "Der Vater blickt auf sein Kind."},
        ],
        exercises,
    });
}

function renderEdit() {
    return render(
        <MemoryRouter
            initialEntries={["/create-lesson/edit/user-generated/created-vater"]}
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

beforeEach(() => {
    navigateMock.mockReset();
    saveUserSetMock.mockClear();
    localStorage.clear();
    const lesson = smallBookLesson();
    listLessonsMock.mockResolvedValue({
        set_id: "created-vater",
        source: "user-generated",
        version: "1.0.0",
        lessons: [`${lesson.id}.json`],
    });
    getLessonMock.mockResolvedValue(lesson);
    listSetsMock.mockResolvedValue({
        sets: [
            {
                source: "user-generated",
                id: "created-vater",
                level: "A1",
                title_native: "",
                domain: "imported",
            },
        ],
    });
});

describe("CreateLesson — editing a small book-text lesson (#1970)", () => {
    it("precondition: the fixture is a valid book lesson under the create-time minimums", () => {
        const lesson = smallBookLesson();
        expect(lesson.cards).toHaveLength(0);
        const exSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exSteps).toHaveLength(4); // < MIN_EXERCISES (5)
        const types = new Set(exSteps.map((s) => s.exercise?.type));
        expect(types.size).toBe(1); // < the two-type minimum
    });

    it("advancing to Review is NOT blocked by the create-time minimum count", async () => {
        renderEdit();
        await screen.findByTestId("create-lesson-step-indicator");
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-step-indicator"),
            ).toHaveTextContent(/1/),
        );

        // Metadata -> Exercises.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        await screen.findByTestId("create-lesson-step-3");
        // All four exercises are shown (nothing dropped).
        expect(screen.getByTestId("exercise-list").children).toHaveLength(4);

        // Exercises -> Review must succeed despite only 4 exercises / 1 type.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        await screen.findByTestId("create-lesson-step-4");
        expect(screen.queryByTestId("create-lesson-exercise-error")).toBeNull();
    });

    it("the save button is enabled for the previously-valid small lesson", async () => {
        renderEdit();
        await screen.findByTestId("create-lesson-step-indicator");
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-step-indicator"),
            ).toHaveTextContent(/1/),
        );
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        await screen.findByTestId("create-lesson-step-3");
        fireEvent.click(screen.getByTestId("create-lesson-next"));

        const save = await screen.findByTestId("create-lesson-save-local");
        expect(save).not.toBeDisabled();
        fireEvent.click(save);
        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalledTimes(1));
    });

    it("does not show the generate-config or missing-types hint in cardless edit", async () => {
        renderEdit();
        await screen.findByTestId("create-lesson-step-indicator");
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-step-indicator"),
            ).toHaveTextContent(/1/),
        );
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        await screen.findByTestId("create-lesson-step-3");
        // The generate-from-cards config + its "missing types" explanation are
        // irrelevant without cards and must not mislead the editor.
        expect(screen.queryByTestId("exercise-gen-config")).toBeNull();
        expect(screen.queryByTestId("exercise-gen-missing")).toBeNull();
    });
});
