/**
 * Tests for PlayfulTensionBlock (#2878, split out by #2959): both
 * switches default OFF with disabled number inputs, the persisted +
 * clamped round-trips, and the block-wide ``disabled`` prop (the master
 * switch off) locking every control regardless of its own state.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it} from "vitest";

import PlayfulTensionBlock from "./PlayfulTensionBlock";
import {
    readPlayfulCountdown,
    readPlayfulCountdownSeconds,
    readPlayfulHearts,
    readPlayfulHeartsCount,
    setPlayfulCountdown,
    setPlayfulHearts,
} from "@/lib/learning/playful/playfulTensionPref";

const CONTROLS = [
    "settings-playful-hearts-toggle",
    "settings-playful-hearts-count",
    "settings-playful-countdown-toggle",
    "settings-playful-countdown-seconds",
];

beforeEach(() => {
    localStorage.clear();
});

describe("PlayfulTensionBlock (#2878)", () => {
    it("renders the cluster heading and both switches off with disabled number inputs", () => {
        render(<PlayfulTensionBlock disabled={false} />);
        expect(
            screen.getByTestId("settings-playful-block-tension"),
        ).toBeInTheDocument();
        expect(screen.getByRole("heading", {level: 3})).toHaveTextContent(
            "Tension",
        );
        expect(
            screen.getByTestId("settings-playful-hearts-toggle"),
        ).not.toBeChecked();
        expect(
            screen.getByTestId("settings-playful-countdown-toggle"),
        ).not.toBeChecked();
        expect(screen.getByTestId("settings-playful-hearts-count")).toBeDisabled();
        expect(
            screen.getByTestId("settings-playful-countdown-seconds"),
        ).toBeDisabled();
    });

    it("toggling hearts persists and enables the count input", () => {
        render(<PlayfulTensionBlock disabled={false} />);
        fireEvent.click(screen.getByTestId("settings-playful-hearts-toggle"));
        expect(readPlayfulHearts()).toBe(true);
        expect(
            screen.getByTestId("settings-playful-hearts-count"),
        ).not.toBeDisabled();
        fireEvent.change(screen.getByTestId("settings-playful-hearts-count"), {
            target: {value: "99"},
        });
        expect(readPlayfulHeartsCount()).toBe(5);
    });

    it("toggling the countdown persists and clamps the seconds", () => {
        render(<PlayfulTensionBlock disabled={false} />);
        fireEvent.click(
            screen.getByTestId("settings-playful-countdown-toggle"),
        );
        expect(readPlayfulCountdown()).toBe(true);
        fireEvent.change(
            screen.getByTestId("settings-playful-countdown-seconds"),
            {target: {value: "2"}},
        );
        expect(readPlayfulCountdownSeconds()).toBe(5);
    });

    it("disabled locks every control even when the switches are on (#2959)", () => {
        setPlayfulHearts(true);
        setPlayfulCountdown(true);
        render(<PlayfulTensionBlock disabled />);
        CONTROLS.forEach((testid) =>
            expect(screen.getByTestId(testid)).toBeDisabled(),
        );
        expect(
            screen.getByTestId("settings-playful-hearts-toggle"),
        ).toBeChecked();
    });
});
