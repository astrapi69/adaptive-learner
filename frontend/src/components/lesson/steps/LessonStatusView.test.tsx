/**
 * LessonStatusView error-branch tests (#1824).
 *
 * The lesson-load failure screen must not leak the raw underlying
 * error (a Pydantic validation dump in API mode) to production users.
 * Outside Developer Mode it shows a friendly, actionable message; only
 * in Dev Mode does it append the raw detail — matching the
 * DEV-MODE-FRIENDLY-ERRORS-01 posture the toast layer uses.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "../../../hooks/ui/useI18n";
import { setDevModeEnabled } from "../../../hooks/settings/useDevMode";
import LessonStatusView from "./LessonStatusView";

const RAW_ERROR = "7 validation errors for Lesson ... errors.pydantic.dev";

function renderError(error: string | null) {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <LessonStatusView kind="error" error={error} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("LessonStatusView — error branch", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    setDevModeEnabled(false);
    localStorage.clear();
  });

  it("hides the raw error and shows a friendly message outside Dev Mode", () => {
    setDevModeEnabled(false);
    renderError(RAW_ERROR);
    expect(screen.getByTestId("lesson-error")).toBeInTheDocument();
    expect(screen.queryByText(/validation errors|pydantic/i)).toBeNull();
    expect(screen.getByText(/invalid or corrupted data/i)).toBeInTheDocument();
  });

  it("appends the raw error in Dev Mode", () => {
    setDevModeEnabled(true);
    renderError(RAW_ERROR);
    expect(screen.getByText(/Could not load lesson/i)).toBeInTheDocument();
    expect(screen.getByText(/validation errors for Lesson/i)).toBeInTheDocument();
  });

  it("still shows the friendly message when there is no error detail", () => {
    setDevModeEnabled(false);
    renderError(null);
    expect(screen.getByText(/invalid or corrupted data/i)).toBeInTheDocument();
  });
});
