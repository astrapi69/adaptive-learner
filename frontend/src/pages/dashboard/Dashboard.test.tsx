import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./Dashboard";
import type { FeatureContext } from "../../features/featureConfig";
import { TestFeatureProvider } from "../../features/testFeatureProvider";
import type { LearningProfile, ProgressSummary, ToolRecommendation } from "../../types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const apiProfile = vi.fn();
const apiProgress = vi.fn();
const apiTools = vi.fn();
const apiSpaced = vi.fn();
const apiSettingsGet = vi.fn();
vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
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
      settings: {
        ...actual.api.settings,
        get: (...args: unknown[]) => apiSettingsGet(...args),
      },
      // #899 — the Dashboard's data effect also fires gamification +
      // pronunciation reads. Left unmocked they hit a real (refused) network,
      // and the latency delays Promise.allSettled past the default
      // findByTestId timeout once the Aktivität tab is lazy (#858) — the radar
      // then renders too late. Stub them to resolve instantly.
      gamification: {
        ...actual.api.gamification,
        getState: () => Promise.resolve(null),
        listBadges: () => Promise.resolve(null),
        getStreak: () => Promise.resolve(null),
        getStreakHeatmap: () => Promise.resolve([]),
      },
      pronunciation: {
        ...actual.api.pronunciation,
        eligibility: () => Promise.resolve({ eligible: false }),
      },
    },
  };
});

