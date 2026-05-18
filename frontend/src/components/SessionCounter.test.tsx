import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import SessionCounter from "./SessionCounter";
import type {TrackingSummary} from "../types";

const SUMMARY: TrackingSummary = {
    total_sessions: 5,
    total_minutes: 130,
    streak_days: 3,
    sessions_per_method: {deductive: 3, dialogic: 2},
    method_distribution: [
        {method: "deductive", count: 3, percentage: 60},
        {method: "dialogic", count: 2, percentage: 40},
        {method: "inductive", count: 0, percentage: 0},
        {method: "error_based", count: 0, percentage: 0},
        {method: "contextual", count: 0, percentage: 0},
        {method: "ai_adaptive", count: 0, percentage: 0},
    ],
    recent_understanding: [0.4, 0.5, 0.6, 0.55, 0.7],
    recent_stress: [0.5, 0.4, 0.4, 0.35, 0.3],
    mean_understanding: 0.55,
    mean_stress: 0.39,
    recent_sessions: [],
};

describe("SessionCounter", () => {
    it("renders the v0.4.0 5-cell tile for a non-empty summary", () => {
        render(<SessionCounter summary={SUMMARY} />);
        expect(screen.getByTestId("session-counter")).toBeInTheDocument();
        expect(screen.getByTestId("metric-streak").textContent).toBe("3");
        expect(screen.getByTestId("metric-total").textContent).toBe("5");
        expect(screen.getByTestId("metric-minutes").textContent).toBe("130");
        expect(screen.getByTestId("metric-understanding").textContent).toBe("55%");
        expect(screen.getByTestId("metric-stress").textContent).toBe("39%");
    });

    it("renders the empty-state when the summary is null", () => {
        render(<SessionCounter summary={null} />);
        expect(screen.getByTestId("session-counter-empty")).toBeInTheDocument();
    });

    it("renders the empty-state for zero sessions", () => {
        const empty: TrackingSummary = {
            total_sessions: 0,
            total_minutes: 0,
            streak_days: 0,
            sessions_per_method: {},
            method_distribution: [],
            recent_understanding: [],
            recent_stress: [],
            mean_understanding: 0,
            mean_stress: 0,
            recent_sessions: [],
        };
        render(<SessionCounter summary={empty} />);
        expect(screen.getByTestId("session-counter-empty")).toBeInTheDocument();
    });
});
