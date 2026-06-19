import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import AiValidationDialog from "./AiValidationDialog";
import { __resetRateLimitForTests } from "../../hooks/content/useAiCardValidation";
import type { ContentSetEntry } from "../../storage/types";

const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const aiValidateCardsMock = vi.fn();
const getCacheMock = vi.fn();
const saveCacheMock = vi.fn();

vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: {
      listLessons: listLessonsMock,
      getLesson: getLessonMock,
      aiValidateCards: aiValidateCardsMock,
      getAiValidationCache: getCacheMock,
      saveAiValidationCache: saveCacheMock,
    },
  }),
}));

vi.mock("../../lib/learnerState", () => ({
  readLearnerState: () => ({ userId: "u1" }),
}));

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb: string) => fb, lang: "en" }),
}));

const ENTRY: ContentSetEntry = {
  source: "bundled:x",
  branch: "main",
  id: "es-a1",
  title: "Spanish A1",
  language: "es",
  target_language: "es",
  source_language: "de",
  level: "A1",
  domain: "language",
  version: "1",
  lesson_count: 1,
  description: null,
  tags: [],
  cover_image: null,
  cached_version: "1",
  update_available: false,
};

beforeEach(() => {
  __resetRateLimitForTests();
  listLessonsMock.mockReset();
  getLessonMock.mockReset();
  aiValidateCardsMock.mockReset();
  getCacheMock.mockReset();
  saveCacheMock.mockReset();
  getCacheMock.mockResolvedValue(null);
  saveCacheMock.mockResolvedValue(undefined);
  listLessonsMock.mockResolvedValue({
    set_id: "es-a1",
    source: "bundled:x",
    version: "1",
    lessons: ["01.json"],
  });
  getLessonMock.mockResolvedValue({
    id: "01",
    title: "Lektion 1",
    estimated_minutes: 10,
    cards: [
      { id: "c1", front: "libro", back: "Buch", tags: [] },
      { id: "c2", front: "casa", back: "Haus", tags: [] },
    ],
    steps: [],
  });
});

describe("AiValidationDialog", () => {
  it("renders nothing when no entry is set", () => {
    const { container } = render(
      <AiValidationDialog entry={null} activeProvider="openai" onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a cost estimate then runs and renders the report", async () => {
    aiValidateCardsMock.mockResolvedValue({
      results: [
        { card_id: "c1", ok: true, issues: [] },
        {
          card_id: "c2",
          ok: false,
          issues: [{ field: "front", problem: "Artikel falsch", suggestion: "la casa" }],
        },
      ],
      response_ids: ["chatcmpl-abc"],
      provider: "openai",
      model: "gpt-4o-mini",
      checked_cards: 2,
      issue_count: 1,
    });

    render(
      <AiValidationDialog entry={ENTRY} activeProvider="openai" onClose={() => {}} />,
    );

    // Cost estimate appears once lessons are flattened.
    const estimate = await screen.findByTestId("ai-validation-estimate");
    expect(estimate).toHaveTextContent("2 cards");

    fireEvent.click(screen.getByTestId("ai-validation-confirm-run"));

    // Report renders with the OK count + the one flagged card.
    await waitFor(() => {
      expect(screen.getByTestId("ai-validation-report")).toBeInTheDocument();
    });
    expect(screen.getByTestId("validation-report-ok")).toHaveTextContent("1 cards OK");
    expect(screen.getByTestId("validation-report-item-c2")).toHaveTextContent("la casa");
    expect(aiValidateCardsMock).toHaveBeenCalledTimes(1);
    const call = aiValidateCardsMock.mock.calls[0][0];
    expect(call.cards).toHaveLength(2);
    expect(call.target_language).toBe("es");
    expect(call.source_language).toBe("de");
  });

  it("persists the report to the cache after a run", async () => {
    aiValidateCardsMock.mockResolvedValue({
      results: [{ card_id: "c1", ok: true, issues: [] }],
      response_ids: ["chatcmpl-abc"],
      provider: "openai",
      model: "gpt-4o-mini",
      checked_cards: 2,
      issue_count: 0,
    });
    render(
      <AiValidationDialog entry={ENTRY} activeProvider="openai" onClose={() => {}} />,
    );
    fireEvent.click(await screen.findByTestId("ai-validation-confirm-run"));
    await waitFor(() => expect(saveCacheMock).toHaveBeenCalledTimes(1));
    const saved = saveCacheMock.mock.calls[0][0];
    expect(saved.set_id).toBe("es-a1");
    expect(saved.set_version).toBe("1");
    expect(saved.response_ids).toEqual(["chatcmpl-abc"]);
    // AIV-09 — a signature is built from the content hash + response id.
    expect(saved.content_hash).toMatch(/^sha256:/);
    expect(saved.signature).not.toBeNull();
    expect(saved.signature.result).toBe("passed");
    expect(saved.signature.response_id).toBe("chatcmpl-abc");
  });

  it("shows a cached report (no API call) and offers re-check", async () => {
    getCacheMock.mockResolvedValue({
      source: "bundled:x",
      set_id: "es-a1",
      set_version: "1",
      content_hash: null,
      results: [
        {
          card_id: "c2",
          ok: false,
          issues: [{ field: "front", problem: "x", suggestion: "la casa" }],
        },
      ],
      response_ids: [],
      provider: "openai",
      model: "gpt-4o-mini",
      card_count: 2,
      issue_count: 1,
      checked_at: "2026-06-17T12:00:00.000Z",
    });
    render(
      <AiValidationDialog entry={ENTRY} activeProvider="openai" onClose={() => {}} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("ai-validation-report")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("ai-validation-last-checked")).toBeInTheDocument();
    expect(screen.getByTestId("ai-validation-recheck")).toBeInTheDocument();
    expect(screen.getByTestId("ai-validation-export-md")).toBeInTheDocument();
    // Cached path never calls the provider.
    expect(aiValidateCardsMock).not.toHaveBeenCalled();
    // Re-check moves back to the confirm step.
    fireEvent.click(screen.getByTestId("ai-validation-recheck"));
    expect(screen.getByTestId("ai-validation-confirm-run")).toBeInTheDocument();
  });

  it("surfaces an error when the run fails", async () => {
    aiValidateCardsMock.mockRejectedValue(new Error("boom"));
    render(
      <AiValidationDialog entry={ENTRY} activeProvider="openai" onClose={() => {}} />,
    );
    fireEvent.click(await screen.findByTestId("ai-validation-confirm-run"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-validation-error")).toHaveTextContent("boom");
    });
  });
});
