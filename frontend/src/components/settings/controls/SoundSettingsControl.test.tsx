/**
 * Tests for SoundSettingsControl (EXP-008 / Phase 55F).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import SoundSettingsControl from "./SoundSettingsControl";
import {readSoundEnabled, readSoundVolume} from "../../../lib/feedback/feedbackPref";

const playSound = vi.fn();
vi.mock("../../../lib/audio/sound-effects", () => ({
    playSound: (name: string) => playSound(name),
}));

beforeEach(() => {
    localStorage.clear();
    playSound.mockClear();
});

describe("SoundSettingsControl", () => {
    it("is off by default and hides the volume row", () => {
        render(<SoundSettingsControl />);
        expect(screen.getByTestId("settings-sounds-toggle")).not.toBeChecked();
        expect(
            screen.queryByTestId("settings-sounds-volume-row"),
        ).not.toBeInTheDocument();
    });

    it("turning sound on persists it and reveals the volume + test controls", () => {
        render(<SoundSettingsControl />);
        fireEvent.click(screen.getByTestId("settings-sounds-toggle"));
        expect(readSoundEnabled()).toBe(true);
        expect(
            screen.getByTestId("settings-sounds-volume-row"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-sounds-test"),
        ).toBeInTheDocument();
    });

    it("changing the volume persists it and updates the label", () => {
        render(<SoundSettingsControl />);
        fireEvent.click(screen.getByTestId("settings-sounds-toggle"));
        fireEvent.change(screen.getByTestId("settings-sounds-volume"), {
            target: {value: "30"},
        });
        expect(readSoundVolume()).toBe(30);
        expect(
            screen.getByTestId("settings-sounds-volume-value"),
        ).toHaveTextContent("30%");
    });

    it("the test button previews the star-earned chime", () => {
        render(<SoundSettingsControl />);
        fireEvent.click(screen.getByTestId("settings-sounds-toggle"));
        fireEvent.click(screen.getByTestId("settings-sounds-test"));
        expect(playSound).toHaveBeenCalledWith("star_earned");
    });
});
