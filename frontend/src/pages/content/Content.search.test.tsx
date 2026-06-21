/**
 * Content Browser search — UI behaviour.
 *
 * Mounts the page against a mocked storage namespace that returns two
 * cached sets (a French language set + a Python programming set) with
 * real card content, then exercises the search bar: min-chars gate,
 * debounce, tree filtering, clear, empty state, and lesson navigation.
 * The matching/normalization core is unit-tested in content-search.test.
 */

import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSetsMock = vi.fn();
const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../storage", () => ({
  resolveStorageMode: () => "api",
  getStorage: () => ({
    contentLoader: {
      listSets: listSetsMock,
      downloadSet: vi.fn(),
      listLessons: listLessonsMock,
      getLesson: getLessonMock,
      deleteSet: vi.fn(),
      aiValidate: vi.fn(),
      aiValidateCards: vi.fn(),
      getAiValidationCache: vi.fn(async () => null),
      saveAiValidationCache: vi.fn(async () => undefined),
    },
  }),
  USER_GENERATED_SOURCE: "user-generated",
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

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

import ContentPage from "./Content";

const FR_SET = {
  source: "astrapi69/adaptive-learner-content",
  branch: "main",
  id: "fr-a1",
  title: "Französisch A1",
  title_native: null,
  language: "fr",
  target_language: "fr",
  source_language: "de",
  level: "A1",
  domain: "language",
  version: "1.0.0",
  lesson_count: 2,
  description: "Beginner French.",
  tags: [],
  cover_image: null,
  cached_version: "1.0.0",
  update_available: false,
};
const PY_SET = {
  ...FR_SET,
  id: "python-basics",
  title: "Python Grundlagen",
  language: "de",
  target_language: "de",
  source_language: "de",
  domain: "programming",
  description: "Erste Schritte.",
};

function lessonFor(filename: string) {
  if (filename === "01-bonjour.json") {
    return {
      id: "01",
      title: "Bonjour et salutations",
      estimated_minutes: 5,
      cards: [{ id: "c1", front: "Bonjour", back: "Guten Tag", tags: [] }],
      steps: [],
    };
  }
  return {
    id: "01v",
    title: "Variablen und Datentypen",
    estimated_minutes: 5,
    cards: [{ id: "c2", front: "print()", back: "Gibt Text aus", tags: [] }],
    steps: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listSetsMock.mockResolvedValue({
    sets: [FR_SET, PY_SET],
    sources: [{ source: FR_SET.source, branch: "main" }],
  });
  listLessonsMock.mockImplementation(async (_source: string, id: string) => ({
    lessons: id === "fr-a1" ? ["01-bonjour.json"] : ["01-variablen.json"],
  }));
  getLessonMock.mockImplementation(async (_s: string, _i: string, f: string) =>
    lessonFor(f),
  );
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ContentPage />
    </MemoryRouter>,
  );
}

async function ready() {
  await waitFor(() =>
    expect(screen.getByTestId("content-page")).toBeInTheDocument(),
  );
  // Let the async index build settle.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Content Browser search", () => {
  it("renders the search bar above the tree", async () => {
    renderPage();
    await ready();
    expect(screen.getByTestId("content-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("content-tree")).toBeInTheDocument();
  });

  it("does not search under the minimum length", async () => {
    renderPage();
    await ready();
    fireEvent.change(screen.getByTestId("content-search-input"), {
      target: { value: "p" },
    });
    await new Promise((r) => setTimeout(r, 350));
    expect(
      screen.queryByTestId("content-search-results"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("content-tree")).toBeInTheDocument();
  });

  it("debounces, then filters the tree to matching sets", async () => {
    renderPage();
    await ready();
    fireEvent.change(screen.getByTestId("content-search-input"), {
      target: { value: "python" },
    });
    // Before the 300ms debounce fires, the tree is still shown.
    expect(
      screen.queryByTestId("content-search-results"),
    ).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          screen.getByTestId("content-search-results"),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(
      screen.getByTestId("content-search-set-python-basics"),
    ).toBeInTheDocument();
    // The French set is filtered out.
    expect(
      screen.queryByTestId("content-search-set-fr-a1"),
    ).not.toBeInTheDocument();
    // The normal tree is hidden while searching.
    expect(screen.queryByTestId("content-tree")).not.toBeInTheDocument();
  });

  it("shows only local content and never surfaces index sets (#772)", async () => {
    renderPage();
    await ready();
    // A persistent hint points at /discover while browsing.
    expect(screen.getByTestId("content-discover-hint")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("content-search-input"), {
      target: { value: "python" },
    });
    await waitFor(
      () =>
        expect(screen.getByTestId("content-search-results")).toBeInTheDocument(),
      { timeout: 2000 },
    );
    // The "Your content" heading is the only result group; no index half.
    expect(screen.getByTestId("content-search-your")).toBeInTheDocument();
    expect(screen.queryByTestId("content-available-results")).not.toBeInTheDocument();
    // Discovery of not-downloaded sets is pointed to the Entdecken tab (#856).
    const hint = screen.getByTestId("content-search-discover-hint");
    expect(hint.querySelector("a")).toHaveAttribute("href", "/content?tab=discover");
  });

  it("matches card content and navigates on lesson click", async () => {
    renderPage();
    await ready();
    fireEvent.change(screen.getByTestId("content-search-input"), {
      target: { value: "Bonjour" },
    });
    const lessonBtn = await screen.findByTestId(
      "content-search-lesson-fr-a1-01-bonjour.json",
      {},
      { timeout: 2000 },
    );
    fireEvent.click(lessonBtn);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("/lesson/"),
    );
  });

  it("shows an empty state for no matches", async () => {
    renderPage();
    await ready();
    fireEvent.change(screen.getByTestId("content-search-input"), {
      target: { value: "zzzznotfound" },
    });
    await waitFor(
      () =>
        expect(screen.getByTestId("content-search-empty")).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("clear restores the full tree", async () => {
    renderPage();
    await ready();
    fireEvent.change(screen.getByTestId("content-search-input"), {
      target: { value: "python" },
    });
    await waitFor(
      () =>
        expect(
          screen.getByTestId("content-search-results"),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByTestId("content-search-clear"));
    await waitFor(() =>
      expect(screen.getByTestId("content-tree")).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("content-search-results"),
    ).not.toBeInTheDocument();
  });
});
