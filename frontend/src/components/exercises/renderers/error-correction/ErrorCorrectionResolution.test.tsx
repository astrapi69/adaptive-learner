/**
 * Tests for ErrorCorrectionResolution (#2803) - the presentational
 * revealed-solution view of the error-correction exercise.
 *
 * Pins: every token renders in authored order, the wrong token is struck
 * through with the canonical correction beside it, and the aria-live
 * region announces the corrected sentence.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, within} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ErrorCorrectionResolution from "./ErrorCorrectionResolution";

const TOKENS = ["Der", "Hund", "folgt", "das", "Kommando"];

describe("ErrorCorrectionResolution", () => {
    it("renders every token in order with the correction at the error slot", () => {
        render(
            <ErrorCorrectionResolution
                tokens={TOKENS}
                errorIndex={3}
                correction="dem"
            />,
        );
        const resolution = screen.getByTestId("error-correction-resolution");
        expect(resolution).toHaveTextContent("Der");
        expect(resolution).toHaveTextContent("Hund");
        expect(resolution).toHaveTextContent("folgt");
        expect(resolution).toHaveTextContent("Kommando");
        const wrong = within(resolution).getByTestId(
            "error-correction-resolved-wrong",
        );
        expect(wrong).toHaveTextContent("das");
        expect(wrong.className).toContain("line-through");
        expect(
            within(resolution).getByTestId(
                "error-correction-resolved-correction",
            ),
        ).toHaveTextContent("dem");
    });

    it("announces the corrected sentence via the aria-live region", () => {
        render(
            <ErrorCorrectionResolution
                tokens={TOKENS}
                errorIndex={3}
                correction="dem"
            />,
        );
        const status = screen.getByTestId("error-correction-resolve-status");
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent("Der Hund folgt dem Kommando");
    });
});
