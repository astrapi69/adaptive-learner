/**
 * SrsStatusBadge tests (#588).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import SrsStatusBadge from "./SrsStatusBadge";

describe("SrsStatusBadge", () => {
    it("renders the label, tone, and title", () => {
        render(
            <SrsStatusBadge
                label="Due"
                tone="warning"
                title="3 elements due"
                testId="badge"
            />,
        );
        const badge = screen.getByTestId("badge");
        expect(badge).toHaveTextContent("Due");
        expect(badge).toHaveAttribute("data-tone", "warning");
        expect(badge).toHaveAttribute("title", "3 elements due");
    });
});
