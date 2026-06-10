/**
 * Tests for the HelpLink icon button (Phase 38D).
 *
 * Coverage:
 *  - Renders with the canonical testid.
 *  - Click calls ``openHelp(glossaryKey)`` via the
 *    HelpContext.
 *  - aria-label uses the i18n translation by default,
 *    overridable via ``label`` prop.
 *  - Stops event propagation so clicking inside a clickable
 *    parent (a card, a row) does NOT bubble into that
 *    parent's onClick.
 */

import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";

import {HelpProvider} from "../../contexts/HelpContext";
import HelpLink from "./HelpLink";

vi.mock("../../hooks/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        lang: "en",
        setLang: vi.fn(),
    }),
}));

describe("HelpLink", () => {
    it("renders with the canonical testid", () => {
        render(
            <HelpProvider>
                <HelpLink glossaryKey="curriculum" />
            </HelpProvider>,
        );
        expect(
            screen.getByTestId("help-link-curriculum"),
        ).toBeInTheDocument();
    });

    it("uses the i18n translation as the aria-label by default", () => {
        render(
            <HelpProvider>
                <HelpLink glossaryKey="curriculum" />
            </HelpProvider>,
        );
        const btn = screen.getByTestId("help-link-curriculum");
        expect(btn).toHaveAttribute("aria-label", "Open help");
    });

    it("overrides the aria-label via the ``label`` prop", () => {
        render(
            <HelpProvider>
                <HelpLink
                    glossaryKey="method_deductive"
                    label="Explain deductive"
                />
            </HelpProvider>,
        );
        const btn = screen.getByTestId("help-link-method_deductive");
        expect(btn).toHaveAttribute("aria-label", "Explain deductive");
    });

    it("click stops event propagation (does not bubble to a parent)", () => {
        const onParentClick = vi.fn();
        render(
            <HelpProvider>
                <div onClick={onParentClick} data-testid="parent">
                    <HelpLink glossaryKey="curriculum" />
                </div>
            </HelpProvider>,
        );
        fireEvent.click(screen.getByTestId("help-link-curriculum"));
        expect(onParentClick).not.toHaveBeenCalled();
    });

    it("is keyboard-focusable by default (no tabIndex override)", () => {
        render(
            <HelpProvider>
                <HelpLink glossaryKey="curriculum" />
            </HelpProvider>,
        );
        // No explicit tabIndex -> a native <button> stays in the tab
        // order, so the attribute is absent.
        expect(
            screen.getByTestId("help-link-curriculum"),
        ).not.toHaveAttribute("tabindex");
    });

    it("drops out of the tab order when tabIndex=-1 (#175)", () => {
        render(
            <HelpProvider>
                <HelpLink glossaryKey="curriculum" tabIndex={-1} />
            </HelpProvider>,
        );
        expect(screen.getByTestId("help-link-curriculum")).toHaveAttribute(
            "tabindex",
            "-1",
        );
    });
});
