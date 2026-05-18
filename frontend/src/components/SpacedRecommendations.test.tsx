import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import SpacedRecommendations from "./SpacedRecommendations";
import type {SpacedRecommendation} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

function makeCard(
    id: string,
    overrides: Partial<SpacedRecommendation> = {},
): SpacedRecommendation {
    return {
        id,
        method: "deductive",
        interval_days: 3,
        action: "session",
        title: `Review ${id}`,
        urgency: 1.0,
        ...overrides,
    };
}

function renderWith(cards: SpacedRecommendation[]) {
    return render(
        <MemoryRouter>
            <SpacedRecommendations cards={cards} />
        </MemoryRouter>,
    );
}

describe("SpacedRecommendations", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the empty-state when there are no cards", () => {
        renderWith([]);
        expect(screen.getByTestId("spaced-recs-empty")).toBeInTheDocument();
    });

    it("renders one entry per card with title and interval", () => {
        renderWith([
            makeCard("sr-deductive-first", {interval_days: 1}),
            makeCard("sr-inductive-review", {
                method: "inductive",
                interval_days: 3,
                title: "Review induction",
            }),
        ]);
        expect(screen.getByTestId("spaced-recs")).toBeInTheDocument();
        expect(
            screen.getByTestId("spaced-rec-sr-deductive-first"),
        ).toBeInTheDocument();
        const inductive = screen.getByTestId("spaced-rec-sr-inductive-review");
        expect(inductive.textContent).toContain("Review induction");
        expect(inductive.textContent).toContain("3d");
    });

    it("Start navigates to /session with method query param", () => {
        renderWith([
            makeCard("sr-dialogic-practice", {
                method: "dialogic",
                interval_days: 7,
            }),
        ]);
        fireEvent.click(screen.getByTestId("spaced-rec-start-sr-dialogic-practice"));
        expect(mockNavigate).toHaveBeenCalledWith("/session?method=dialogic");
    });

    it("Dismiss removes the card from the list AND persists to localStorage", () => {
        renderWith([
            makeCard("sr-deductive-first"),
            makeCard("sr-inductive-first", {method: "inductive"}),
        ]);
        fireEvent.click(
            screen.getByTestId("spaced-rec-dismiss-sr-deductive-first"),
        );
        // First card removed; second still rendered.
        expect(
            screen.queryByTestId("spaced-rec-sr-deductive-first"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByTestId("spaced-rec-sr-inductive-first"),
        ).toBeInTheDocument();
        // Persisted.
        const raw = localStorage.getItem("adaptive-learner.spaced_dismissed");
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!) as {date: string; ids: string[]};
        expect(parsed.ids).toContain("sr-deductive-first");
        expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("hides cards on mount when localStorage already lists them as dismissed today", () => {
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(
            today.getMonth() + 1,
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        localStorage.setItem(
            "adaptive-learner.spaced_dismissed",
            JSON.stringify({date: iso, ids: ["sr-deductive-first"]}),
        );
        renderWith([makeCard("sr-deductive-first")]);
        expect(
            screen.queryByTestId("spaced-rec-sr-deductive-first"),
        ).not.toBeInTheDocument();
        // All cards dismissed -> empty-state surfaces.
        expect(screen.getByTestId("spaced-recs-empty")).toBeInTheDocument();
    });

    it("ignores yesterday's dismissals (date roll-over re-surfaces the card)", () => {
        localStorage.setItem(
            "adaptive-learner.spaced_dismissed",
            JSON.stringify({date: "2000-01-01", ids: ["sr-deductive-first"]}),
        );
        renderWith([makeCard("sr-deductive-first")]);
        expect(
            screen.getByTestId("spaced-rec-sr-deductive-first"),
        ).toBeInTheDocument();
    });

    it("ignores malformed localStorage entries", () => {
        localStorage.setItem(
            "adaptive-learner.spaced_dismissed",
            "this-is-not-json",
        );
        renderWith([makeCard("sr-deductive-first")]);
        expect(
            screen.getByTestId("spaced-rec-sr-deductive-first"),
        ).toBeInTheDocument();
    });
});
