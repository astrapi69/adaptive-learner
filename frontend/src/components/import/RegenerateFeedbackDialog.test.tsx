/**
 * AIX-05 (EXP-036) — tests for the regenerate feedback dialog.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import RegenerateFeedbackDialog, {
  feedbackForReason,
} from "./RegenerateFeedbackDialog";

const t = (_k: string, fallback?: string) => fallback ?? _k;

describe("feedbackForReason", () => {
  it("maps 'too easy' to a harder request", () => {
    expect(feedbackForReason("too_easy", "")).toContain("harder");
  });

  it("maps 'too hard' to an easier request", () => {
    expect(feedbackForReason("too_hard", "")).toContain("easier");
  });

  it("names the language for 'wrong language'", () => {
    expect(feedbackForReason("wrong_language", "", "German")).toContain("German");
  });

  it("appends free text", () => {
    expect(feedbackForReason("none", "focus on idempotence")).toBe("focus on idempotence");
  });

  it("combines preset and free text", () => {
    const out = feedbackForReason("more_variety", "add code examples");
    expect(out).toContain("variety");
    expect(out).toContain("add code examples");
  });

  it("is empty for 'none' with no free text", () => {
    expect(feedbackForReason("none", "")).toBe("");
  });
});

describe("RegenerateFeedbackDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <RegenerateFeedbackDialog open={false} onSubmit={vi.fn()} onCancel={vi.fn()} t={t} />,
    );
    expect(screen.queryByTestId("regenerate-feedback-dialog")).not.toBeInTheDocument();
  });

  it("submits the chosen reason + free text", () => {
    const onSubmit = vi.fn();
    render(
      <RegenerateFeedbackDialog open onSubmit={onSubmit} onCancel={vi.fn()} t={t} />,
    );
    fireEvent.click(screen.getByTestId("regenerate-reason-too_hard"));
    fireEvent.change(screen.getByTestId("regenerate-freetext"), {
      target: { value: "shorter sentences" },
    });
    fireEvent.click(screen.getByTestId("regenerate-feedback-submit"));
    expect(onSubmit).toHaveBeenCalledWith({
      reason: "too_hard",
      freeText: "shorter sentences",
      language: undefined,
    });
  });

  it("reveals the language picker and includes it for 'wrong language'", () => {
    const onSubmit = vi.fn();
    render(
      <RegenerateFeedbackDialog
        open
        defaultLanguage="de"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByTestId("regenerate-reason-wrong_language"));
    expect(screen.getByTestId("regenerate-language")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("regenerate-feedback-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "wrong_language", language: "de" }),
    );
  });
});
