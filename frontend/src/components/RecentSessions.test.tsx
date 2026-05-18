import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import RecentSessions from "./RecentSessions";
import type {RecentSessionEntry} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

function entry(
    id: string,
    overrides: Partial<RecentSessionEntry> = {},
): RecentSessionEntry {
    return {
        id,
        method: "deductive",
        understanding: 0.6,
        stress: 0.4,
        duration_minutes: 30,
        committed_at: "2026-05-18T10:00:00Z",
        ...overrides,
    };
}

describe("RecentSessions", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderWith(sessions: RecentSessionEntry[]) {
        return render(
            <MemoryRouter>
                <RecentSessions sessions={sessions} />
            </MemoryRouter>,
        );
    }

    it("renders the empty state when the list is empty", () => {
        renderWith([]);
        expect(screen.getByTestId("recent-sessions-empty")).toBeInTheDocument();
    });

    it("renders one row per session with the method, ratings, and duration", () => {
        renderWith([
            entry("c-1", {duration_minutes: 25}),
            entry("c-2", {method: "dialogic", understanding: 0.4, stress: 0.6}),
        ]);
        expect(screen.getByTestId("recent-sessions")).toBeInTheDocument();
        expect(screen.getByTestId("recent-session-c-1")).toBeInTheDocument();
        expect(screen.getByTestId("recent-session-c-2")).toBeInTheDocument();
        // Duration + percentage rendering for c-1.
        const c1 = screen.getByTestId("recent-session-c-1");
        expect(c1.textContent).toContain("25");  // duration minutes
        expect(c1.textContent).toContain("60%");  // understanding 0.6
        expect(c1.textContent).toContain("40%");  // stress 0.4
    });

    it("clicking a row navigates to /progress", () => {
        renderWith([entry("c-1")]);
        fireEvent.click(screen.getByTestId("recent-session-c-1"));
        expect(mockNavigate).toHaveBeenCalledWith("/progress");
    });

    it("Enter/Space on a focused row navigates to /progress", () => {
        renderWith([entry("c-1")]);
        const row = screen.getByTestId("recent-session-c-1");
        fireEvent.keyDown(row, {key: "Enter"});
        expect(mockNavigate).toHaveBeenCalledWith("/progress");
        mockNavigate.mockClear();
        fireEvent.keyDown(row, {key: " "});
        expect(mockNavigate).toHaveBeenCalledWith("/progress");
    });

    it("does NOT navigate on other keys", () => {
        renderWith([entry("c-1")]);
        const row = screen.getByTestId("recent-session-c-1");
        fireEvent.keyDown(row, {key: "Escape"});
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
