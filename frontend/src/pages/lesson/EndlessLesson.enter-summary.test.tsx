/**
 * #1864 — the Endless-mode "Practice session complete!" summary shows a
 * single "Back to Dashboard" button. Auto-focusing it means Enter (a
 * focused button activates natively) returns to the dashboard, matching
 * the Error-Replay all-corrected screen.
 *
 * ``useEndlessLesson`` is mocked to a minimal ready session so the test
 * drives the End button -> summary and asserts the auto-focus wiring.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

const useEndlessLessonMock = vi.fn();
vi.mock("../../hooks/lesson/modes/useEndlessLesson", () => ({
    useEndlessLesson: () => useEndlessLessonMock(),
}));

// The summary never renders an exercise; a null step keeps the run
// screen inert until "End" flips to the summary.
const READY = {
    status: "ready" as const,
    step: null,
    cards: [],
    stats: {
        cards: 3,
        correct: 2,
        reviewsDone: 1,
        newLearned: 1,
        errorsPracticed: 1,
        xp: 2,
    },
    error: null,
    advance: vi.fn(),
    recordStepAttempts: vi.fn().mockResolvedValue(undefined),
};

import EndlessLessonPage from "./EndlessLesson";

beforeEach(() => {
    useEndlessLessonMock.mockReset();
    useEndlessLessonMock.mockReturnValue(READY);
});

describe("EndlessLesson: Enter on the completion summary (#1864)", () => {
    it("auto-focuses the sole 'Back to Dashboard' button so Enter exits", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={["/endless/fr-a1"]}>
                <Routes>
                    <Route
                        path="/endless/:setId"
                        element={<EndlessLessonPage />}
                    />
                    <Route
                        path="/dashboard"
                        element={<div data-testid="dashboard-stub" />}
                    />
                </Routes>
            </MemoryRouter>,
        );
        // End the session -> the summary renders.
        fireEvent.click(screen.getByTestId("endless-end"));
        const exit = await screen.findByTestId("endless-summary-exit");
        expect(exit).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(
            await screen.findByTestId("dashboard-stub"),
        ).toBeInTheDocument();
    });
});
