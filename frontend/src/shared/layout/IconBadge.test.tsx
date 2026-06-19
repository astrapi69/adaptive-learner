import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import IconBadge from "./IconBadge";

describe("IconBadge", () => {
    it("renders the label and an optional icon", () => {
        render(
            <IconBadge
                label="Your lesson"
                icon={<svg data-testid="the-icon" />}
                testId="origin-badge"
            />,
        );
        const badge = screen.getByTestId("origin-badge");
        expect(badge).toHaveTextContent("Your lesson");
        expect(screen.getByTestId("the-icon")).toBeInTheDocument();
    });

    it("defaults the accessible name to the label", () => {
        render(<IconBadge label="Your edit" testId="b" />);
        expect(screen.getByTestId("b")).toHaveAttribute("aria-label", "Your edit");
    });

    it("honours an explicit ariaLabel", () => {
        render(<IconBadge label="Your edit" ariaLabel="Your edit of a lesson" testId="b" />);
        expect(screen.getByTestId("b")).toHaveAttribute(
            "aria-label",
            "Your edit of a lesson",
        );
    });

    it("applies the variant + extra className without a hardcoded colour", () => {
        render(<IconBadge label="x" variant="primary" className="extra" testId="b" />);
        const badge = screen.getByTestId("b");
        expect(badge.className).toContain("bg-primary");
        expect(badge.className).toContain("extra");
        // No raw colour literal slipped into the markup.
        expect(badge.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    });
});
