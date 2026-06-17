import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ValidationReport from "./ValidationReport";

describe("ValidationReport", () => {
  it("renders the set name, summary and OK count", () => {
    render(
      <ValidationReport
        setName="Spanisch A1"
        summaryText="Checked 120 cards in 15 lessons"
        okText="115 cards OK"
        issuesText="5 cards with issues"
        allOkText="All cards passed."
        problemLabel="Problem"
        suggestionLabel="Suggestion"
        items={[]}
        testId="report"
      />,
    );
    expect(screen.getByTestId("validation-report-set")).toHaveTextContent("Spanisch A1");
    expect(screen.getByTestId("validation-report-summary")).toHaveTextContent(
      "Checked 120 cards in 15 lessons",
    );
    expect(screen.getByTestId("validation-report-ok")).toHaveTextContent("115 cards OK");
  });

  it("shows the all-OK state when there are no issue items", () => {
    render(
      <ValidationReport
        setName="Set"
        summaryText="Checked 10 cards"
        okText="10 cards OK"
        allOkText="All cards passed."
        problemLabel="Problem"
        suggestionLabel="Suggestion"
        items={[]}
        testId="report"
      />,
    );
    expect(screen.getByTestId("validation-report-all-ok")).toHaveTextContent(
      "All cards passed.",
    );
    expect(screen.queryByTestId("validation-report-items")).toBeNull();
    // No issuesText ⇒ no issues-count chip.
    expect(screen.queryByTestId("validation-report-issues-count")).toBeNull();
  });

  it("lists each card with its issues (field / problem / suggestion)", () => {
    render(
      <ValidationReport
        setName="Set"
        summaryText="Checked 2 cards"
        okText="1 card OK"
        issuesText="1 card with issues"
        allOkText="All cards passed."
        problemLabel="Problem"
        suggestionLabel="Suggestion"
        items={[
          {
            cardId: "c1",
            label: "Lektion 3, libro",
            issues: [
              { field: "front", problem: "Artikel falsch", suggestion: "el libro" },
            ],
          },
        ]}
        testId="report"
      />,
    );
    const item = screen.getByTestId("validation-report-item-c1");
    expect(item).toHaveTextContent("Lektion 3, libro");
    expect(item).toHaveTextContent("Problem: Artikel falsch");
    expect(item).toHaveTextContent("Suggestion: el libro");
    expect(item).toHaveTextContent("front:");
  });
});
