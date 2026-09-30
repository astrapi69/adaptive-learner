/**
 * Tests for the dashboard ArcadeCard (#2887, #3216): absent while the
 * game mode is off, disabled-with-reason while the game mode is on and
 * the arcade switch is off, the entry card while both are on.
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

    it("stays visible as a disabled card naming the switch when the arcade switch is off (#3216)", () => {
        setPlayfulMode(true);
        setPlayfulArcade(false);
        renderCard();
        expect(screen.queryByTestId("arcade-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("arcade-card-open")).not.toBeInTheDocument();
        const disabled = screen.getByTestId("arcade-card-disabled");
        expect(disabled).toHaveTextContent("Arcade");
        expect(screen.getByTestId("arcade-card-disabled-reason")).toHaveTextContent(
            "arcade switch is off",
        );
        expect(screen.getByTestId("arcade-card-disabled-settings")).toHaveAttribute(
            "href",
            "/settings?tab=learning&section=motivation",
        );
    });

    it("renders nothing while the game mode is off even if the arcade switch is on", () => {
        setPlayfulArcade(true);
        renderCard();
        expect(screen.queryByTestId("arcade-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("arcade-card-disabled")).not.toBeInTheDocument();
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
