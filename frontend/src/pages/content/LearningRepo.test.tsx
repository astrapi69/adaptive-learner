/**
 * Structure tests for the Learning-Repository page wrapper (#1384).
 *
 * The page's three states (missing-id, loading, rendered) previously used
 * the dead ``page`` / ``learning-repo-page`` CSS classes (defined nowhere)
 * and their ``<main>`` lacked the ``id="main"`` skip-to-content target. All
 * three must render inside the shared {@link PageContainer} with no width
 * jump between states. The repo render itself is mocked; the feature
 * behaviour is covered by the settings-section/widget suites and the
 * dexie-smoke gate.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    learningRepo: {
      render: renderMock,
      exportZip: vi.fn(),
    },
  }),
}));

vi.mock("../../api/client", async (orig) => ({
  ...(await orig<typeof import("../../api/client")>()),
  api: { learningRepo: { persist: vi.fn() } },
}));

vi.mock("../../utils/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
  }),
}));

vi.mock("@astrapi69/feature-strategy-react", () => ({
  Feature: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import LearningRepoPage from "./LearningRepo";
import { PAGE_CONTAINER_CLASSES } from "../../shared/layout/PageContainer";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/projects/:projectId/learning-repo"
          element={<LearningRepoPage />}
        />
        <Route path="/learning-repo" element={<LearningRepoPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  renderMock.mockReset();
});

describe("LearningRepo — shared page container (#1384)", () => {
  it("renders the rendered repo inside the shared PageContainer", async () => {
    renderMock.mockResolvedValue({
      rendered_at: "2026-07-05T12:00:00Z",
      language: "en",
      files: { "README.md": "# Repo" },
    });
    renderAt("/projects/p1/learning-repo");
    const main = await screen.findByTestId("learning-repo-page");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });

  it("renders the loading state inside the same shared container (no width jump)", () => {
    renderMock.mockImplementation(() => new Promise(() => {}));
    renderAt("/projects/p1/learning-repo");
    const main = screen.getByTestId("learning-repo-page-loading");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });

  it("renders the missing-project state inside the same shared container", () => {
    renderAt("/learning-repo");
    const main = screen.getByTestId("learning-repo-page-missing-id");
    expect(main).toHaveAttribute("data-slot", "page-container");
    expect(main).toHaveClass(PAGE_CONTAINER_CLASSES, { exact: true });
  });
});
