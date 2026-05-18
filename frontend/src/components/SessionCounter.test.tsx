import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import SessionCounter from "./SessionCounter";
import type {TrackingSummary} from "../types";

const SUMMARY: TrackingSummary = {
    total_sessions: 5,
    sessions_per_method: {deductive: 3, dialogic: 2},
    recent_understanding: [0.4, 0.5, 0.6, 0.55, 0.7],
    recent_stress: [0.5, 0.4, 0.4, 0.35, 0.3],
    mean_understanding: 0.55,
    mean_stress: 0.39,
};

describe("SessionCounter", () => {
    it("renders the metric tiles for a non-empty summary", () => {
        render(<SessionCounter summary={SUMMARY} />);
        expect(screen.getByTestId("session-counter")).toBeInTheDocument();
        expect(screen.getByTestId("metric-total").textContent).toBe("5");
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
            sessions_per_method: {},
            recent_understanding: [],
            recent_stress: [],
            mean_understanding: 0,
            mean_stress: 0,
        };
        render(<SessionCounter summary={empty} />);
        expect(screen.getByTestId("session-counter-empty")).toBeInTheDocument();
    });
});
