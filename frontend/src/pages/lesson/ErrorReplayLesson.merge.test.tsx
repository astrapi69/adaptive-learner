/**
 * ErrorReplayLesson — SRS success-merge (#1304).
 *
 * Regression guard: a graded answer in "Fehler trainieren" must flow
 * through the SAME ``elementErrors.recordBulk`` path the main viewer /
 * review / correction-block use. A fully-correct answer advances
 * mastery (eventually removing the element from the error/review
 * surfaces); a wrong one keeps the error. Before #1304 the page only
 * tracked results in local React state and dropped the attempt
 * entirely, so retrained mistakes never left the SRS queue.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import ErrorReplayLesson from "./ErrorReplayLesson";
import type {ContentLessonExercise} from "../../storage/types";

const recordBulkMock = vi.fn();
let learnerUserId: string | null = "user-1";

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            recordBulk: recordBulkMock,
            list: vi.fn(),
            reviewQueue: vi.fn(),
        },
    }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({
        userId: learnerUserId,
        projectId: null,
        language: "en",
    }),
}));

beforeEach(() => {
    recordBulkMock.mockReset();
    recordBulkMock.mockResolvedValue([]);
    learnerUserId = "user-1";
});

const FREE = (id: string, accept: string): ContentLessonExercise => ({
    id,
    type: "free_text",
    prompt: `Translate ${id}`,
    card_ids: [],
    accept: [accept],
    distractors: [],
});

const PATH = "/error-replay/slug/fr-a1/03.json";

function renderWithState(state: unknown) {
    return render(
        <MemoryRouter initialEntries={[{pathname: PATH, state}]}>
            <Routes>
                <Route
                    path="/error-replay/:setSlug/:setId/:filename"
                    element={<ErrorReplayLesson />}
                />
                <Route path="/content" element={<div data-testid="content" />} />
                <Route
                    path="/lesson/:setSlug/:setId/:filename"
                    element={<div data-testid="lesson" />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

/** Type ``value`` into the visible free-text exercise, grade it, then
 *  advance past the "Weiter" phase. */
async function answerAndAdvance(value: string) {
    fireEvent.change(screen.getByTestId("free-text-input"), {
        target: {value},
    });
    const check = screen.getByTestId("error-replay-check");
    await waitFor(() => expect(check).not.toBeDisabled());
    fireEvent.click(check);
    const next = await screen.findByTestId("error-replay-next");
    fireEvent.click(next);
}

describe("ErrorReplayLesson — SRS success merge (#1304)", () => {
    it("a correct answer records a correct attempt (the success merge)", async () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("hola");

        await waitFor(() => expect(recordBulkMock).toHaveBeenCalledTimes(1));
        const [userId, attempts] = recordBulkMock.mock.calls[0];
        expect(userId).toBe("user-1");
        expect(attempts.some((a: {correct: boolean}) => a.correct)).toBe(true);
    });

    it("a wrong answer still records — the error is kept, not dropped", async () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("WRONG");

        await waitFor(() => expect(recordBulkMock).toHaveBeenCalledTimes(1));
        const [, attempts] = recordBulkMock.mock.calls[0];
        expect(attempts.length).toBeGreaterThan(0);
        expect(attempts.every((a: {correct: boolean}) => !a.correct)).toBe(true);
    });

    it("multiple errors are merged individually (one record per exercise)", async () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola"), FREE("ex-b", "adios")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("hola"); // correct
        await answerAndAdvance("adios"); // correct

        await waitFor(() => expect(recordBulkMock).toHaveBeenCalledTimes(2));
        const firstCall = recordBulkMock.mock.calls[0][1];
        const secondCall = recordBulkMock.mock.calls[1][1];
        expect(firstCall.some((a: {correct: boolean}) => a.correct)).toBe(true);
        expect(secondCall.some((a: {correct: boolean}) => a.correct)).toBe(true);
    });

    it("edge: correcting the last element records AND ends the round cleanly", async () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("hola");

        const summary = await screen.findByTestId("error-replay-summary");
        expect(summary.getAttribute("data-all-corrected")).toBe("true");
        await waitFor(() => expect(recordBulkMock).toHaveBeenCalledTimes(1));
    });

    it("boundary: no learner id → recording is skipped gracefully", async () => {
        learnerUserId = null;
        renderWithState({
            exercises: [FREE("ex-a", "hola")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("hola");

        // The round still completes; nothing is recorded without a user.
        await screen.findByTestId("error-replay-summary");
        expect(recordBulkMock).not.toHaveBeenCalled();
    });
});
