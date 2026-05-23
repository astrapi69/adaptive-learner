import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ChartSummary from "./ChartSummary";

describe("ChartSummary (Phase 39 C4)", () => {
    it("renders the summary as a visible caption by default", () => {
        render(
            <ChartSummary
                summary="Your strongest method: Deductive (0.8)"
                testid="x"
            />,
        );
        const cap = screen.getByTestId("x-caption");
        expect(cap.tagName).toBe("P");
        expect(cap.textContent).toBe(
            "Your strongest method: Deductive (0.8)",
        );
    });

    it("hides the visible caption when summaryVisible=false and keeps sr-only copy", () => {
        const {container} = render(
            <ChartSummary
                summary="Hidden but readable by AT"
                summaryVisible={false}
                testid="x"
            />,
        );
        expect(screen.queryByTestId("x-caption")).toBeNull();
        const srOnly = container.querySelector(".sr-only");
        expect(srOnly?.textContent).toBe("Hidden but readable by AT");
    });

    it("renders the data table behind a <details> when headers + rows are passed", () => {
        render(
            <ChartSummary
                summary="A summary"
                tableHeaders={["A", "B", "C"]}
                tableRows={[
                    ["x", 1, 2],
                    ["y", 3, 4],
                ]}
                testid="x"
            />,
        );
        const details = screen.getByTestId("x-table-toggle");
        expect(details.tagName).toBe("DETAILS");
        // Headers carry scope="col"
        const ths = details.querySelectorAll("th");
        expect(ths).toHaveLength(3);
        for (const th of ths) {
            expect(th.getAttribute("scope")).toBe("col");
        }
        // 2 rows × 3 cells each.
        const trs = details.querySelectorAll("tbody tr");
        expect(trs).toHaveLength(2);
        expect(trs[0].querySelectorAll("td")).toHaveLength(3);
    });

    it("does NOT render the <details> when no table data is provided", () => {
        render(<ChartSummary summary="No table here" testid="x" />);
        expect(screen.queryByTestId("x-table-toggle")).toBeNull();
    });
});
