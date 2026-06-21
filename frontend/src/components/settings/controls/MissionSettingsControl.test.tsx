/**
 * Tests for MissionSettingsControl (EXP-010 / Phase 56I).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import MissionSettingsControl from "./MissionSettingsControl";
import {readMissionPrefs} from "../../../lib/missionPref";

const regenerate = vi.fn();
vi.mock("../../../storage", () => ({
    getStorage: () => ({missions: {regenerate}}),
}));
vi.mock("../../../lib/learnerState", () => ({
    readLearnerState: () => ({userId: "u1"}),
}));

beforeEach(() => {
    localStorage.clear();
    regenerate.mockReset();
    regenerate.mockResolvedValue({missions: [], newlyCompleted: []});
});

describe("MissionSettingsControl", () => {
    it("is on by default and shows count + mix controls", () => {
        render(<MissionSettingsControl />);
        expect(screen.getByTestId("settings-missions-toggle")).toBeChecked();
        expect(
            screen.getByTestId("settings-missions-count"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-missions-mix"),
        ).toBeInTheDocument();
    });

    it("turning off hides the count/mix controls and persists", () => {
        render(<MissionSettingsControl />);
        fireEvent.click(screen.getByTestId("settings-missions-toggle"));
        expect(readMissionPrefs().enabled).toBe(false);
        expect(
            screen.queryByTestId("settings-missions-count"),
        ).not.toBeInTheDocument();
    });

    it("persists count + difficulty mix", () => {
        render(<MissionSettingsControl />);
        fireEvent.change(screen.getByTestId("settings-missions-count"), {
            target: {value: "2"},
        });
        fireEvent.change(screen.getByTestId("settings-missions-mix"), {
            target: {value: "challenging"},
        });
        const prefs = readMissionPrefs();
        expect(prefs.count).toBe(2);
        expect(prefs.difficultyMix).toBe("challenging");
    });

    it("reset is two-step and calls regenerate on confirm", () => {
        render(<MissionSettingsControl />);
        const btn = screen.getByTestId("settings-missions-reset");
        fireEvent.click(btn); // arms confirm
        expect(regenerate).not.toHaveBeenCalled();
        fireEvent.click(btn); // confirms
        expect(regenerate).toHaveBeenCalledWith(
            "u1",
            expect.objectContaining({count: 3, difficultyMix: "balanced"}),
        );
    });
});
