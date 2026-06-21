import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import AssessmentProgress from "./AssessmentProgress";

describe("AssessmentProgress", () => {
    it("renders the caption with the substituted placeholders", () => {
        render(<AssessmentProgress current={3} total={12} />);
        const node = screen.getByTestId("assessment-progress");
        expect(node).toBeInTheDocument();
        // ``assessment.question_progress`` template is not in the
        // hardcoded fallback bucket; useI18n falls back to the
        // provided fallback string passed by the component.
        expect(node.textContent).toMatch(/3.*12|3 of 12|3 von 12/);
    });

    it("exposes ARIA progressbar attributes", () => {
        render(<AssessmentProgress current={5} total={12} />);
        const bar = screen.getByRole("progressbar");
        expect(bar.getAttribute("aria-valuenow")).toBe("5");
        expect(bar.getAttribute("aria-valuemax")).toBe("12");
        expect(bar.getAttribute("aria-valuemin")).toBe("0");
    });

    it("clamps width to the [0, 100] percent range", () => {
        const {container, rerender} = render(
            <AssessmentProgress current={0} total={12} />,
        );
        const fill = container.querySelector(".assessment-progress-fill") as HTMLElement;
        expect(fill.style.width).toBe("0%");
        rerender(<AssessmentProgress current={12} total={12} />);
        expect(fill.style.width).toBe("100%");
        // Defensive: over-the-cap input clamps to 100%.
        rerender(<AssessmentProgress current={99} total={12} />);
        expect(fill.style.width).toBe("100%");
    });
});
