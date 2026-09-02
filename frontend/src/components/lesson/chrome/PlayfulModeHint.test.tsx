/**
 * Tests for the playful-mode lesson-start hint (#2844): visibility
 * gating (mode on / dismissed), the in-place activation path, and
 * the permanent dismissal.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import PlayfulModeHint from "./PlayfulModeHint";
import {
    dismissPlayfulHint,
    readPlayfulHintDismissed,
    readPlayfulMode,
    setPlayfulMode,
} from "../../../lib/learning/playfulModePref";

const notifySuccess = vi.fn();
vi.mock("../../../utils/notify", () => ({
    notify: {
        success: (msg: string) => notifySuccess(msg),
        error: vi.fn(),
    },
}));

beforeEach(() => {
    localStorage.clear();
    notifySuccess.mockClear();
});

describe("PlayfulModeHint", () => {
    it("shows while playful mode is off and the hint is not dismissed", () => {
        render(<PlayfulModeHint />);
        expect(screen.getByTestId("lesson-playful-hint")).toBeInTheDocument();
    });

    it("renders nothing when playful mode is already on", () => {
        setPlayfulMode(true);
        render(<PlayfulModeHint />);
        expect(
            screen.queryByTestId("lesson-playful-hint"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing once dismissed", () => {
        dismissPlayfulHint();
        render(<PlayfulModeHint />);
        expect(
            screen.queryByTestId("lesson-playful-hint"),
        ).not.toBeInTheDocument();
    });

    it("'Turn on' enables the mode, hides the banner, and stops future hints", () => {
        render(<PlayfulModeHint />);
        fireEvent.click(screen.getByTestId("lesson-playful-hint-activate"));
        expect(readPlayfulMode()).toBe(true);
        expect(readPlayfulHintDismissed()).toBe(true);
        expect(
            screen.queryByTestId("lesson-playful-hint"),
        ).not.toBeInTheDocument();
        expect(notifySuccess).toHaveBeenCalledTimes(1);
    });

    it("the close control dismisses permanently without enabling the mode", () => {
        render(<PlayfulModeHint />);
        fireEvent.click(screen.getByTestId("lesson-playful-hint-dismiss"));
        expect(readPlayfulMode()).toBe(false);
        expect(readPlayfulHintDismissed()).toBe(true);
        expect(
            screen.queryByTestId("lesson-playful-hint"),
        ).not.toBeInTheDocument();
    });
});

describe("turn on with sound (#2875)", async () => {
    const {readPlayfulMode} = await import(
        "../../../lib/learning/playfulModePref"
    );
    const {readPlayfulSounds} = await import(
        "../../../lib/learning/playfulSoundsPref"
    );
    const {fireEvent} = await import("@testing-library/react");

    it("enables game mode AND its sounds in one click", () => {
        render(<PlayfulModeHint />);
        fireEvent.click(
            screen.getByTestId("lesson-playful-hint-activate-sound"),
        );
        expect(readPlayfulMode()).toBe(true);
        expect(readPlayfulSounds()).toBe(true);
        expect(
            screen.queryByTestId("lesson-playful-hint"),
        ).not.toBeInTheDocument();
    });

    it("the plain turn-on leaves sounds off", () => {
        render(<PlayfulModeHint />);
        fireEvent.click(screen.getByTestId("lesson-playful-hint-activate"));
        expect(readPlayfulMode()).toBe(true);
        expect(readPlayfulSounds()).toBe(false);
    });
});
