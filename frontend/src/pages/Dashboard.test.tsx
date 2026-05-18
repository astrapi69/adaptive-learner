import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Dashboard from "./Dashboard";
import type {LearningProfile, ProgressSummary, ToolRecommendation} from "../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
    );
    return {...actual, useNavigate: () => mockNavigate};
});

const apiProfile = vi.fn();
const apiProgress = vi.fn();
const apiTools = vi.fn();
const apiSpaced = vi.fn();
vi.mock("../api/client", async () => {
    const actual = await vi.importActual<typeof import("../api/client")>(
        "../api/client",
    );
    return {
        ...actual,
        api: {
            ...actual.api,
            assessment: {
                ...actual.api.assessment,
                profile: (...args: unknown[]) => apiProfile(...args),
            },
            tracking: {
                ...actual.api.tracking,
                progress: (...args: unknown[]) => apiProgress(...args),
            },
            tools: {
                ...actual.api.tools,
                recommendations: (...args: unknown[]) => apiTools(...args),
                spaced: (...args: unknown[]) => apiSpaced(...args),
            },
        },
    };
});

// Stub the chart-bearing components so happy-dom doesn't have to
// render recharts SVG. The Dashboard's own wiring is what we
// test here; the chart components have their own dedicated
// tests (or empty-state coverage).
vi.mock("../components/ProfileRadar", () => ({
    default: ({profile}: {profile: LearningProfile}) => (
        <div data-testid="profile-radar">{profile.dominant_method}</div>
    ),
}));
vi.mock("../components/ProgressTimeline", () => ({
    default: () => <div data-testid="progress-timeline" />,
}));
vi.mock("../components/MethodDistribution", () => ({
    default: () => <div data-testid="method-distribution" />,
}));

const PROFILE: LearningProfile = {
    id: "lp1",
    user_id: "u1",
    project_id: "p1",
    deductive: 0.7,
    inductive: 0.1,
    error_based: 0.1,
    dialogic: 0.05,
    contextual: 0.05,
    ai_adaptive: 0.0,
    assessed_at: "2026-05-18T00:00:00Z",
    version: 1,
    dominant_method: "deductive",
};

const SUMMARY: ProgressSummary = {
    tracking: {
        total_sessions: 4,
        total_minutes: 120,
        streak_days: 2,
        sessions_per_method: {deductive: 3, dialogic: 1},
        method_distribution: [
            {method: "deductive", count: 3, percentage: 75},
            {method: "dialogic", count: 1, percentage: 25},
            {method: "inductive", count: 0, percentage: 0},
            {method: "error_based", count: 0, percentage: 0},
            {method: "contextual", count: 0, percentage: 0},
            {method: "ai_adaptive", count: 0, percentage: 0},
        ],
        recent_understanding: [0.4, 0.5, 0.55, 0.6],
        recent_stress: [0.5, 0.4, 0.4, 0.35],
        mean_understanding: 0.51,
        mean_stress: 0.41,
        recent_sessions: [
            {
                id: "c-1",
                method: "deductive",
                understanding: 0.6,
                stress: 0.35,
                duration_minutes: 30,
                committed_at: "2026-05-18T11:00:00Z",
            },
        ],
    },
};

const TOOLS: ToolRecommendation[] = [
    {
        name: "Anki",
        url: "https://apps.ankiweb.net/",
        why: "Spaced repetition.",
        weight_keys: ["deductive"],
        score: 0.42,
    },
];

function renderDashboard() {
    return render(
        <MemoryRouter>
            <Dashboard />
        </MemoryRouter>,
    );
}

describe("Dashboard page", () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        apiProfile.mockReset();
        apiProgress.mockReset();
        apiTools.mockReset();
        apiSpaced.mockReset();
        // Default: empty spaced list. Tests that care override.
        apiSpaced.mockResolvedValue([]);
        localStorage.clear();
        localStorage.setItem("adaptive-learner.project_id", "p1");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("redirects to /onboarding when project_id is missing", async () => {
        localStorage.removeItem("adaptive-learner.project_id");
        renderDashboard();
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {replace: true});
        });
    });

    it("renders every panel with successful data", async () => {
        apiProfile.mockResolvedValue(PROFILE);
        apiProgress.mockResolvedValue(SUMMARY);
        apiTools.mockResolvedValue(TOOLS);
        renderDashboard();
        await screen.findByTestId("dashboard");
        expect(screen.getByTestId("profile-radar")).toBeInTheDocument();
        expect(screen.getByTestId("progress-timeline")).toBeInTheDocument();
        expect(screen.getByTestId("method-distribution")).toBeInTheDocument();
        expect(screen.getByTestId("session-counter")).toBeInTheDocument();
        expect(screen.getByTestId("tool-recs")).toBeInTheDocument();
        expect(screen.getByTestId("metric-total").textContent).toBe("4");
    });

    it("renders empty states when the profile is 404", async () => {
        const {ApiError} = await import("../api/client");
        apiProfile.mockRejectedValue(
            new ApiError(404, "No assessment profile yet."),
        );
        apiProgress.mockResolvedValue({tracking: undefined} as ProgressSummary);
        apiTools.mockResolvedValue([]);
        renderDashboard();
        await screen.findByTestId("dashboard");
        expect(screen.getByTestId("dashboard-profile-empty")).toBeInTheDocument();
        expect(screen.getByTestId("session-counter-empty")).toBeInTheDocument();
        expect(screen.getByTestId("tool-recs-empty")).toBeInTheDocument();
    });

    it("surfaces a non-404 profile error to the header", async () => {
        const {ApiError} = await import("../api/client");
        apiProfile.mockRejectedValue(new ApiError(500, "DB down"));
        apiProgress.mockResolvedValue({tracking: undefined} as ProgressSummary);
        apiTools.mockResolvedValue([]);
        renderDashboard();
        await screen.findByTestId("dashboard");
        // Error appears in the dashboard header section.
        expect(screen.getByText("DB down")).toBeInTheDocument();
    });

    it("quick-start passes the dominant method to QuickStartButton", async () => {
        apiProfile.mockResolvedValue(PROFILE);
        apiProgress.mockResolvedValue(SUMMARY);
        apiTools.mockResolvedValue(TOOLS);
        renderDashboard();
        await screen.findByTestId("dashboard");
        const badge = screen.getByTestId("quick-start-method");
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toMatch(/deductive|Deduktiv|Deductive/);
    });

    it("renders the spaced-practice card with server data", async () => {
        apiProfile.mockResolvedValue(PROFILE);
        apiProgress.mockResolvedValue(SUMMARY);
        apiTools.mockResolvedValue(TOOLS);
        apiSpaced.mockResolvedValue([
            {
                id: "sr-deductive-first",
                method: "deductive",
                interval_days: 1,
                action: "session",
                title: "First practice in deduction.",
                urgency: 0.5,
            },
        ]);
        renderDashboard();
        await screen.findByTestId("dashboard");
        expect(screen.getByTestId("spaced-recs")).toBeInTheDocument();
        expect(
            screen.getByTestId("spaced-rec-sr-deductive-first"),
        ).toBeInTheDocument();
    });

    it("renders the spaced empty-state when the server returns []", async () => {
        apiProfile.mockResolvedValue(PROFILE);
        apiProgress.mockResolvedValue(SUMMARY);
        apiTools.mockResolvedValue(TOOLS);
        apiSpaced.mockResolvedValue([]);
        renderDashboard();
        await screen.findByTestId("dashboard");
        expect(screen.getByTestId("spaced-recs-empty")).toBeInTheDocument();
    });
});
