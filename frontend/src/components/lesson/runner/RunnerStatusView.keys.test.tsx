/**
 * RunnerStatusView - which catalog key each screen reads (#3203).
 *
 * The chrome every run shares (missing params, not cached, invalid data,
 * back to dashboard) has ONE home, ``runner.*``; the namespace names only
 * the runner's own keys (title, loading); the two texts that explain WHY
 * a run shows nothing, and the two whose triggering condition differs
 * per runner (not cached, missing params), come through the policy keys.
 * A key-echoing ``t``
 * makes the contract visible in the rendered text, independent of any
 * catalog fetch.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDevModeEnabled } from "../../../hooks/settings/useDevMode";
import RunnerStatusView, { type RunnerStatusKind } from "./RunnerStatusView";

vi.mock("../../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key, lang: "en" }),
}));

function renderKind(kind: RunnerStatusKind, error: string | null = null) {
  return render(
    <MemoryRouter>
      <RunnerStatusView
        testIdPrefix="review"
        i18nNamespace="review"
        pageTitleKey="review.page_title"
        emptyBodyKey="review.empty_body"
        loadFailedKey="review.error.load_failed"
        notCachedBodyKey="runner.not_cached_body"
        missingParamsKey="runner.error.missing_params"
        kind={kind}
        error={error}
      />
    </MemoryRouter>,
  );
}

describe("RunnerStatusView - catalog keys per screen (#3203)", () => {
  afterEach(() => {
    setDevModeEnabled(false);
    localStorage.clear();
  });

  it.each([
    [
      "missing",
      "review-missing-params",
      ["review.page_title", "runner.error.missing_params", "lesson.action.open_browser"],
    ],
    ["loading", "review-loading", ["review.loading"]],
    [
      "empty",
      "review-empty",
      ["review.page_title", "review.empty_body", "runner.back_to_dashboard"],
    ],
    [
      "not-cached",
      "review-not-cached",
      ["review.page_title", "runner.not_cached_body", "lesson.action.open_browser"],
    ],
    ["error", "review-error", ["runner.error.invalid_data", "lesson.action.open_browser"]],
  ] as [RunnerStatusKind, string, string[]][])("kind %s reads %s from %j", (kind, testId, keys) => {
    renderKind(kind, "raw");
    const text = screen.getByTestId(testId).textContent ?? "";
    for (const key of keys) expect(text, key).toContain(key);
  });

  it("never reads the shared chrome from the runner's namespace", () => {
    for (const kind of ["missing", "not-cached", "error"] as RunnerStatusKind[]) {
      const { container, unmount } = renderKind(kind, "raw");
      expect(container.textContent).not.toMatch(
        /review\.(error\.missing_params|not_cached_body|error\.invalid_data|back_to_dashboard)/,
      );
      unmount();
    }
  });

  it("Dev Mode shows the policy's load-failed key with the raw error appended", () => {
    setDevModeEnabled(true);
    renderKind("error", "boom");
    expect(screen.getByTestId("review-error").textContent).toContain(
      "review.error.load_failed (boom)",
    );
  });
  it("reads not-cached and missing-params from the policy keys, so the lesson keeps its own", () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <RunnerStatusView
          testIdPrefix="lesson"
          i18nNamespace="lesson"
          pageTitleKey="lesson.page_title"
          emptyBodyKey={null}
          loadFailedKey="lesson.error.load_failed"
          notCachedBodyKey="lesson.not_cached_body"
          missingParamsKey="lesson.error.missing_params"
          kind="not-cached"
          error={null}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("lesson.not_cached_body");
    expect(container.textContent).not.toContain("runner.not_cached_body");
    unmount();
  });

  // EXP-052 slice 3: the title is a policy key, not ``${ns}.page_title``;
  // the replay's namespace has no page_title (it would fall back to the
  // English "Lesson"), so the replay titles its empty screen with its name.
  it.each(["missing", "empty", "not-cached"] as RunnerStatusKind[])(
    "kind %s titles the screen from pageTitleKey, never from the namespace",
    (kind) => {
      const { container } = render(
        <MemoryRouter>
          <RunnerStatusView
            testIdPrefix="error-replay"
            i18nNamespace="lesson.error_replay"
            pageTitleKey="lesson.next_step.error_replay"
            emptyBodyKey="lesson.error_replay.empty"
            loadFailedKey="lesson.error.load_failed"
            notCachedBodyKey="runner.not_cached_body"
            missingParamsKey="runner.error.missing_params"
            kind={kind}
            error={null}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "lesson.next_step.error_replay",
      );
      expect(container.textContent).not.toContain("lesson.error_replay.page_title");
    },
  );
});
