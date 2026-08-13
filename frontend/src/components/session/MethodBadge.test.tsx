import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import MethodBadge from "./MethodBadge";

describe("MethodBadge", () => {
    it("renders the localized method label", () => {
        render(<MethodBadge method="dialogic" />);
        const badge = screen.getByTestId("method-badge-dialogic");
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toMatch(/dialogic|Dialogisch|Dialogic/);
    });

    it("applies the method colour as a background when not compact", () => {
        render(<MethodBadge method="error_based" />);
        const badge = screen.getByTestId("method-badge-error_based") as HTMLElement;
        // Background should resolve to the red palette entry —
        // CSS-in-style strings come back in the inline style attr.
        expect(badge.style.background.toLowerCase()).toContain("#ef4444");
    });

    it("compact mode omits the background fill", () => {
        render(<MethodBadge method="deductive" compact />);
        const badge = screen.getByTestId("method-badge-deductive") as HTMLElement;
        // Compact mode -> no inline background.
        expect(badge.style.background).toBe("");
    });

    it("renders the leading dot by default", () => {
        const {container} = render(<MethodBadge method="dialogic" />);
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });

    it("dot={false} omits the leading dot", () => {
        const {container} = render(<MethodBadge method="dialogic" dot={false} />);
        expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    });

    it("testId overrides the default method-badge-<method> testid", () => {
        render(<MethodBadge method="contextual" testId="my-custom-testid" />);
        expect(screen.getByTestId("my-custom-testid")).toBeInTheDocument();
        expect(screen.queryByTestId("method-badge-contextual")).not.toBeInTheDocument();
    });
});
