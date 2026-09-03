/**
 * Tests for the dashboard ArcadeCard (#2887): fully hidden outside
 * the game mode / with the arcade switch off (the issue's decided
 * gate), visible with the entry button while both are on.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it} from "vitest";

import ArcadeCard from "./ArcadeCard";
import {awardTickets} from "../../lib/arcade/ticket-store";
import {setPlayfulArcade} from "../../lib/learning/playful/playfulArcadePref";
import {setPlayfulMode} from "../../lib/learning/playful/playfulModePref";
import {setPlayfulTickets} from "../../lib/learning/playful/playfulTicketsPref";

function renderCard() {
    return render(
        <MemoryRouter>
            <ArcadeCard />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    localStorage.clear();
});

describe("ArcadeCard", () => {
    it("renders nothing while the game mode is off", () => {
        renderCard();
        expect(screen.queryByTestId("arcade-card")).not.toBeInTheDocument();
    });

    it("renders the entry card while game mode + arcade are on", () => {
        setPlayfulMode(true);
        renderCard();
        expect(screen.getByTestId("arcade-card")).toBeInTheDocument();
        expect(screen.getByTestId("arcade-card-open")).toBeInTheDocument();
    });

    it("disappears when the arcade switch is turned off", () => {
        setPlayfulMode(true);
        setPlayfulArcade(false);
        renderCard();
        expect(screen.queryByTestId("arcade-card")).not.toBeInTheDocument();
    });

    it("shows the ticket balance while the economy is on (#2889)", () => {
        setPlayfulMode(true);
        localStorage.setItem("adaptive-learner.user_id", "u1");
        awardTickets("u1", 3, 5);
        renderCard();
        expect(screen.getByTestId("arcade-card-tickets")).toHaveTextContent(
            "Tickets: 3",
        );
    });

    it("hides the ticket line when the ticket switch is off (#2889)", () => {
        setPlayfulMode(true);
        setPlayfulTickets(false);
        renderCard();
        expect(
            screen.queryByTestId("arcade-card-tickets"),
        ).not.toBeInTheDocument();
    });
});
