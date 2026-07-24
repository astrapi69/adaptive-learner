/**
 * Integration test: editing a book-text lesson must preserve the set-level
 * ``book`` block (#1989).
 *
 * ``buildUserSetInput`` (the edit-save path) carries no ``book`` field, so a
 * re-save previously persisted ``book: null`` and wiped the reference. The
 * catalog entry (``listSets``) DOES carry ``book``, so the edit path can and
 * must preserve it. A lesson that never had a book stays without one (no forced
 * empty object).
 */

import "@testing-library/jest-dom/vitest";

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
    ...(await orig<typeof import("react-router-dom")>()),
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
import type {ContentLessonExercise, ContentSetBook} from "../../storage/types";

const META: LessonMeta = {
    title: "Von den Augen eines Vaters",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "de",
    level: "A1",
    description: "Ein Kapitel.",
    author: "Asterios Raptis",
    domain: "language",
};

const BOOK: ContentSetBook = {
    title: "Von den Augen eines Vaters",
    author: "Asterios Raptis",
    url: "https://example.com/book",
    asin: "B0EXAMPLE",
};

function bookLesson() {
    const exercises: ContentLessonExercise[] = [
        "Wer blickt auf das Kind?",
        "Was erzaehlt eine Geschichte?",
        "Nenne ein Symbol der Liebe.",
        "Was sieht der Vater im Kind?",
        "Wofuer steht das Herz?",
    ].map((prompt, i) => ({
        id: `ex-${i}`,
        type: "free_text",
        prompt,
        card_ids: [],
        accept: [`Antwort ${i}`],
        distractors: [],
    }));
    return buildBookLesson({
        meta: META,
        theorySteps: [{id: "t1", title: "A", body: "Text"}],
        exercises,
    });
}

function seed(book: ContentSetBook | null) {
    const lesson = bookLesson();
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
                title: "Von den Augen eines Vaters",
                title_native: "",
                language: "de",
                target_language: "de",
                source_language: "de",
                level: "A1",
                domain: "imported",
                description: "Ein Kapitel.",
                book,
            },
        ],
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

async function editToReviewAndSave() {
    await screen.findByTestId("create-lesson-step-indicator");
    await waitFor(() =>
        expect(
            screen.getByTestId("create-lesson-step-indicator"),
        ).toHaveTextContent(/1/),
    );
    fireEvent.click(screen.getByTestId("create-lesson-next")); // -> exercises
    await screen.findByTestId("create-lesson-step-3");
    fireEvent.click(screen.getByTestId("create-lesson-next")); // -> review
    const save = await screen.findByTestId("create-lesson-save-local");
    fireEvent.click(save);
    await waitFor(() => expect(saveUserSetMock).toHaveBeenCalledTimes(1));
    return saveUserSetMock.mock.calls[0][0] as unknown as {
        book?: ContentSetBook | null;
    };
}

beforeEach(() => {
    navigateMock.mockReset();
    saveUserSetMock.mockClear();
    localStorage.clear();
});

describe("CreateLesson — book-block preservation on edit (#1989)", () => {
    it("preserves the set-level book block when re-saving an edited book lesson", async () => {
        seed(BOOK);
        renderEdit();
        const input = await editToReviewAndSave();
        expect(input.book).toEqual(BOOK);
    });

    it("does not fabricate a book block for a lesson that never had one", async () => {
        seed(null);
        renderEdit();
        const input = await editToReviewAndSave();
        // Absent or null — never a forced empty object.
        expect(input.book ?? null).toBeNull();
    });
});
