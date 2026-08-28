/**
 * Tests for CategorizationResolution (#2772) - the presentational
 * revealed-solution view of the categorization exercise.
 *
 * Pins: every bucket renders with its authored items, the was-correct
 * marker reflects the learner's own assignment, and the aria-live region
 * announces the score.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, within} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import CategorizationResolution from "./CategorizationResolution";
import type {CategorizationPayload} from "../../../lib/exercises/payload/categorization";

const PAYLOAD: CategorizationPayload = {
    categories: [
        {name: "Sichtzeichen", items: ["flache Hand", "Zeigefinger hoch"]},
        {name: "Hoerzeichen", items: ["Sitz", "Platz"]},
    ],
};

const ASSIGNMENTS = new Map<string, string>([
    ["flache Hand", "Sichtzeichen"],
    ["Zeigefinger hoch", "Sichtzeichen"],
    ["Sitz", "Sichtzeichen"], // misplaced by the learner
    ["Platz", "Hoerzeichen"],
]);

describe("CategorizationResolution", () => {
    it("renders every bucket with its authored items", () => {
        render(
            <CategorizationResolution
                payload={PAYLOAD}
                assignments={ASSIGNMENTS}
                correctCount={3}
                totalCount={4}
            />,
        );
        const sicht = screen.getByTestId(
            "categorization-resolved-bucket-Sichtzeichen",
        );
        expect(within(sicht).getByText("flache Hand")).toBeInTheDocument();
        expect(within(sicht).getByText("Zeigefinger hoch")).toBeInTheDocument();
        const hoer = screen.getByTestId(
            "categorization-resolved-bucket-Hoerzeichen",
        );
        expect(within(hoer).getByText("Sitz")).toBeInTheDocument();
        expect(within(hoer).getByText("Platz")).toBeInTheDocument();
    });

    it("marks only the items the learner had placed correctly", () => {
        render(
            <CategorizationResolution
                payload={PAYLOAD}
                assignments={ASSIGNMENTS}
                correctCount={3}
                totalCount={4}
            />,
        );
        expect(
            screen.getByTestId("categorization-resolved-item-Platz"),
        ).toHaveAttribute("data-was-correct", "true");
        expect(
            screen.getByTestId("categorization-resolved-item-Sitz"),
        ).not.toHaveAttribute("data-was-correct");
    });

    it("announces the score via the aria-live region", () => {
        render(
            <CategorizationResolution
                payload={PAYLOAD}
                assignments={ASSIGNMENTS}
                correctCount={3}
                totalCount={4}
            />,
        );
        const status = screen.getByTestId("categorization-resolve-status");
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent("3");
        expect(status).toHaveTextContent("4");
    });
});
