/**
 * Tests for PresetAvatarGallery (#2848): renders all presets,
 * reports the selection as a data URL, marks the active preset,
 * and respects the disabled state.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import PresetAvatarGallery from "./PresetAvatarGallery";
import {
    PRESET_AVATARS,
    presetAvatarDataUrl,
} from "../../lib/avatar/preset-avatars";

describe("PresetAvatarGallery", () => {
    it("renders one option per preset", () => {
        render(<PresetAvatarGallery value={null} onSelect={vi.fn()} />);
        expect(screen.getByTestId("settings-avatar-presets")).toBeInTheDocument();
        for (const p of PRESET_AVATARS) {
            expect(
                screen.getByTestId(`settings-avatar-preset-${p.id}`),
            ).toBeInTheDocument();
        }
    });

    it("clicking a preset reports its data URL", () => {
        const onSelect = vi.fn();
        render(<PresetAvatarGallery value={null} onSelect={onSelect} />);
        const first = PRESET_AVATARS[0];
        fireEvent.click(screen.getByTestId(`settings-avatar-preset-${first.id}`));
        expect(onSelect).toHaveBeenCalledWith(presetAvatarDataUrl(first.id));
    });

    it("marks the preset matching the current avatar value as pressed", () => {
        const active = PRESET_AVATARS[2];
        render(
            <PresetAvatarGallery
                value={presetAvatarDataUrl(active.id)}
                onSelect={vi.fn()}
            />,
        );
        expect(
            screen.getByTestId(`settings-avatar-preset-${active.id}`),
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            screen.getByTestId(`settings-avatar-preset-${PRESET_AVATARS[0].id}`),
        ).toHaveAttribute("aria-pressed", "false");
    });

    it("an uploaded (non-preset) avatar leaves every option unpressed", () => {
        render(
            <PresetAvatarGallery
                value="data:image/png;base64,QUJD"
                onSelect={vi.fn()}
            />,
        );
        for (const p of PRESET_AVATARS) {
            expect(
                screen.getByTestId(`settings-avatar-preset-${p.id}`),
            ).toHaveAttribute("aria-pressed", "false");
        }
    });

    it("disabled blocks selection", () => {
        const onSelect = vi.fn();
        render(
            <PresetAvatarGallery value={null} onSelect={onSelect} disabled />,
        );
        fireEvent.click(
            screen.getByTestId(`settings-avatar-preset-${PRESET_AVATARS[0].id}`),
        );
        expect(onSelect).not.toHaveBeenCalled();
    });
});
