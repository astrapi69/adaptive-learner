import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { SetReview } from "../../lib/statistics/set-review";
import ReviewReport from "./ReviewReport";

const t = (_key: string, fallback?: string) => fallback ?? _key;

function review(overrides: Partial<SetReview> = {}): SetReview {
  return {
    setId: "s1",
    hasData: true,
    totalErrors: 7,
    elementsTracked: 4,
    elementsMastered: 1,
    masteredShare: 25,
    lessonsCompleted: 2,
    timeSpentSeconds: 150,
    byLesson: [{ lessonId: "01.json", errors: 5, elements: 3 }],
    byType: [{ type: "vocabulary", errors: 7, elements: 4 }],
    weakAreas: [
      {
        elementKey: "bonjour",
        lessonId: "01.json",
        errorCount: 4,
        mastered: false,
        lastAnswer: "bonjor",
        correctAnswer: "bonjour",
      },
    ],
    ...overrides,
  };
}

function renderReport(props: Partial<React.ComponentProps<typeof ReviewReport>> = {}) {
  return render(
    <MemoryRouter>
      <ReviewReport review={review()} t={t} testIdPrefix="rr" {...props} />
    </MemoryRouter>,
  );
}

describe("ReviewReport (#3124)", () => {
  it("renders the four key figures, the type breakdown and the weak spots under the prefix", () => {
    renderReport();
    expect(screen.getByTestId("rr-total-errors")).toHaveTextContent("7");
    expect(screen.getByTestId("rr-mastered")).toHaveTextContent("25%");
    expect(screen.getByTestId("rr-open")).toHaveTextContent("3");
    expect(screen.getByTestId("rr-time")).toHaveTextContent("3 min");
    expect(screen.getByTestId("rr-by-type")).toHaveTextContent("vocabulary: 7");
    expect(screen.getByTestId("rr-weak-areas")).toHaveTextContent("bonjor");
    expect(screen.getByTestId("rr-weak-areas")).toHaveTextContent("4 mistakes");
  });

  it("shows the per-lesson breakdown only for the set scope", () => {
    const { unmount } = renderReport({ showByLesson: true });
    expect(screen.getByTestId("rr-by-lesson")).toHaveTextContent("01.json");
    unmount();
    renderReport({ showByLesson: false });
    expect(screen.queryByTestId("rr-by-lesson")).toBeNull();
  });

  it("uses the requested heading level for its sections", () => {
    renderReport({ headingLevel: 4 });
    const heading = screen.getByTestId("rr-by-type").querySelector("h4");
    expect(heading).toHaveTextContent("Mistakes per exercise type");
    expect(screen.getByTestId("rr-by-type").querySelector("h2")).toBeNull();
  });

  it("renders the action links only when their routes are given", () => {
    const { unmount } = renderReport({ practiceHref: "/review/s1", backHref: "/content/set/s1" });
    expect(screen.getByTestId("rr-practice")).toHaveAttribute("href", "/review/s1");
    expect(screen.getByTestId("rr-back")).toHaveAttribute("href", "/content/set/s1");
    unmount();
    renderReport();
    expect(screen.queryByTestId("rr-practice")).toBeNull();
    expect(screen.queryByTestId("rr-back")).toBeNull();
  });

  it.each([
    ["a review without data", review({ hasData: false })],
    ["no review at all", null],
  ])("renders the empty state for %s", (_name, value) => {
    renderReport({ review: value });
    expect(screen.getByTestId("rr-empty")).toHaveTextContent("No mistakes recorded");
    expect(screen.queryByTestId("rr-report")).toBeNull();
  });
});
