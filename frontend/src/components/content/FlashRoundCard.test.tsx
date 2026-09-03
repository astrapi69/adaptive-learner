/**
 * Tests for the FlashRoundCard (#2888): the game-mode/special-rounds
 * gate, the visible-but-locked state with the unlock tooltip, the
 * perfect-set state, and the start navigation into the error-replay
 * player with the flash-round payload.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, Route, Routes, useLocation} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

import FlashRoundCard from "./FlashRoundCard";
import {setPlayfulMode} from "../../lib/learning/playful/playfulModePref";
import {setPlayfulSpecialRounds} from "../../lib/learning/playful/playfulSpecialRoundsPref";

const listLessons = vi.fn();
const listProgress = vi.fn();
const listErrors = vi.fn();
const getLesson = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listLessons: (...args: unknown[]) => listLessons(...args),
            getLesson: (...args: unknown[]) => getLesson(...args),
        },
        lessonProgress: {
            list: (...args: unknown[]) => listProgress(...args),
        },
        elementErrors: {
            list: (...args: unknown[]) => listErrors(...args),
        },
    }),
}));

const SET = "fr-a1";

function completedRow(filename: string) {
    return {
        id: filename,
        user_id: "u1",
        source: "owner/repo",
        set_id: SET,
        lesson_filename: filename,
        status: "completed",
        step_results: {},
        score_correct: 9,
        score_total: 10,
    };
}

function errorRow(id: string, exerciseId: string) {
    return {
        id,
        user_id: "u1",
        set_id: SET,
        lesson_id: "01.json",
        exercise_id: exerciseId,
        element_key: id,
        element_type: "vocabulary",
        error_count: 3,
        correct_streak: 0,
        mastered: false,
    };
}

function ReplayProbe() {
    const location = useLocation();
    const state = location.state as {
        exercises?: {id: string}[];
        flashRound?: {seconds: number};
    } | null;
    return (
        <div data-testid="replay-probe">
            {state?.exercises?.map((ex) => ex.id).join(",")}|
            {String(state?.flashRound?.seconds)}
        </div>
    );
}

function renderCard() {
    return render(
        <MemoryRouter initialEntries={["/content/set/fr-a1"]}>
            <Routes>
                <Route
                    path="/content/set/:setId"
                    element={
                        <FlashRoundCard
                            source="owner/repo"
                            setId={SET}
                            slug="owner--repo"
                            setTitle="French A1"
                        />
                    }
                />
                <Route
                    path="/error-replay/:setSlug/:setId/:filename"
                    element={<ReplayProbe />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.user_id", "u1");
    listLessons.mockResolvedValue({lessons: ["01.json"]});
    listProgress.mockResolvedValue([completedRow("01.json")]);
    listErrors.mockResolvedValue([errorRow("e1", "ex-1")]);
    getLesson.mockResolvedValue({
        title: "Lesson 01",
        steps: [
            {
                id: "step-ex-1",
                type: "exercise",
                exercise: {id: "ex-1", type: "multiple_choice"},
            },
        ],
        cards: [{id: "c1", front: "eins", back: "one", tags: []}],
    });
});

describe("FlashRoundCard", () => {
    it("renders nothing while the game mode is off", () => {
        renderCard();
        expect(
            screen.queryByTestId("flash-round-card"),
        ).not.toBeInTheDocument();
    });

    it("stays visible-but-locked while the set is unfinished", async () => {
        setPlayfulMode(true);
        listProgress.mockResolvedValue([]);
        renderCard();
        const start = await screen.findByTestId("flash-round-start");
        await waitFor(() => expect(listProgress).toHaveBeenCalled());
        expect(start).toBeDisabled();
        expect(start).toHaveAttribute(
            "title",
            expect.stringContaining("at least one star"),
        );
    });

    it("disappears when the special-rounds switch is off", () => {
        setPlayfulMode(true);
        setPlayfulSpecialRounds(false);
        renderCard();
        expect(
            screen.queryByTestId("flash-round-card"),
        ).not.toBeInTheDocument();
    });

    it("a finished set with errors starts the round with the payload", async () => {
        setPlayfulMode(true);
        renderCard();
        const start = await screen.findByTestId("flash-round-start");
        await waitFor(() => expect(start).not.toBeDisabled());
        fireEvent.click(start);
        const probe = await screen.findByTestId("replay-probe");
        expect(probe).toHaveTextContent("ex-1|30");
        expect(listErrors).toHaveBeenCalledWith("u1", {
            setId: SET,
            includeMastered: true,
        });
    });

    it("a perfect set (no errors) stays disabled with the perfect tooltip", async () => {
        setPlayfulMode(true);
        listErrors.mockResolvedValue([]);
        renderCard();
        const start = await screen.findByTestId("flash-round-start");
        await waitFor(() => expect(listErrors).toHaveBeenCalled());
        expect(start).toBeDisabled();
        expect(start).toHaveAttribute(
            "title",
            expect.stringContaining("perfect"),
        );
    });
});
