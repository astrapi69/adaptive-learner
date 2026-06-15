import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

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

    describe("focus management (#514)", () => {
        afterEach(() => {
            document.getElementById("skip-test-main")?.remove();
        });

        it("moves keyboard focus into #main on activation", () => {
            const main = document.createElement("main");
            main.id = "main";
            main.setAttribute("data-testid", "skip-test-main");
            document.body.appendChild(main);

            render(<SkipToContent />);
            fireEvent.click(screen.getByTestId("skip-to-content"));

            expect(document.activeElement).toBe(main);
            // tabindex is applied only to make it programmatically
            // focusable; it must not linger in the tab order.
            expect(main.getAttribute("tabindex")).toBe("-1");
            fireEvent.blur(main);
            expect(main.hasAttribute("tabindex")).toBe(false);
        });

        it("does not throw when #main is absent", () => {
            render(<SkipToContent />);
            expect(() =>
                fireEvent.click(screen.getByTestId("skip-to-content")),
            ).not.toThrow();
        });
    });
});
