import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Progress from "./Progress";
import type {ProgressCommit, ProgressSummary} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const apiProgress = vi.fn();
const apiCommits = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            tracking: {
                progress: (...args: unknown[]) => apiProgress(...args),
                commits: (...args: unknown[]) => apiCommits(...args),
            },
        },
    };
});

vi.mock("../components/ProgressTimeline", () => ({
    default: () => <div data-testid="progress-timeline" />,
}));
vi.mock("../components/MethodDistribution", () => ({
    default: () => <div data-testid="method-distribution" />,
}));

const SUMMARY: ProgressSummary = {
    tracking: {
        total_sessions: 2,
        total_minutes: 75,
        streak_days: 2,
        sessions_per_method: {deductive: 2},
        method_distribution: [
            {method: "deductive", count: 2, percentage: 100},
            {method: "inductive", count: 0, percentage: 0},
            {method: "error_based", count: 0, percentage: 0},
            {method: "dialogic", count: 0, percentage: 0},
            {method: "contextual", count: 0, percentage: 0},
            {method: "ai_adaptive", count: 0, percentage: 0},
        ],
        recent_understanding: [0.5, 0.6],
        recent_stress: [0.4, 0.35],
        mean_understanding: 0.55,
        mean_stress: 0.38,
        recent_sessions: [],
    },
};

const COMMITS: ProgressCommit[] = [
    {
        id: "c-1",
        project_id: "p-1",
        session_id: "s-1",
        method: "deductive",
        understanding: 0.5,
        stress: 0.4,
        error_rate: 0.1,
        duration_minutes: 30,
        committed_at: "2026-05-17T10:00:00Z",
    },
    {
        id: "c-2",
        project_id: "p-1",
        session_id: "s-2",
        method: "deductive",
        understanding: 0.6,
        stress: 0.35,
        error_rate: 0.05,
        duration_minutes: 45,
        committed_at: "2026-05-18T11:00:00Z",
    },
];

function renderProgress() {
    return render(
        <MemoryRouter>
            <Progress />
        </MemoryRouter>,
    );
}

describe("Progress page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiProgress.mockReset();
        apiCommits.mockReset();
        localStorage.clear();
        localStorage.setItem("adaptive-learner.project_id", "p-1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("redirects to /onboarding when project_id is missing", async () => {
        localStorage.removeItem("adaptive-learner.project_id");
        renderProgress();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {replace: true});
        });
    });

    it("renders the charts + commit table with the newest commit first", async () => {
        apiProgress.mockResolvedValue(SUMMARY);
        apiCommits.mockResolvedValue(COMMITS);
        renderProgress();
        await screen.findByTestId("progress");
        expect(screen.getByTestId("progress-timeline")).toBeInTheDocument();
        expect(screen.getByTestId("method-distribution")).toBeInTheDocument();
        const table = screen.getByTestId("progress-commits");
        const rows = table.querySelectorAll("tbody tr");
        // 2 commits expected. Newest first means c-2 appears
        // before c-1 since the backend returns ASC and the page
        // reverses.
        expect(rows.length).toBe(2);
        expect(rows[0].getAttribute("data-testid")).toBe("commit-row-c-2");
        expect(rows[1].getAttribute("data-testid")).toBe("commit-row-c-1");
    });

    it("renders the empty state when commits are empty", async () => {
        apiProgress.mockResolvedValue(SUMMARY);
        apiCommits.mockResolvedValue([]);
        renderProgress();
        await screen.findByTestId("progress");
        expect(screen.getByTestId("progress-commits-empty")).toBeInTheDocument();
    });

    it("renders an error when one of the fetches fails", async () => {
        const {ApiError} = await import("../api/client");
        apiProgress.mockRejectedValue(new ApiError(500, "DB down"));
        apiCommits.mockResolvedValue([]);
        renderProgress();
        await screen.findByTestId("progress-error");
        expect(screen.getByTestId("progress-error").textContent).toContain("DB down");
    });
});
