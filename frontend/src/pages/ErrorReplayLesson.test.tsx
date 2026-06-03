/**
 * ErrorReplayLesson — "Fehler wiederholen" page.
 *
 * Plays the failed exercises (from router state), scores them, and on
 * the summary shows "X/Y correct now" with an all-corrected
 * celebration or a still-errors retry. The exercise renderers are the
 * real ExerciseDispatcher; only the router state carries the payload.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {describe, expect, it} from "vitest";

import ErrorReplayLesson from "./ErrorReplayLesson";
import type {ContentLessonExercise} from "../storage/types";

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

/** Answer the visible free-text exercise + grade via the two-phase
 *  button, then advance. ``value`` decides right vs wrong. */
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

describe("ErrorReplayLesson", () => {
    it("shows the empty state when there's no router state", () => {
        renderWithState(null);
        expect(screen.getByTestId("error-replay-empty")).toBeInTheDocument();
        expect(
            screen.queryByTestId("error-replay-page"),
        ).not.toBeInTheDocument();
    });

    it("plays ONLY the failed exercises and titles the run", () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola"), FREE("ex-b", "adios")],
            cards: [],
            lessonTitle: "Greetings",
        });
        expect(screen.getByTestId("error-replay-page")).toBeInTheDocument();
        // First failed exercise renders; the run is 2 steps long.
        expect(screen.getByTestId("error-replay-step-ex-a")).toBeInTheDocument();
        expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
        expect(screen.getByText(/Greetings/)).toBeInTheDocument();
    });

    it("all correct after replay → celebration + score", async () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola"), FREE("ex-b", "adios")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("hola"); // correct
        await answerAndAdvance("adios"); // correct
        const summary = await screen.findByTestId("error-replay-summary");
        expect(summary.getAttribute("data-all-corrected")).toBe("true");
        expect(
            screen.getByTestId("error-replay-summary-score").textContent,
        ).toMatch(/2.*2/);
        // No "try again" — all corrected.
        expect(
            screen.queryByTestId("error-replay-summary-retry"),
        ).not.toBeInTheDocument();
    });

    it("still-wrong after replay → offers a retry of only the still-wrong", async () => {
        renderWithState({
            exercises: [FREE("ex-a", "hola"), FREE("ex-b", "adios")],
            cards: [],
            lessonTitle: "Greetings",
        });
        await answerAndAdvance("hola"); // correct
        await answerAndAdvance("WRONG"); // wrong
        const summary = await screen.findByTestId("error-replay-summary");
        expect(summary.getAttribute("data-all-corrected")).toBe("false");
        // 1/2 correct now.
        expect(
            screen.getByTestId("error-replay-summary-score").textContent,
        ).toMatch(/1.*2/);
        // Retry narrows to the 1 still-wrong exercise (ex-b).
        fireEvent.click(screen.getByTestId("error-replay-summary-retry"));
        expect(screen.getByTestId("error-replay-step-ex-b")).toBeInTheDocument();
        expect(screen.getByText(/Step 1 of 1/)).toBeInTheDocument();
    });
});
