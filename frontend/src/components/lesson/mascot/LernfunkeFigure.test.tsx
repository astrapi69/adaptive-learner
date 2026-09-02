/**
 * Tests for the Lernfunke figure (#2849): one SVG per pose, sized
 * by prop, token-driven fills only (no raw hex in the markup).
 */

import "@testing-library/jest-dom/vitest";
import {render} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import LernfunkeFigure, {MASCOT_POSES} from "./LernfunkeFigure";

describe("LernfunkeFigure", () => {
    it.each(MASCOT_POSES.map((p) => [p] as const))(
        "renders an svg for pose %s",
        (pose) => {
            const {container} = render(
                <LernfunkeFigure pose={pose} size={40} />,
            );
            const svg = container.querySelector("svg");
            expect(svg).not.toBeNull();
            expect(svg).toHaveAttribute("width", "40");
            expect(svg).toHaveAttribute("height", "40");
        },
    );

    it("uses design tokens for every fill (no raw hex)", () => {
        for (const pose of MASCOT_POSES) {
            const {container} = render(
                <LernfunkeFigure pose={pose} size={40} />,
            );
            expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
            expect(container.innerHTML).toContain("var(--");
        }
    });

    it("applies variant colors to body and celebrate sparkles (#2861)", () => {
        const colors = {
            body: "var(--method-dialogic)",
            spark: "var(--accent)",
        };
        const {container} = render(
            <LernfunkeFigure pose="celebrate" size={40} colors={colors} />,
        );
        expect(container.innerHTML).toContain("var(--method-dialogic)");
        expect(container.innerHTML).toContain("var(--accent)");
        expect(container.innerHTML).not.toContain("var(--method-contextual)");
    });

    it("exposes the four poses", () => {
        expect(MASCOT_POSES).toEqual([
            "idle",
            "cheer",
            "encourage",
            "celebrate",
        ]);
    });
});
