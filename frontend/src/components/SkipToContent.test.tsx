import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import SkipToContent from "./SkipToContent";

describe("SkipToContent (WCAG SC 2.4.1)", () => {
    it("renders an anchor pointing at #main", () => {
        render(<SkipToContent />);
        const link = screen.getByTestId("skip-to-content");
        expect(link.tagName).toBe("A");
        expect(link.getAttribute("href")).toBe("#main");
    });

    it("has the .skip-to-content utility class", () => {
        render(<SkipToContent />);
        const link = screen.getByTestId("skip-to-content");
        expect(link.classList.contains("skip-to-content")).toBe(true);
    });

    it("renders the (i18n fallback) skip-to-content label", () => {
        render(<SkipToContent />);
        const link = screen.getByTestId("skip-to-content");
        // useI18n returns the fallback string when no I18nProvider
        // wraps the test; that is sufficient to pin the contract.
        expect(link.textContent).toBe("Skip to main content");
    });
});
