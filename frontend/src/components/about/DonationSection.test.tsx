/**
 * Regression pins for DonationSection (#201).
 *
 * The "preferred" badge on the primary donation button used a
 * hardcoded inline ``background: rgba(255,255,255,0.2)``, which made
 * its text invisible on dark themes. It must route through the
 * ``--accent-fg`` design token instead, with no hardcoded colour.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import DonationSection from "./DonationSection";

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe("DonationSection: preferred badge (#201)", () => {
    it("renders the preferred badge on the primary channel", () => {
        render(<DonationSection t={t} />);
        const badge = screen.getByTestId("about-donation-preferred-badge");
        expect(badge).toHaveTextContent("preferred");
    });

    it("badge carries no hardcoded colour and routes through --accent-fg", () => {
        render(<DonationSection t={t} />);
        const badge = screen.getByTestId("about-donation-preferred-badge");

        // No inline colour literal (the dark-theme invisibility cause).
        const inlineStyle = badge.getAttribute("style") ?? "";
        expect(inlineStyle).not.toMatch(/rgba?\(|#[0-9a-fA-F]{3}/);

        // Text + background both reference the on-accent token.
        expect(badge.className).toContain("var(--accent-fg)");
    });
});
