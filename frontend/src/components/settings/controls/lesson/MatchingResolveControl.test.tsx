/**
 * MatchingResolveControl (#824, #3186) - the Settings > Learning card for
 * the matching exercise.
 *
 * Pins: the "Corrections as a separate view" checkbox reflects its default
 * (on), writes the shared ``matchingReviewViewsPref`` source, follows a
 * change made elsewhere, and the resolve-effect select keeps working.
 */

import "@testing-library/jest-dom/vitest";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import MatchingResolveControl from "./MatchingResolveControl";
import {
    readMatchingSeparateCorrections,
    writeMatchingSeparateCorrections,
} from "../../../../lib/learning/matchingReviewViewsPref";
import {readMatchingResolveEffect} from "../../../../lib/learning/matchingResolvePref";

afterEach(() => {
    localStorage.clear();
});

function checkbox(): HTMLInputElement {
    return screen.getByTestId(
        "settings-matching-separate-corrections",
    ) as HTMLInputElement;
}

describe("MatchingResolveControl: separate corrections (#3186)", () => {
    it("is checked by default (three post-check views)", () => {
        render(<MatchingResolveControl />);
        expect(checkbox()).toHaveAttribute("type", "checkbox");
        expect(checkbox().checked).toBe(true);
    });

    it("writes the shared pref when unchecked and checked again", () => {
        render(<MatchingResolveControl />);
        act(() => {
            fireEvent.click(checkbox());
        });
        expect(checkbox().checked).toBe(false);
        expect(readMatchingSeparateCorrections()).toBe(false);
        act(() => {
            fireEvent.click(checkbox());
        });
        expect(readMatchingSeparateCorrections()).toBe(true);
    });

    it("reflects a stored off value and follows a change made elsewhere", () => {
        writeMatchingSeparateCorrections(false);
        render(<MatchingResolveControl />);
        expect(checkbox().checked).toBe(false);
        act(() => writeMatchingSeparateCorrections(true));
        expect(checkbox().checked).toBe(true);
    });

    it("has an accessible label wrapping the checkbox", () => {
        render(<MatchingResolveControl />);
        expect(checkbox().closest("label")).toHaveTextContent(
            /Corrections as a separate view/i,
        );
    });

    it("still writes the resolve effect from the select", () => {
        render(<MatchingResolveControl />);
        act(() => {
            fireEvent.change(
                screen.getByTestId("settings-matching-resolve-effect"),
                {target: {value: "connect"}},
            );
        });
        expect(readMatchingResolveEffect()).toBe("connect");
    });
});
