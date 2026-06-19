/**
 * Tests for the import-page analysis loading indicator
 * (feature/analysis-loading-indicator).
 *
 * Pins:
 *   - clicking Analyze shows the loading state (spinner +
 *     phase-driven progress bar + phase label, button disabled)
 *   - Cancel aborts and returns to the pre-analysis state
 *   - a failed analysis renders a friendly inline error (not a
 *     raw toast) and re-enables the button
 *
 * Fully mocks the data layer so the component's analysis flow is
 * driven deterministically.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestFeatureProvider } from "../../features/testFeatureProvider";

// useI18n is mocked to return the fallback string for every key,
// which matches the English copy the component passes inline — so
// the text assertions hold without loading the real i18n catalogs
// (and without the I18nProvider needing the real storage layer).
vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k, lang: "en" }),
}));

// Hoisted so the vi.mock factories below can safely reference them
// (factories run during import resolution, before normal top-level
// const initialisation).
const h = vi.hoisted(() => {
  const detail = {
    id: "conv-1",
    title: "Test conversation",
    source: "manual",
    message_count: 2,
    model: null as string | null,
    analysis_result: null as unknown,
    messages: [
      { id: "m0", role: "user", content: "hi", order_index: 0, timestamp: null },
      {
        id: "m1",
        role: "assistant",
        content: "yo",
        order_index: 1,
        timestamp: null,
      },
    ],
  };
  return {
    detail,
    analyzeConversationMock: vi.fn(),
    saveAnalysisMock: vi.fn(async (_id: string, body: { analysis_result: unknown }) => ({
      ...detail,
      analysis_result: body.analysis_result,
    })),
    notifyMock: {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

vi.mock("../../chat_import/analysis", () => ({
  analyzeConversation: (opts: unknown) => h.analyzeConversationMock(opts),
}));

vi.mock("../../storage", () => ({
  getStorage: () => ({
    imports: {
      get: async () => h.detail,
      saveAnalysis: h.saveAnalysisMock,
    },
    settings: {
      get: async () => ({
        active_provider: "anthropic",
        model_override_anthropic: null,
        language: "en",
      }),
    },
    curricula: { getForConversation: async () => null },
    session: { getActiveForConversation: async () => null },
  }),
}));

vi.mock("../../storage/db", () => ({
  getDb: () => ({
    userSettings: {
      where: () => ({
        equals: () => ({
          first: async () => ({ api_key_anthropic: "k-123" }),
        }),
      }),
    },
  }),
}));

vi.mock("../../hooks/settings/useApiKeyStatus", () => ({
  useApiKeyStatus: () => ({ ready: true, hasKey: true }),
}));

vi.mock("../../lib/learnerState", () => ({
  readLearnerState: () => ({
    userId: "user-1",
    language: "en",
    projectId: null,
  }),
}));

vi.mock("../../utils/notify", () => ({ notify: h.notifyMock }));

import ImportDetail from "./ImportDetail";

function renderDetail() {
  return render(
    <TestFeatureProvider>
      <MemoryRouter initialEntries={["/import/conv-1"]}>
        <Routes>
          <Route path="/import/:conversationId" element={<ImportDetail />} />
        </Routes>
      </MemoryRouter>
    </TestFeatureProvider>,
  );
}

beforeEach(() => {
  h.analyzeConversationMock.mockReset();
  h.saveAnalysisMock.mockClear();
  h.notifyMock.error.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImportDetail analysis loading indicator", () => {
  it("shows the loading state when analysis starts", async () => {
    // Never resolves — keeps the loading state visible.
    h.analyzeConversationMock.mockReturnValue(new Promise(() => {}));
    renderDetail();
    const btn = await screen.findByTestId("analyze-button");
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByTestId("analysis-loading")).toBeInTheDocument());
    expect(screen.getByTestId("analyze-spinner")).toBeInTheDocument();
    expect(screen.getByTestId("analyze-button")).toBeDisabled();
    expect(screen.getByTestId("analysis-phase").textContent).toContain("Step 1/3");
    expect(screen.getByTestId("cancel-analysis-button")).toBeInTheDocument();
  });

  it("cancels and returns to the pre-analysis state", async () => {
    h.analyzeConversationMock.mockImplementation(
      (opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    renderDetail();
    const btn = await screen.findByTestId("analyze-button");
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId("analysis-loading")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("cancel-analysis-button"));

    await waitFor(() => expect(screen.queryByTestId("analysis-loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("analyze-button")).not.toBeDisabled();
    expect(screen.queryByTestId("analysis-error-inline")).not.toBeInTheDocument();
  });

  it("renders a friendly inline error when analysis fails", async () => {
    h.analyzeConversationMock.mockRejectedValue(new Error("boom"));
    renderDetail();
    const btn = await screen.findByTestId("analyze-button");
    fireEvent.click(btn);

    const err = await screen.findByTestId("analysis-error-inline");
    expect(err.textContent).toContain("Analysis failed");
    expect(screen.getByTestId("analyze-button")).not.toBeDisabled();
    // Friendly inline message instead of a raw error toast.
    expect(h.notifyMock.error).not.toHaveBeenCalled();
    expect(screen.queryByTestId("analysis-loading")).not.toBeInTheDocument();
  });
});
