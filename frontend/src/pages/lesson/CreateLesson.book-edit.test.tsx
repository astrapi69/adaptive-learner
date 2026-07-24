/**
 * Integration test for editing a BOOK-TEXT lesson (#1967).
 *
 * A lesson created via the "Wissens-Lektion aus Text" path (#1743) has
 * ``cards: []``, multiple ``theory-*`` steps and generated exercises. Before
 * the fix the edit-load path always rendered the card-driven ``WizardSteps``,
 * so step 2 showed the empty vocabulary-card editor and the ``MIN_CARDS`` gate
 * blocked the user from ever reaching the generated exercises.
 *
 * These tests pin the corrected behaviour: a cardless (theory/exercise)
 * lesson opens in an exercise-editing flow — step 2 is the exercise editor
 * (the real generated exercises), never the card editor — and it saves
 * without a card requirement.
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

/** A book-text lesson: reformulated theory steps + generated exercises,
 *  ``cards: []`` (the shape ``buildBookLesson`` always produces). */
function bookLesson() {
    // The real book path builds standalone exercises (``card_ids: []`` — they
    // are driven by the theory text, not a vocab card list), then discards the
    // intermediate cards. A free-text + matching mix (two types, five total)
    // matches that shape and satisfies the review's quality checks.
    const freeText: ContentLessonExercise[] = [
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
    const matching: ContentLessonExercise = {
        id: "ex-match-0",
        type: "matching",
        prompt: "Ordne die Begriffe zu.",
        card_ids: [],
        pairs: [
            {left: "Vater", right: "Beschuetzer"},
            {left: "Auge", right: "Blick"},
        ],
        distractors: [],
    };
    const exercises: ContentLessonExercise[] = [...freeText, matching];
    return buildBookLesson({
        meta: META,
        theorySteps: [
            {
                id: "t1",
                title: "Einleitung",
                body: "Der Vater blickt auf sein Kind.",
            },
            {
                id: "t2",
                title: "Vertiefung",
                body: "Die Augen erzählen eine Geschichte.",
            },
        ],
        exercises,
    });
}

function renderEdit() {
    return render(
        <MemoryRouter
            initialEntries={[
                "/create-lesson/edit/user-generated/created-vater",
            ]}
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
                level: "A1",
                title_native: "",
                domain: "imported",
            },
        ],
    });
});

describe("CreateLesson — editing a book-text lesson (#1967)", () => {
    it("precondition: the fixture is a cardless theory/exercise lesson", () => {
        const lesson = bookLesson();
        expect(lesson.cards).toHaveLength(0);
        expect(lesson.steps.some((s) => s.type === "theory")).toBe(true);
        expect(lesson.steps.some((s) => s.type === "exercise")).toBe(true);
    });

    it("advancing from Metadata reaches the exercise editor, not the card editor", async () => {
        renderEdit();
        // Edit-load resolves onto the Metadata step.
        await screen.findByTestId("create-lesson-step-indicator");
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-step-indicator"),
            ).toHaveTextContent(/1/),
        );

        fireEvent.click(screen.getByTestId("create-lesson-next"));

        // Step 2 must be the EXERCISE editor with the generated exercises,
        // never the empty vocabulary-card editor.
        await screen.findByTestId("create-lesson-step-3");
        expect(screen.queryByTestId("create-lesson-step-2")).toBeNull();
        expect(screen.getByTestId("exercise-list").children.length).toBeGreaterThan(
            0,
        );
    });

    it("saves the edited book lesson without a card requirement", async () => {
        renderEdit();
        await screen.findByTestId("create-lesson-step-indicator");
        await waitFor(() =>
            expect(
                screen.getByTestId("create-lesson-step-indicator"),
            ).toHaveTextContent(/1/),
        );

        // Metadata -> Exercises -> Review.
        fireEvent.click(screen.getByTestId("create-lesson-next"));
        await screen.findByTestId("create-lesson-step-3");
        fireEvent.click(screen.getByTestId("create-lesson-next"));

        const save = await screen.findByTestId("create-lesson-save-local");
        expect(save).not.toBeDisabled();
        fireEvent.click(save);

        await waitFor(() => expect(saveUserSetMock).toHaveBeenCalledTimes(1));
        const input = saveUserSetMock.mock.calls[0][0] as unknown as {
            set_id: string;
            lessons: Array<{steps: Array<{type: string}>}>;
        };
        expect(input.set_id).toBe("created-vater");
        // The saved lesson still carries theory + exercise steps.
        const savedSteps = input.lessons[0].steps;
        expect(savedSteps.some((s) => s.type === "theory")).toBe(true);
        expect(savedSteps.some((s) => s.type === "exercise")).toBe(true);
    });
});
