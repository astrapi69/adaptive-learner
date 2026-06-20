/**
 * Tests for MatchingResolution (#824) — the animated reveal of the
 * correct pairs after the learner clicks "Auflösen".
 *
 * Pins: each of the four effects renders its end state, the connect
 * effect overlays SVG connector lines, reduced motion drops every
 * animation utility (final state shown directly), and the aria-live
 * region announces the original correct count.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import MatchingResolution, {type ResolvedPair} from "./MatchingResolution";
import type {MatchingResolveEffect} from "../../lib/learning/matchingResolvePref";

const PAIRS: ResolvedPair[] = [
    {left: "Bonjour", right: "Hello", slot: 0, wasCorrect: true},
    {left: "Merci", right: "Thank you", slot: 1, wasCorrect: false},
    {left: "Au revoir", right: "Goodbye", slot: 2, wasCorrect: true},
];

function renderResolution(
    effect: MatchingResolveEffect,
    reduceMotion = false,
) {
    return render(
        <MatchingResolution
            pairs={PAIRS}
            effect={effect}
            reduceMotion={reduceMotion}
            correctCount={2}
            totalCount={3}
            leftLabel="Term"
            rightLabel="Translation"
        />,
    );
}

describe("MatchingResolution: per-effect rendering", () => {
    it("stack renders one full-width row per pair", () => {
        renderResolution("stack");
        const root = screen.getByTestId("matching-resolution");
        expect(root).toHaveAttribute("data-effect", "stack");
        expect(screen.getByTestId("matching-resolved-row-0")).toHaveTextContent(
            "Bonjour",
        );
        expect(screen.getByTestId("matching-resolved-row-2")).toHaveTextContent(
            "Goodbye",
        );
        // No two-column tiles in the stack layout.
        expect(
            screen.queryByTestId("matching-resolved-a-0"),
        ).not.toBeInTheDocument();
    });

    it("slide renders aligned two-column tiles per pair", () => {
        renderResolution("slide");
        expect(screen.getByTestId("matching-resolution")).toHaveAttribute(
            "data-effect",
            "slide",
        );
        expect(screen.getByTestId("matching-resolved-a-0")).toHaveTextContent(
            "Bonjour",
        );
        expect(screen.getByTestId("matching-resolved-b-0")).toHaveTextContent(
            "Hello",
        );
        // The slide effect animates each tile in.
        expect(screen.getByTestId("matching-resolved-b-0").className).toContain(
            "matching-resolve-slide",
        );
    });

    it("color tints the pairs and fades them in", () => {
        renderResolution("color");
        expect(screen.getByTestId("matching-resolution")).toHaveAttribute(
            "data-effect",
            "color",
        );
        expect(screen.getByTestId("matching-resolved-a-1").className).toContain(
            "matching-resolve-fade",
        );
    });

    it("connect overlays SVG connector lines, one per pair", () => {
        renderResolution("connect");
        expect(screen.getByTestId("matching-resolution")).toHaveAttribute(
            "data-effect",
            "connect",
        );
        expect(
            screen.getByTestId("matching-resolve-connectors"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("matching-connector-line-0"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("matching-connector-line-2"),
        ).toBeInTheDocument();
        // The line draws itself via the keyframe when motion is allowed.
        expect(
            screen
                .getByTestId("matching-connector-line-0")
                .getAttribute("class") ?? "",
        ).toContain("matching-resolve-line");
    });
});

describe("MatchingResolution: reduced motion", () => {
    it("drops the animation utilities from the tiles", () => {
        renderResolution("slide", true);
        const tile = screen.getByTestId("matching-resolved-b-0");
        expect(tile.className).not.toContain("animate-[matching-resolve");
    });

    it("draws the connector lines fully (no line-draw animation)", () => {
        renderResolution("connect", true);
        const line = screen.getByTestId("matching-connector-line-0");
        const cls =
            line.getAttribute("class") ?? "";
        expect(cls).toContain("[stroke-dashoffset:0]");
        expect(cls).not.toContain("matching-resolve-line");
    });
});

describe("MatchingResolution: accessibility", () => {
    it("announces the original correct count via an aria-live region", () => {
        renderResolution("stack");
        const status = screen.getByTestId("matching-resolve-status");
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent("2");
        expect(status).toHaveTextContent("3");
    });
});
