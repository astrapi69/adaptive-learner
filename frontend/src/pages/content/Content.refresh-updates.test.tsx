/**
 * #3001 — the "Aktualisieren" header button on Meine Inhalte reloads the
 * list AND applies every available set update. Before this, it only
 * re-ran listSets(): a learner following the header badge (#2904/#2998)
 * pressed it, nothing changed, and the badge stayed (#2985 follow-up).
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listSetsMock = vi.fn();
const downloadSetMock = vi.fn();

vi.mock("../../lib/content/repos/recommended-repos", async (orig) => ({
  ...(await orig<typeof import("../../lib/content/repos/recommended-repos")>()),
  fetchRecommendedRepos: vi.fn(async () => []),
}));

vi.mock("../../storage", () => ({
  resolveStorageMode: () => "api",
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: downloadSetMock,
      listLessons: vi.fn(async () => ({ lessons: [] })),
      getLesson: vi.fn(),
      deleteSet: vi.fn(),
      aiValidate: vi.fn(),
      aiValidateCards: vi.fn(),
      getAiValidationCache: vi.fn(async () => null),
      saveAiValidationCache: vi.fn(async () => undefined),
    },
    elementErrors: {
      remapKeys: vi.fn(async () => ({ applied: 0, skipped: 0 })),
      remapExerciseIds: vi.fn(async () => ({ applied: 0, skipped: 0 })),
    },
    github: { getStatus: async () => ({ configured: false, source: "none" }) },
  }),
}));
vi.mock("../../lib/content/update/assess-set-update", () => ({
  assessSetUpdate: vi.fn(async () => ({
    impact: { lostLessons: [], lostCards: [], retiredCards: [], breaking: false },
    retiredIds: [],
    incomingLessons: [],
  })),
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

const BASE = {
  source: "astrapi69/adaptive-learner-content",
  branch: "main",
  language: "fr",
  target_language: "fr",
  source_language: "de",
  level: "A1",
  domain: "language",
  version: "1.1.0",
  lesson_count: 12,
  description: null,
  tags: [],
  cover_image: null,
};
const PENDING = {
  ...BASE,
  id: "fr-a1",
  title: "Französisch A1",
  cached_version: "1.0.0",
  update_available: true,
};
const CURRENT = {
  ...BASE,
  id: "fr-a2",
  title: "Französisch A2",
  cached_version: "1.1.0",
  update_available: false,
};

beforeEach(() => {
  localStorage.clear();
  listSetsMock.mockReset();
  downloadSetMock.mockReset();
  listSetsMock.mockResolvedValue({ sets: [PENDING, CURRENT], sources: [] });
  downloadSetMock.mockResolvedValue({
    ...PENDING,
    cached_version: "1.1.0",
    update_available: false,
  });
});

afterEach(() => localStorage.clear());

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
}

describe("Meine Inhalte header refresh applies all updates (#3001)", () => {
  it("downloads every set with an update available after reloading the list", async () => {
    renderPage();
    await screen.findByTestId("content-page");
    expect(downloadSetMock).not.toHaveBeenCalled();
    const listCallsBeforeClick = listSetsMock.mock.calls.length;

    fireEvent.click(screen.getByTestId("content-refresh"));

    await waitFor(() => expect(downloadSetMock).toHaveBeenCalledTimes(1));
    expect(downloadSetMock).toHaveBeenCalledWith(PENDING.source, "fr-a1");
    // The list was re-read before the update ran.
    expect(listSetsMock.mock.calls.length).toBeGreaterThan(listCallsBeforeClick);
  });

  it("keeps the button disabled until the whole run is over", async () => {
    let release: () => void = () => undefined;
    downloadSetMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ ...PENDING, cached_version: "1.1.0", update_available: false });
        }),
    );
    renderPage();
    await screen.findByTestId("content-page");

    fireEvent.click(screen.getByTestId("content-refresh"));
    await waitFor(() => expect(downloadSetMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("content-refresh")).toBeDisabled();

    release();
    await waitFor(() => expect(screen.getByTestId("content-refresh")).toBeEnabled());
  });
});
