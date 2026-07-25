/**
 * Content page info button (#1251).
 *
 * Pins that the permanent "content.intro" prose on "Meine Inhalte" is replaced
 * by an info button: the text is hidden until the button is clicked, and the
 * revealed text is the content-specific one (distinct from the Discover tab,
 * covered in Discover.test.tsx). localStorage is cleared per test so the
 * seen/visit pref does not leak.
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

beforeEach(() => {
  localStorage.clear();
  listSetsMock.mockReset();
  listSetsMock.mockResolvedValue({ sets: [], sources: [] });
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

describe("Content page info button", () => {
  it("replaces the permanent intro with a blinking info button and reveals the content-specific text on click", async () => {
    renderPage();
    await screen.findByTestId("content-page");

    // The intro prose is NOT permanently visible; the info button is.
    expect(screen.queryByTestId("content-info-text")).toBeNull();
    const button = screen.getByTestId("content-info-button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    // A fresh visitor sees the gentle blink.
    expect(button).toHaveAttribute("data-blink", "true");

    // Click -> the content-specific text expands inline (distinct from Discover).
    fireEvent.click(button);
    expect(screen.getByTestId("content-info-text")).toHaveTextContent(
      "Pre-built lesson sets you can use without an API key.",
    );
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).not.toHaveAttribute("data-blink", "true");
  });
});
