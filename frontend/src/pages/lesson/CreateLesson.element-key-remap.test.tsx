/**
 * Integration test for #2519: editing OWN lesson locally must not silently
 * orphan a review-card row when an answer text changes at the same position.
 *
 * Mirrors ``CreateLesson.test.tsx``'s edit-mode setup + ``multi-lesson-edit``'s
 * mocking style, extended with the ``elementErrors`` namespace so the
 * saveLocally -> remapOrphanedElementKeys wiring can be observed end to end
 * through the real exercise editor DOM (no shortcuts around the UI - this is
 * exactly the reproduction from the issue).
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

const saveUserSetMock = vi.fn(async (input: {set_id: string; title: string}) => ({
    id: input.set_id,
    source: "user-generated",
    title: input.title,
}));
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listSetsMock = vi.fn();
const listElementErrorsMock = vi.fn();
const remapKeysMock = vi.fn();
vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            saveUserSet: saveUserSetMock,
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
            listSets: listSetsMock,
        },
        elementErrors: {
            list: listElementErrorsMock,
            remapKeys: remapKeysMock,
        },
    }),
}));
const notifyMock = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
}));
vi.mock("../../utils/notify", () => ({notify: notifyMock}));
vi.mock("../../lib/content/lesson/lesson-export", () => ({
    downloadLessonJson: vi.fn(),
}));

import CreateLesson from "./CreateLesson";
import {buildLessonFromDraft} from "../../lib/content/lesson/draft-to-lesson";
import {setUserId} from "../../lib/learning/learnerState";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";

const SET_ID = "created-merci";
const USER_ID = "u1";

const META: LessonMeta = {
    title: "French basics",
    titleNative: "",
    sourceLanguage: "de",
    targetLanguage: "fr",
    level: "A1",
    description: "One free_text exercise.",
    author: "Aster",
    domain: "language",
};

function fixtureLesson() {
    return buildLessonFromDraft(
        {
            meta: META,
            cards: [{id: "c0", front: "merci", back: "danke", notes: "", image: ""}],
            exercises: [
                {
                    id: "ex-1",
                    type: "free_text",
                    prompt: "Translate: danke",
                    card_ids: ["c0"],
                    accept: ["Merci"],
                    distractors: [],
                },
            ],
        },
        {id: "l0"},
    );
}

function renderEdit() {
    return render(
        <MemoryRouter initialEntries={[`/create-lesson/edit/user-generated/${SET_ID}`]}>
            <Routes>
                <Route path="/create-lesson/edit/:source/:setId" element={<CreateLesson />} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    navigateMock.mockReset();
    saveUserSetMock.mockClear();
    listElementErrorsMock.mockReset();
    remapKeysMock.mockReset();
    notifyMock.success.mockReset();
    notifyMock.info.mockReset();
    notifyMock.error.mockReset();
    localStorage.clear();
    setUserId(USER_ID);

    const lesson = fixtureLesson();
    listLessonsMock.mockResolvedValue({
        set_id: SET_ID,
        source: "user-generated",
        version: "1.0.0",
        lessons: [`${lesson.id}.json`],
    });
    getLessonMock.mockResolvedValue(lesson);
    listSetsMock.mockResolvedValue({
        sets: [{source: "user-generated", id: SET_ID, level: "A1", domain: "imported"}],
    });
    listElementErrorsMock.mockResolvedValue([]);
    remapKeysMock.mockResolvedValue({applied: 0, skipped: 0});
});

async function openEditorAndFixTypo() {
    renderEdit();
    await waitFor(() =>
        expect(
            (screen.getByTestId("create-lesson-title") as HTMLInputElement).value,
        ).toBe("French basics"),
    );
    fireEvent.click(screen.getByTestId("create-lesson-next")); // step 1 -> 2 (cards)
    fireEvent.click(screen.getByTestId("create-lesson-next")); // step 2 -> 3 (exercises)
    await screen.findByTestId("exercise-edit-ex-1");
    fireEvent.click(screen.getByTestId("exercise-edit-ex-1"));

    // Correct the typo: "Merci" -> "Merci !" (remove the old accepted answer,
    // type the corrected one, add it back at the same position).
    fireEvent.click(await screen.findByTestId("exercise-edit-accept-ex-1-remove-0"));
    fireEvent.change(screen.getByTestId("exercise-edit-accept-ex-1-input"), {
        target: {value: "Merci !"},
    });
    fireEvent.click(screen.getByTestId("exercise-edit-accept-ex-1-add"));
    fireEvent.click(screen.getByTestId("exercise-edit-save-ex-1"));

    fireEvent.click(screen.getByTestId("create-lesson-next")); // step 3 -> 4 (review)
    fireEvent.click(await screen.findByTestId("create-lesson-save-local"));
    await waitFor(() => expect(saveUserSetMock).toHaveBeenCalled());
}

describe("CreateLesson — local edit carries over review progress (#2519)", () => {
    it("remaps the review-card row onto the corrected answer text after saving", async () => {
        listElementErrorsMock.mockResolvedValue([
            {
                id: `${USER_ID}#${SET_ID}#lessons/l0.json#ex-1#Merci#target_to_source`,
                user_id: USER_ID,
                set_id: SET_ID,
                lesson_id: "lessons/l0.json",
                exercise_id: "ex-1",
                element_key: "Merci",
                element_type: "free_text",
                user_answer: "",
                correct_answer: "Merci",
                error_count: 0,
                correct_streak: 1,
                last_error_at: null,
                last_attempt_at: "2026-08-12T00:00:00.000Z",
                mastered: false,
                mastered_at: null,
                created_at: "2026-08-12T00:00:00.000Z",
                updated_at: "2026-08-12T00:00:00.000Z",
            },
        ]);
        remapKeysMock.mockResolvedValue({applied: 1, skipped: 0});

        await openEditorAndFixTypo();

        await waitFor(() =>
            expect(remapKeysMock).toHaveBeenCalledWith(USER_ID, [
                {
                    set_id: SET_ID,
                    lesson_id: "lessons/l0.json",
                    exercise_id: "ex-1",
                    old: "Merci",
                    new: "Merci !",
                },
            ]),
        );
        expect(notifyMock.success).toHaveBeenCalledWith(
            expect.stringContaining("1"),
        );
    });

    it("is a no-op when the lesson has no existing review-card rows", async () => {
        listElementErrorsMock.mockResolvedValue([]);

        await openEditorAndFixTypo();
        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalled());

        expect(remapKeysMock).not.toHaveBeenCalled();
    });
});
