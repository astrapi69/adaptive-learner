/**
 * Regression test for #2981: the "Fehler nach Aufgabentyp" section rendered
 * the raw ``element_type`` string ("vocabulary", "grammar_rule") instead of a
 * localized label, regardless of the active UI language.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addCatalog, _resetEngineForTests } from "../../i18n/engine";
import type { ElementError } from "../../storage/types/learning/element-errors";

const listErrors = vi.fn();
const listProgress = vi.fn();
const listSets = vi.fn();

vi.mock("../../lib/learning/learnerState", () => ({
  readLearnerState: () => ({ userId: "u1" }),
}));
const DE_CATALOG = {
  set_summary: {
    element_type: { vocabulary: "Wortschatz", grammar_rule: "Grammatikregel" },
  },
};

vi.mock("../../storage", () => ({
  getStorage: () => ({
    elementErrors: { list: listErrors },
    lessonProgress: { list: listProgress },
    contentLoader: { listSets },
    settings: { getApp: () => Promise.resolve({ app: {} }) },
    i18n: { get: () => Promise.resolve(DE_CATALOG) },
  }),
}));

import SetSummary from "./SetSummary";
import { I18nProvider } from "../../hooks/ui/useI18n";

function error(overrides: Partial<ElementError> = {}): ElementError {
  return {
    id: "e1",
    user_id: "u1",
    set_id: "s1",
    lesson_id: "01.json",
    exercise_id: "x1",
    element_key: "el",
    element_type: "vocabulary",
    user_answer: "falsch",
    correct_answer: "richtig",
    error_count: 1,
    correct_streak: 0,
    attempt_count: 1,
    hint_used_count: 0,
    mastered: false,
    mastered_at: null,
    last_error_at: "2026-06-10T12:00:00Z",
    last_attempt_at: "2026-06-10T12:00:00Z",
    ...overrides,
  } as ElementError;
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/content/set-summary/s1"]}>
        <Routes>
          <Route path="/content/set-summary/:setId" element={<SetSummary />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("SetSummary - element_type localization (#2981)", () => {
  beforeEach(() => {
    _resetEngineForTests();
    addCatalog("de", {
      set_summary: {
        element_type: { vocabulary: "Wortschatz", grammar_rule: "Grammatikregel" },
      },
    });
    listErrors.mockReset();
    listProgress.mockReset();
    listSets.mockReset();
    listProgress.mockResolvedValue([]);
    listSets.mockResolvedValue({ sets: [] });
    listErrors.mockResolvedValue([
      error({ id: "e1", element_type: "vocabulary" }),
      error({ id: "e2", element_key: "gr", element_type: "grammar_rule" }),
    ]);
  });

  it("renders the localized German label, not the raw element_type string", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("set-summary-by-type")).toHaveTextContent(
        "Wortschatz: 1",
      ),
    );
    const section = screen.getByTestId("set-summary-by-type");
    expect(section).toHaveTextContent("Grammatikregel: 1");
    expect(section).not.toHaveTextContent("vocabulary");
    expect(section).not.toHaveTextContent("grammar_rule");
  });

  it("falls back to the raw string for an element_type with no translation", async () => {
    listErrors.mockResolvedValue([error({ id: "e3", element_type: "some_future_type" })]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("set-summary-by-type")).toHaveTextContent(
        "some_future_type: 1",
      ),
    );
  });
});
