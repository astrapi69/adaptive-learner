/**
 * Regression pins for removing the "Weitermachen" (Continue Learning)
 * panel from the "Meine Inhalte" content tab.
 *
 * Rationale: the panel pushed the downloaded sets down and duplicated
 * a function the Dashboard already owns. It is removed from the content
 * tab; the {@link ContinueLearning} component itself stays (the Dashboard
 * still uses it).
 *
 * Pins:
 * - The content tab no longer embeds the Continue Learning panel.
 * - The downloaded sets render (no longer displaced by the panel).
 * - The Dashboard overview tab still renders Continue Learning
 *   (component not deleted, Dashboard usage intact).
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const listSetsMock = vi.fn();

vi.mock("../../lib/content/repos/recommended-repos", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/repos/recommended-repos")>()),
  fetchRecommendedRepos: vi.fn(async () => []),
}));

vi.mock("../../storage", () => ({
  resolveStorageMode: () => "api",
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: vi.fn(),
      listLessons: vi.fn(async () => ({ lessons: [] })),
      getLesson: vi.fn(),
      deleteSet: vi.fn(),
      aiValidate: vi.fn(),
      aiValidateCards: vi.fn(),
      getAiValidationCache: vi.fn(async () => null),
      saveAiValidationCache: vi.fn(async () => undefined),
    },
    github: {
      getStatus: async () => ({ configured: false, source: "none" }),
    },
  }),
}));

vi.mock("../../hooks/settings/useApiKeyStatus", () => ({
  useApiKeyStatus: () => ({
    ready: true,
    hasKey: false,
    activeProvider: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u1" }),
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

// Mock ContinueLearning with a deterministic sentinel so presence/absence
// is independent of the (unmocked) continue-learning storage data.
vi.mock("../../components/dashboard/ContinueLearning", () => ({
  default: () => <div data-testid="continue-learning-sentinel" />,
}));

import ContentPage from "./Content";
import DashboardOverviewTab from "../dashboard/DashboardOverviewTab";

const SAMPLE_ENTRY = {
  source: "astrapi69/adaptive-learner-content",
  branch: "main",
  id: "language-fr-a1",
  title: "French A1",
  title_native: null,
  language: "fr",
  target_language: "fr",
  source_language: "de",
  level: "A1",
  domain: "language",
  version: "1.0.0",
  lesson_count: 12,
  description: "Beginner French lessons.",
  tags: ["beginner"],
  cover_image: null,
  cached_version: "1.0.0",
  update_available: false,
};

beforeEach(() => {
  listSetsMock.mockReset();
  // Pin the grid tree view (the source→target→level tree) so the set row
  // testid resolves; the list-view default is covered elsewhere.
  localStorage.setItem("adaptive-learner.content_view_mode", "grid");
});

describe("Content tab — Weitermachen panel removed", () => {
  it("does not render the Continue Learning panel in the content tab", async () => {
    listSetsMock.mockResolvedValue({ sets: [SAMPLE_ENTRY], sources: [] });
    render(
      <MemoryRouter>
        <ContentPage />
      </MemoryRouter>,
    );
    await screen.findByTestId("content-page");
    expect(
      screen.queryByTestId("continue-learning-sentinel"),
    ).not.toBeInTheDocument();
  });

  it("renders the downloaded sets (no longer displaced by the panel)", async () => {
    listSetsMock.mockResolvedValue({ sets: [SAMPLE_ENTRY], sources: [] });
    render(
      <MemoryRouter>
        <ContentPage />
      </MemoryRouter>,
    );
    await screen.findByTestId("content-page");
    await waitFor(() => {
      expect(
        screen.getByTestId("content-set-language-fr-a1"),
      ).toBeInTheDocument();
    });
  });

  it("still renders Continue Learning on the Dashboard overview tab", () => {
    render(
      <MemoryRouter>
        <DashboardOverviewTab userId="u1" xpState={null} streakState={null} />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("continue-learning-sentinel"),
    ).toBeInTheDocument();
  });
});
