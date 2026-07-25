/**
 * Header corrections on the "Meine Inhalte" content tab (#1272):
 *
 * 1. The info button (#1252) sits inline with the heading, not on its own
 *    line below it.
 * 2. The heading reads "Meine Inhalte" (matching the tab name), not "Inhalte".
 * 3. The "Quellen:" sources line is no longer permanently visible — it moves
 *    into the expandable info text, and stays dynamic (the real configured
 *    sources, not a static placeholder).
 *
 * No I18nProvider is mounted, so ``t(key, fallback)`` returns the fallback —
 * the assertions target the English fallbacks (the 11-catalog values are
 * verified separately).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
      listLessons: vi.fn(async () => ({ lessons: [] })),
      getLesson: vi.fn(),
      deleteSet: vi.fn(),
      aiValidate: vi.fn(),
      aiValidateCards: vi.fn(),
      getAiValidationCache: vi.fn(async () => null),
      saveAiValidationCache: vi.fn(async () => undefined),
    },
    github: { getStatus: async () => ({ configured: false, source: "none" }) },
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

import ContentPage from "./Content";

const SOURCES = [
  { source: "bundled:adaptive-learner-content", branch: "" },
  { source: "astrapi69/adaptive-learner-content", branch: "main" },
];

beforeEach(() => {
  localStorage.clear();
  listSetsMock.mockReset();
  listSetsMock.mockResolvedValue({ sets: [], sources: SOURCES });
});

afterEach(() => localStorage.clear());

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
}

describe("Content header (#1272)", () => {
  it("renders the info button inline within the header row (not a line below)", async () => {
    renderPage();
    await screen.findByTestId("content-page");
    const header = screen.getByTestId("content-header");
    const button = screen.getByTestId("content-info-button");
    // The button lives inside the header row, next to the title.
    expect(header).toContainElement(button);
    // The title is in the same header row.
    expect(header).toHaveTextContent("Meine Inhalte");
  });

  it("titles the header 'Meine Inhalte' (not 'Inhalte')", async () => {
    renderPage();
    await screen.findByTestId("content-page");
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Meine Inhalte");
  });

  it("does not show the sources line permanently; reveals it in the info text on click", async () => {
    renderPage();
    await screen.findByTestId("content-page");
    // Closed by default: neither the explanatory text nor the sources show.
    expect(screen.queryByTestId("content-info-text")).toBeNull();
    expect(screen.queryByTestId("content-sources")).toBeNull();

    fireEvent.click(screen.getByTestId("content-info-button"));

    // Open: the info text appears, and the sources live inside it.
    const infoText = screen.getByTestId("content-info-text");
    const sources = screen.getByTestId("content-sources");
    expect(infoText).toContainElement(sources);
  });

  it("keeps the sources dynamic (the real configured sources, not a placeholder)", async () => {
    renderPage();
    await screen.findByTestId("content-page");
    fireEvent.click(screen.getByTestId("content-info-button"));
    const sources = screen.getByTestId("content-sources");
    expect(sources).toHaveTextContent("astrapi69/adaptive-learner-content @ main");
    expect(sources).toHaveTextContent("bundled:adaptive-learner-content");
  });
});
