/**
 * AIX-02 (EXP-036) — tests for the "Generate exercises" button.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import GenerateExercisesButton, {
  type ResolvedAiProvider,
} from "./GenerateExercisesButton";
import { I18nProvider } from "../../hooks/ui/useI18n";
import type { ExerciseGenerationResult } from "../../lib/ai/generate-exercises";
import type { TheoryStep } from "../../lib/ai/exercise-generation-prompt";
import { notify } from "../../utils/notify";

vi.mock("../../utils/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockNotify = vi.mocked(notify);

const THEORY: TheoryStep[] = [
  { id: "theory-overview", title: "Ansible", body: "Ansible automates configuration." },
];

const CONFIG: ResolvedAiProvider = {
  provider: "anthropic",
  model: "test-model",
  apiKey: "key",
};

function twoGoodCards(): ExerciseGenerationResult {
  return {
    cards: [
      {
        type: "matching",
        question: "Match the modules.",
        pairs: [
          { left: "file", right: "manage files" },
          { left: "copy", right: "copy files" },
          { left: "service", right: "manage services" },
        ],
      },
      { type: "free_text", question: "What is idempotence?", accepts: ["no change"], distractors: [] },
    ],
    skipped: 0,
    errors: [],
    rejected: [],
    warnings: [],
  };
}

function renderButton(props: Partial<Parameters<typeof GenerateExercisesButton>[0]> = {}) {
  const onGenerated = vi.fn();
  const t = (_k: string, fallback?: string) => fallback ?? _k;
  render(
    <I18nProvider>
      <MemoryRouter>
        <GenerateExercisesButton
          theorySteps={THEORY}
          hasGenerated={false}
          resolveProvider={async () => CONFIG}
          onGenerated={onGenerated}
          t={t}
          generate={vi.fn(async () => twoGoodCards())}
          {...props}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
  return { onGenerated };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("GenerateExercisesButton", () => {
  it("renders the generate label when nothing is generated yet", () => {
    renderButton();
    expect(screen.getByTestId("generate-exercises-button")).toHaveTextContent(
      "Generate exercises",
    );
  });

  it("generates exercises and reports them on success", async () => {
    const { onGenerated } = renderButton();
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
    const exercises = onGenerated.mock.calls[0][0];
    expect(exercises).toHaveLength(2);
    expect(exercises[0].type).toBe("matching");
    expect(mockNotify.success).toHaveBeenCalledWith("2 exercises generated.");
  });

  it("reports the rejected count when the quality gate dropped cards", async () => {
    renderButton({
      generate: vi.fn(async () => {
        const good = twoGoodCards();
        return {
          ...good,
          rejected: [
            { type: "free_text" as const, question: "bad", accepts: ["x"], distractors: [] },
          ],
        };
      }),
    });
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    await waitFor(() => expect(mockNotify.success).toHaveBeenCalled());
    expect(mockNotify.success.mock.calls[0][0]).toContain("rejected");
  });

  it("shows the API-key notice when no key is configured", async () => {
    const { onGenerated } = renderButton({ resolveProvider: async () => null });
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    await waitFor(() =>
      expect(screen.getByTestId("generate-exercises-no-key")).toBeInTheDocument(),
    );
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("reports a friendly error and retry hint when generation throws", async () => {
    const { onGenerated } = renderButton({
      generate: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    await waitFor(() => expect(mockNotify.error).toHaveBeenCalled());
    expect(mockNotify.error.mock.calls[0][0]).toContain("try again");
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("reports when the AI returns no usable exercises", async () => {
    const { onGenerated } = renderButton({
      generate: vi.fn(async () => ({
        cards: [],
        skipped: 1,
        errors: ["bad"],
        rejected: [],
        warnings: [],
      })),
    });
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    await waitFor(() => expect(mockNotify.error).toHaveBeenCalled());
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("renders the regenerate label and opens the feedback dialog", async () => {
    const generate = vi.fn(async () => twoGoodCards());
    const { onGenerated } = renderButton({ hasGenerated: true, generate });
    const button = screen.getByTestId("generate-exercises-button");
    expect(button).toHaveTextContent("Regenerate");
    fireEvent.click(button);
    // The feedback dialog opens instead of generating immediately.
    expect(screen.getByTestId("regenerate-feedback-dialog")).toBeInTheDocument();
    expect(onGenerated).not.toHaveBeenCalled();
    // Submitting the dialog runs the regeneration.
    fireEvent.click(screen.getByTestId("regenerate-feedback-submit"));
    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
  });

  it("passes feedback + previous questions on a 'too easy' regeneration", async () => {
    const generate = vi.fn(async () => twoGoodCards());
    renderButton({
      hasGenerated: true,
      generate,
      previousQuestions: ["Old question?"],
    });
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    fireEvent.click(screen.getByTestId("regenerate-reason-too_easy"));
    fireEvent.click(screen.getByTestId("regenerate-feedback-submit"));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    const opts = (generate.mock.calls[0] as unknown[])[2] as
      | { feedback?: string; avoidQuestions?: string[] }
      | undefined;
    expect(opts?.feedback).toContain("harder");
    expect(opts?.avoidQuestions).toEqual(["Old question?"]);
  });

  it("does not regenerate when the feedback dialog is cancelled", async () => {
    const { onGenerated } = renderButton({ hasGenerated: true });
    fireEvent.click(screen.getByTestId("generate-exercises-button"));
    fireEvent.click(screen.getByTestId("regenerate-feedback-cancel"));
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("disables the button after the max regenerations", async () => {
    const generate = vi.fn(async () => twoGoodCards());
    renderButton({ hasGenerated: true, generate });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId("generate-exercises-button"));
      fireEvent.click(screen.getByTestId("regenerate-feedback-submit"));
      await waitFor(() => expect(generate).toHaveBeenCalledTimes(i + 1));
    }
    await waitFor(() =>
      expect(screen.getByTestId("generate-exercises-max-reached")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("generate-exercises-button")).toBeDisabled();
  });
});
