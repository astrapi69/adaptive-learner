import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ImportLessonModal from "./ImportLessonModal";
import { generateLessonFromAnalysis } from "../../../lib/content/analysis/analysis-to-lesson";
import { lessonJson } from "../../../lib/content/lesson/lesson-export";
import type { ConversationAnalysisResult } from "../../../types/domain";

const saveUserSet = vi.fn();
vi.mock("../../../storage", () => ({
  getStorage: () => ({
    contentLoader: { saveUserSet: (...a: unknown[]) => saveUserSet(...a) },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../../../utils/notify", () => ({
  notify: {
    success: (m: string) => toastSuccess(m),
    error: (m: unknown) => toastError(m),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../hooks/ui/useI18n", () => ({
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

function validLessonFile() {
  const lesson = generateLessonFromAnalysis(ANALYSIS, {
    id: "analysis-conv-1",
  });
  return new File([lessonJson(lesson)], "spanish.json", {
    type: "application/json",
  });
}

describe("ImportLessonModal", () => {
  beforeEach(() => {
    saveUserSet.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing when closed", () => {
    render(
      <ImportLessonModal
        open={false}
        onCancel={() => {}}
        onImported={() => {}}
      />,
    );
    expect(screen.queryByTestId("import-lesson-modal")).not.toBeInTheDocument();
  });

  it("previews a valid file then imports it with origin 'imported'", async () => {
    const onImported = vi.fn();
    saveUserSet.mockResolvedValue({});
    render(
      <ImportLessonModal open onCancel={() => {}} onImported={onImported} />,
    );
    await act(async () => {
      fireEvent.change(screen.getByTestId("import-lesson-file"), {
        target: { files: [validLessonFile()] },
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId("import-lesson-preview")).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("import-lesson-confirm"));
    });
    await waitFor(() => expect(saveUserSet).toHaveBeenCalled());
    const arg = saveUserSet.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.origin).toBe("imported");
    expect((arg.lessons as unknown[]).length).toBe(1);
    expect(onImported).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows a specific error for an invalid file and disables Import", async () => {
    render(
      <ImportLessonModal open onCancel={() => {}} onImported={() => {}} />,
    );
    await act(async () => {
      fireEvent.change(screen.getByTestId("import-lesson-file"), {
        target: { files: [new File(["{bad"], "bad.json")] },
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId("import-lesson-error")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("import-lesson-confirm")).toBeDisabled();
    expect(saveUserSet).not.toHaveBeenCalled();
  });
});
