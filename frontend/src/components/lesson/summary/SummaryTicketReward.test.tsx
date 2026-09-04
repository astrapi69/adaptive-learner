/**
 * Tests for SummaryTicketReward (#2889): the ticket-economy gate, the
 * one-shot award on mount (full score / full hearts), the
 * already-completed guard against re-award farming, the streak
 * milestones, and the play-now navigation.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router";
import {beforeEach, describe, expect, it} from "vitest";

import SummaryTicketReward from "./SummaryTicketReward";
import {readTicketState} from "../../../lib/arcade/ticket-store";
import {setPlayfulMode} from "../../../lib/learning/playful/playfulModePref";
import {setPlayfulTickets} from "../../../lib/learning/playful/playfulTicketsPref";

const USER = "u1";

function renderReward(
    props: Partial<Parameters<typeof SummaryTicketReward>[0]> = {},
) {
    return render(
        <MemoryRouter initialEntries={["/lesson"]}>
            <Routes>
                <Route
                    path="/lesson"
                    element={
                        <SummaryTicketReward
                            userId={USER}
                            scoreCorrect={10}
                            scoreTotal={10}
                            fullHeartsRun={false}
                            alreadyCompleted={false}
                            streakDays={0}
                            {...props}
                        />
                    }
                />
                <Route
                    path="/arcade"
                    element={<div data-testid="arcade-probe" />}
                />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    localStorage.clear();
    setPlayfulMode(true);
});

describe("SummaryTicketReward", () => {
    it("renders nothing while the game mode is off", () => {
        setPlayfulMode(false);
        renderReward();
        expect(
            screen.queryByTestId("summary-ticket-reward"),
        ).not.toBeInTheDocument();
        expect(readTicketState(USER).tickets).toBe(0);
    });

    it("renders nothing while the ticket switch is off", () => {
        setPlayfulTickets(false);
        renderReward();
        expect(
            screen.queryByTestId("summary-ticket-reward"),
        ).not.toBeInTheDocument();
    });

    it("a full-score run banks one ticket and shows the banner", () => {
        renderReward();
        expect(
            screen.getByTestId("summary-ticket-reward"),
        ).toHaveTextContent("one game ticket");
        expect(readTicketState(USER).tickets).toBe(1);
    });

    it("full score AND full hearts bank two tickets", () => {
        renderReward({fullHeartsRun: true});
        expect(
            screen.getByTestId("summary-ticket-reward"),
        ).toHaveTextContent("2 game tickets");
        expect(readTicketState(USER).tickets).toBe(2);
    });

    it("an imperfect run without hearts earns nothing", () => {
        renderReward({scoreCorrect: 9});
        expect(
            screen.queryByTestId("summary-ticket-reward"),
        ).not.toBeInTheDocument();
        expect(readTicketState(USER).tickets).toBe(0);
    });

    it("revisiting an already-completed lesson awards nothing", () => {
        renderReward({alreadyCompleted: true});
        expect(
            screen.queryByTestId("summary-ticket-reward"),
        ).not.toBeInTheDocument();
        expect(readTicketState(USER).tickets).toBe(0);
    });

    it("streak milestones bank their tickets alongside the run", () => {
        renderReward({scoreCorrect: 9, streakDays: 8});
        expect(
            screen.getByTestId("summary-ticket-reward"),
        ).toHaveTextContent("2 game tickets");
        expect(readTicketState(USER)).toEqual({
            tickets: 2,
            milestones: [3, 7],
        });
    });

    it("the play-now button navigates to the arcade", () => {
        renderReward();
        fireEvent.click(screen.getByTestId("summary-ticket-play"));
        expect(screen.getByTestId("arcade-probe")).toBeInTheDocument();
    });
});
