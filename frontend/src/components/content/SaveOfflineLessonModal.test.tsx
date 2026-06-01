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
    // The splitter may produce 1 or more parts depending on step count.
    const lessons = arg.lessons as Array<{title: string}>;
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    // All part titles start with the base lesson title.
    expect(lessons[0].title).toMatch(/^Spanish travel/);
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

  it("passes a distinct language pair, CEFR level, and title_native (EXP-018 fix)", async () => {
    saveUserSet.mockResolvedValue({});
    renderModal({ analysis: { ...ANALYSIS, user_level: "intermediate" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-lesson-save"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.target_language).toBeTruthy();
    expect(arg.source_language).toBeTruthy();
    expect(arg.target_language).not.toBe(arg.source_language);
    expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(arg.level);
    expect(arg.level).toBe("B1"); // intermediate -> B1
    expect(arg.title_native).toBeTruthy();
  });

  it("blocks saving when vocabulary is too small for a shareable lesson", () => {
    renderModal({
      analysis: {
        topic: "French grammar",
        summary: "s",
        vocabulary: [{ word: "a", translation: "b" }],
      },
    });
    // Not enough data → warning shown AND the Save button disabled,
    // so the flow can't produce an unshareable lesson (EXP-018 fix).
    expect(
      screen.getByTestId("save-lesson-not-enough-data"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-lesson-save")).toBeDisabled();
  });

  it("allows saving a same-language lesson (grammar / native study)", async () => {
    // German grammar for German speakers is a legitimate offline
    // lesson. Setting source == target shows an informational hint
    // but must NOT disable Save (bugfix: same-language was a hard
    // block, defeating native-language grammar lessons).
    saveUserSet.mockResolvedValue({});
    renderModal();
    fireEvent.change(screen.getByTestId("save-lesson-target-lang"), {
      target: { value: "de" },
    });
    fireEvent.change(screen.getByTestId("save-lesson-source-lang"), {
      target: { value: "de" },
    });
    // The hint is shown...
    expect(
      screen.getByTestId("save-lesson-same-language"),
    ).toBeInTheDocument();
    // ...but the Save button is NOT disabled (the lesson still has
    // enough exercises from the default ANALYSIS fixture).
    const saveBtn = screen.getByTestId("save-lesson-save");
    expect(saveBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.source_language).toBe("de");
    expect(arg.target_language).toBe("de");
  });
});
