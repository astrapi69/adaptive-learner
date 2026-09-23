/**
 * RunnerStatusView (EXP-052 slice 0, refs #3169).
 *
 * The status screens of the runner shell, parameterised by testid
 * prefix and i18n namespace. Pins: the testid contract per kind and
 * prefix, the two exits (content browser / dashboard), the #1824
 * dev-mode posture on the error branch for a non-lesson prefix, the
 * pure resolver, and byte-identical output to ``LessonStatusView``
 * for the lesson prefix (the wrapper must not drift).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setDevModeEnabled } from "../../../hooks/settings/useDevMode";
import { I18nProvider } from "../../../hooks/ui/useI18n";
import LessonStatusView, { type LessonStatusKind } from "../steps/LessonStatusView";
import RunnerStatusView, {
  resolveRunnerStatusKind,
  type RunnerStatusKind,
} from "./RunnerStatusView";

const RAW_ERROR = "7 validation errors for Lesson ... errors.pydantic.dev";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderStatus(
  kind: RunnerStatusKind,
  error: string | null = null,
  prefix: "review" | "lesson" = "review",
) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/review/set-1"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <RunnerStatusView
                  testIdPrefix={prefix}
                  i18nNamespace={prefix}
                  kind={kind}
                  error={error}
                />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("RunnerStatusView - testid contract", () => {
  it.each([
    ["missing", "review-missing-params"],
    ["loading", "review-loading"],
    ["empty", "review-empty"],
    ["not-cached", "review-not-cached"],
    ["error", "review-error"],
  ] as [RunnerStatusKind, string][])("kind %s renders main#main with testid %s", (kind, testId) => {
    renderStatus(kind);
    const main = screen.getByTestId(testId);
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveAttribute("id", "main");
    expect(main.className).toContain("lesson-page");
  });

  it("empty offers the dashboard exit under the prefixed testid", () => {
    renderStatus("empty");
    fireEvent.click(screen.getByTestId("review-back-to-dashboard"));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
  });

  it("not-cached offers the content-browser exit under the prefixed testid", () => {
    renderStatus("not-cached");
    fireEvent.click(screen.getByTestId("review-goto-content"));
    expect(screen.getByTestId("location")).toHaveTextContent("/content?tab=my");
  });
});

describe("RunnerStatusView - error branch keeps the #1824 dev-mode posture", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    setDevModeEnabled(false);
    localStorage.clear();
  });

  it("hides the raw error outside Dev Mode", () => {
    setDevModeEnabled(false);
    renderStatus("error", RAW_ERROR);
    expect(screen.queryByText(/validation errors|pydantic/i)).toBeNull();
    expect(screen.getByText(/invalid or corrupted data/i)).toBeInTheDocument();
  });

  it("appends the raw error in Dev Mode", () => {
    setDevModeEnabled(true);
    renderStatus("error", RAW_ERROR);
    expect(screen.getByText(/validation errors for Lesson/i)).toBeInTheDocument();
  });
});

describe("resolveRunnerStatusKind", () => {
  it("reports missing params before looking at the source status", () => {
    expect(resolveRunnerStatusKind(false, "ready")).toBe("missing");
    expect(resolveRunnerStatusKind(false, "loading")).toBe("missing");
  });

  it("returns null once the source is ready", () => {
    expect(resolveRunnerStatusKind(true, "ready")).toBeNull();
  });

  it.each(["loading", "empty", "not-cached", "error"] as const)(
    "maps the non-ready status %s onto the same status kind",
    (status) => {
      expect(resolveRunnerStatusKind(true, status)).toBe(status);
    },
  );
});

describe("RunnerStatusView - lesson prefix is byte-identical to LessonStatusView", () => {
  function html(element: React.ReactElement) {
    const { container, unmount } = render(
      <I18nProvider>
        <MemoryRouter>{element}</MemoryRouter>
      </I18nProvider>,
    );
    const markup = container.innerHTML;
    unmount();
    return markup;
  }

  afterEach(() => {
    setDevModeEnabled(false);
    localStorage.clear();
  });

  it.each(["missing", "loading", "not-cached", "error"] as LessonStatusKind[])(
    "kind %s renders the same markup through both entry points",
    (kind) => {
      const viaLesson = html(<LessonStatusView kind={kind} error={RAW_ERROR} />);
      const viaRunner = html(
        <RunnerStatusView
          testIdPrefix="lesson"
          i18nNamespace="lesson"
          kind={kind}
          error={RAW_ERROR}
        />,
      );
      expect(viaRunner).toBe(viaLesson);
      expect(viaRunner).toContain(`data-testid="lesson-`);
    },
  );

  it("keeps the parity in Dev Mode too (raw error appended)", () => {
    setDevModeEnabled(true);
    const viaLesson = html(<LessonStatusView kind="error" error={RAW_ERROR} />);
    const viaRunner = html(
      <RunnerStatusView
        testIdPrefix="lesson"
        i18nNamespace="lesson"
        kind="error"
        error={RAW_ERROR}
      />,
    );
    expect(viaRunner).toBe(viaLesson);
    expect(viaRunner).toContain(RAW_ERROR);
  });
});
