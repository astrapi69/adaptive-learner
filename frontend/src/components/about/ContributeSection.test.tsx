/**
 * Tests for ContributeSection (#1504).
 *
 * The static "help the content library grow" block in Settings > About.
 * It replaces the dynamic per-learner gap list that was removed from
 * /content: a compact card with a short sentence and two repo links
 * (community content + content-set template). No list, no counter.
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContributeSection from "./ContributeSection";

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe("ContributeSection (#1504)", () => {
    it("renders inside a card shell consistent with the sibling About sections", () => {
        render(<ContributeSection t={t} />);
        const section = screen.getByTestId("about-contribute-section");
        expect(section.tagName).toBe("ARTICLE");
        // Same token-backed card shell as DonationSection (surface bg,
        // border, rounded, padded) — never a shell-less section.
        expect(section.className).toContain("rounded-lg");
        expect(section.className).toContain("border-border");
        expect(section.className).toContain("bg-bg-surface");
    });

    it("links to the community content repository with clear link text", () => {
        render(<ContributeSection t={t} />);
        const link = screen.getByTestId("about-contribute-repo-link");
        expect(link).toHaveAttribute(
            "href",
            "https://github.com/astrapi69/adaptive-learner-content",
        );
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        // Clear link text (a11y): not "here"/"click".
        expect(link.textContent?.trim()).toBe("Content repository");
    });

    it("links to the content-set template repository with clear link text", () => {
        render(<ContributeSection t={t} />);
        const link = screen.getByTestId("about-contribute-template-link");
        expect(link).toHaveAttribute(
            "href",
            "https://github.com/astrapi69/adaptive-learner-content-template",
        );
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link.textContent?.trim()).toBe("Content set template");
    });

    it("is purely static — no gap list or counter", () => {
        render(<ContributeSection t={t} />);
        expect(screen.queryByTestId("content-gaps")).not.toBeInTheDocument();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
});
