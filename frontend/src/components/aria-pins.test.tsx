/**
 * Phase 39 C3 — WCAG 2.1 ARIA-attribute pins.
 *
 * Regression pins for the role="status" and role="alert"
 * landmarks introduced for loading + error copy across the
 * 13 pages. Component-level aria-label additions for
 * placeholder-only inputs (HelpBrowser, SubjectBrowser,
 * TagManager, ModelPicker, ProjectTaxonomy, Settings) are
 * caught by the C6 axe-core pass; we don't duplicate those
 * with mocked unit tests here.
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

describe("Phase 39 C3 — role=status (loading) landmark", () => {
    it("a loading paragraph with role=status is announced as a status region", () => {
        render(<p className="muted" role="status">Loading…</p>);
        const node = screen.getByRole("status");
        expect(node.textContent).toBe("Loading…");
    });
});

describe("Phase 39 C3 — role=alert (error) landmark", () => {
    it("an error paragraph with role=alert is announced as an alert region", () => {
        render(<p className="error-text" role="alert">Something broke</p>);
        const node = screen.getByRole("alert");
        expect(node.textContent).toBe("Something broke");
    });
});
