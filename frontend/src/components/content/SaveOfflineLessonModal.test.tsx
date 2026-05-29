import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import SaveOfflineLessonModal from "./SaveOfflineLessonModal";
import type { ConversationAnalysisResult } from "../../types/domain";

const saveUserSet = vi.fn();
vi.mock("../../storage", () => ({
  getStorage: () => ({
    contentLoader: { saveUserSet: (...a: unknown[]) => saveUserSet(...a) },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: unknown) => toastError(m),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({
    t: (_k: string, fallback: string) => fallback,
    lang: "en",
  }),
}));

const ANALYSIS: ConversationAnalysisResult = {
  topic: "Spanish travel",
  summary: "Ordering food.",
  vocabulary: [
    {
      word: "la cuenta",
      translation: "the bill",
      example: "La cuenta, por favor.",
    },
    { word: "el agua", translation: "the water", example: "Quiero el agua." },
    {
      word: "la calle",
      translation: "the street",
      example: "La calle esta cerca.",
    },
    { word: "izquierda", translation: "left", example: "Gira a la izquierda." },
  ],
};

function renderModal(props: Record<string, unknown> = {}) {
  return render(
    <SaveOfflineLessonModal
      open
      analysis={ANALYSIS}
      conversationId="c1"
      conversationTitle="Chat"
      language="es"
      onCancel={() => {}}
      onSaved={() => {}}
      {...props}
    />,
  );
}

describe("SaveOfflineLessonModal", () => {
  beforeEach(() => {
    saveUserSet.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing when closed", () => {
    renderModal({ open: false });
    expect(
      screen.queryByTestId("save-offline-lesson-modal"),
    ).not.toBeInTheDocument();
  });

  it("shows a preview summary and seeds the title from the topic", () => {
    renderModal();
    expect(screen.getByTestId("save-offline-lesson-modal")).toBeInTheDocument();
    expect(
      (screen.getByTestId("save-lesson-title-input") as HTMLInputElement).value,
    ).toBe("Spanish travel");
    expect(screen.getByTestId("save-lesson-summary").textContent).toMatch(
      /exercises/,
    );
  });

  it("saves the generated lesson and calls onSaved", async () => {
    saveUserSet.mockResolvedValue({
      source: "user-generated",
      id: "analysis-c1",
    });
    const onSaved = vi.fn();
    renderModal({ onSaved });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.set_id).toBe("analysis-c1");
    expect(arg.origin).toBe("analysis");
    expect((arg.lessons as unknown[]).length).toBe(1);
    expect((arg.lessons as Array<{ title: string }>)[0].title).toBe(
      "Spanish travel",
    );
    expect(onSaved).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("uses the edited title when saving", async () => {
    saveUserSet.mockResolvedValue({});
    renderModal();
    fireEvent.change(screen.getByTestId("save-lesson-title-input"), {
      target: { value: "My custom title" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as { title: string };
    expect(arg.title).toBe("My custom title");
  });

  it("shows the theory-only note when vocabulary is too small", () => {
    renderModal({
      analysis: {
        topic: "T",
        summary: "s",
        vocabulary: [{ word: "a", translation: "b" }],
      },
    });
    expect(screen.getByTestId("save-lesson-theory-only")).toBeInTheDocument();
  });
});