// Stub the chart-bearing components so happy-dom doesn't have to
// render recharts SVG. The Dashboard's own wiring is what we
// test here; the chart components have their own dedicated
// tests (or empty-state coverage).
vi.mock("../../components/progress/ProfileRadar", () => ({
  default: ({ profile }: { profile: LearningProfile }) => (
    <div data-testid="profile-radar">{profile.dominant_method}</div>
  ),
}));
vi.mock("../../components/progress/ProgressTimeline", () => ({
  default: () => <div data-testid="progress-timeline" />,
}));
vi.mock("../../components/progress/MethodDistribution", () => ({
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
    sessions_per_method: { deductive: 3, dialogic: 1 },
    method_distribution: [
      { method: "deductive", count: 3, percentage: 75 },
      { method: "dialogic", count: 1, percentage: 25 },
      { method: "inductive", count: 0, percentage: 0 },
      { method: "error_based", count: 0, percentage: 0 },
      { method: "contextual", count: 0, percentage: 0 },
      { method: "ai_adaptive", count: 0, percentage: 0 },
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

function renderDashboard(
  context?: Partial<FeatureContext>,
  initialPath = "/dashboard",
) {
  return render(
    <TestFeatureProvider context={context}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Dashboard />
      </MemoryRouter>
    </TestFeatureProvider>,
  );
}

// #858 — the analytical panels (profile, sessions, progress, method, tools,
// spaced) live on the lazy "Aktivität" tab; render straight at ?tab=activity
// and await the lazy mount.
const ACTIVITY = "/dashboard?tab=activity";

// SESSION_START is disabled in Dexie mode without a key — the context that
// engages the Dashboard's QuickStart gate + skip banner after the
// feature-strategy migration (#286). In API mode the feature is active.
const NO_AI_CONTEXT: Partial<FeatureContext> = { mode: "dexie", hasAiKey: false };

describe("Dashboard page", () => {
  beforeEach(async () => {
    mockNavigate.mockClear();
    apiProfile.mockReset();
    apiProgress.mockReset();
    apiTools.mockReset();
    apiSpaced.mockReset();
    apiSettingsGet.mockReset();
    // Default: empty spaced list. Tests that care override.
    apiSpaced.mockResolvedValue([]);
    // Default: API key is configured. Tests that care
    // about the "no key" path override this per-test.
    apiSettingsGet.mockResolvedValue({
      user_id: "u-1",
      active_provider: "anthropic",
      has_anthropic_key: true,
      has_openai_key: false,
      has_gemini_key: false,
    });
    // Drop the module-level useApiKeyStatus cache so each
    // test's apiSettingsGet mock is honoured.
    const { _resetApiKeyStatusCacheForTests } = await import("../../hooks/settings/useApiKeyStatus");
    _resetApiKeyStatusCacheForTests();
    localStorage.clear();
    localStorage.setItem("adaptive-learner.project_id", "p1");
    localStorage.setItem("adaptive-learner.user_id", "u-1");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to /onboarding when project_id is missing", async () => {
    localStorage.removeItem("adaptive-learner.project_id");
    renderDashboard();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
    });
  });

  it("renders every panel with successful data", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    renderDashboard(undefined, ACTIVITY);
    await screen.findByTestId("dashboard");
    // The Aktivität tab is lazy (#858) and mounts after the data effect
    // resolves; a generous timeout keeps the first lazy assertion off the
    // 1s-default knife-edge (#899).
    expect(
      await screen.findByTestId("profile-radar", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("progress-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("method-distribution")).toBeInTheDocument();
    expect(screen.getByTestId("session-counter")).toBeInTheDocument();
    expect(screen.getByTestId("tool-recs")).toBeInTheDocument();
    expect(screen.getByTestId("metric-total").textContent).toBe("4");
  });

  it("renders empty states when the profile is 404", async () => {
    const { ApiError } = await import("../../api/client");
    apiProfile.mockRejectedValue(new ApiError(404, "No assessment profile yet."));
    apiProgress.mockResolvedValue({ tracking: undefined } as ProgressSummary);
    apiTools.mockResolvedValue([]);
    renderDashboard(undefined, ACTIVITY);
    await screen.findByTestId("dashboard");
    expect(
      await screen.findByTestId("dashboard-profile-empty"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("session-counter-empty")).toBeInTheDocument();
    expect(screen.getByTestId("tool-recs-empty")).toBeInTheDocument();
  });

  it("surfaces a non-404 profile error to the header", async () => {
    const { ApiError } = await import("../../api/client");
    apiProfile.mockRejectedValue(new ApiError(500, "DB down"));
    apiProgress.mockResolvedValue({ tracking: undefined } as ProgressSummary);
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
    renderDashboard(undefined, ACTIVITY);
    await screen.findByTestId("dashboard");
    expect(await screen.findByTestId("spaced-recs")).toBeInTheDocument();
    expect(screen.getByTestId("spaced-rec-sr-deductive-first")).toBeInTheDocument();
  });

  it("renders the spaced empty-state when the server returns []", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    apiSpaced.mockResolvedValue([]);
    renderDashboard(undefined, ACTIVITY);
    await screen.findByTestId("dashboard");
    expect(await screen.findByTestId("spaced-recs-empty")).toBeInTheDocument();
  });

  // --- Issue 4: API-key gating + dismissible skip banner --------------

  it("disables Quick Start and shows the skip banner in Dexie mode without a key", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    renderDashboard(NO_AI_CONTEXT);
    await screen.findByTestId("dashboard");
    await waitFor(() => {
      expect(screen.getByTestId("api-key-skip-banner")).toBeInTheDocument();
    });
    const quickStart = screen.getByTestId("quick-start");
    expect((quickStart as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides the skip banner + enables Quick Start once a key is configured", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    renderDashboard();
    await screen.findByTestId("dashboard");
    await waitFor(() => {
      const quickStart = screen.getByTestId("quick-start");
      expect((quickStart as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.queryByTestId("api-key-skip-banner")).not.toBeInTheDocument();
  });

  it("Dismiss button persists the choice across remounts", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    const first = renderDashboard(NO_AI_CONTEXT);
    await first.findByTestId("dashboard");
    await waitFor(() => {
      expect(first.getByTestId("api-key-skip-banner")).toBeInTheDocument();
    });
    first.getByTestId("api-key-skip-banner-dismiss").click();
    await waitFor(() => {
      expect(first.queryByTestId("api-key-skip-banner")).not.toBeInTheDocument();
    });
    first.unmount();
    // Re-mount in the same gated context; the dismissal must persist
    // via localStorage (the banner would otherwise show again).
    const second = renderDashboard(NO_AI_CONTEXT);
    await second.findByTestId("dashboard");
    expect(second.queryByTestId("api-key-skip-banner")).not.toBeInTheDocument();
  });

  // --- Bug 6 (regression): HelpTooltip rendered on key terms ----------
  //
  // The contextual help system shipped in Phase 38 wires
  // dotted-underline tooltips into the UI. A previous
  // "fix" mounted HelpTooltip only on /onboarding; users
  // reported that Dashboard (and every post-onboarding
  // page) still had no tooltips at all. Pin every card
  // title that wraps a glossary term so a future refactor
  // can't silently strip them again.

  it("renders dotted-underline tooltips on key Dashboard card titles", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    apiSpaced.mockResolvedValue([]);
    // #858 — feature_gamification (XP card) lives on the default Übersicht
    // tab; the analytical card tooltips moved to the Aktivität tab.
    renderDashboard();
    await screen.findByTestId("dashboard");
    expect(
      await screen.findByTestId("help-term-feature_gamification"),
    ).toBeInTheDocument();
  });

  it("renders the analytical-card tooltips on the Aktivität tab", async () => {
    apiProfile.mockResolvedValue(PROFILE);
    apiProgress.mockResolvedValue(SUMMARY);
    apiTools.mockResolvedValue(TOOLS);
    apiSpaced.mockResolvedValue([]);
    renderDashboard(undefined, ACTIVITY);
    await screen.findByTestId("dashboard");
    expect(
      await screen.findByTestId("help-term-learning_profile"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("help-term-learning_session")).toBeInTheDocument();
    expect(screen.getByTestId("help-term-method_ai_adaptive")).toBeInTheDocument();
    expect(
      screen.getByTestId("help-term-feature_spaced_repetition"),
    ).toBeInTheDocument();
  });
});
