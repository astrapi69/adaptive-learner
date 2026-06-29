/**
 * Content page view-mode switch (#1240).
 *
 * Pins the grid ⇄ list toggle at the page level:
 *  - default is the grid/tree view (regression for existing users),
 *  - clicking the list option renders the compact list instead of
 *    the tree, and clicking grid again brings the tree back.
 *
 * localStorage is cleared per test so the persisted view-mode pref
 * does not leak between cases (or into the main Content.test suite).
 */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      listLessons: vi.fn(),
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
    activeProvider: null as string | null,
    refresh: vi.fn(),
  }),
}));
vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u1" }),
}));
vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import ContentPage from "./Content";

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
  localStorage.clear();
  listSetsMock.mockReset();
  listSetsMock.mockResolvedValue({
    sets: [SAMPLE_ENTRY],
    sources: [{ source: SAMPLE_ENTRY.source, branch: "main" }],
  });
});

afterEach(() => {
  localStorage.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
}

describe("Content page view-mode switch", () => {
  it("defaults to the list view (#1257)", async () => {
    renderPage();
    await screen.findByTestId("content-page");
    expect(screen.getByTestId("content-list-view")).toBeInTheDocument();
    expect(screen.queryByTestId("content-tree")).not.toBeInTheDocument();
    expect(screen.getByTestId("content-view-list")).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the tree when grid is selected, and back to list", async () => {
    renderPage();
    await screen.findByTestId("content-page");

    act(() => {
      fireEvent.click(screen.getByTestId("content-view-grid"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("content-tree")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("content-list-view")).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId("content-view-list"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("content-list-view")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("content-tree")).not.toBeInTheDocument();
  });
});
