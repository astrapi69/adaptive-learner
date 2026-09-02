/**
 * Tests for PresetAvatarPicker (#2862): the confirm guard fires only
 * over an uploaded photo, confirming stashes and saves, cancel is a
 * no-op, and the restore action returns the parked photo.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../../../storage/dexie/dexie-user-data", () => ({
    mirrorUserData: async (_key: string, _value: string | null) => undefined,
}));

import PresetAvatarPicker from "./PresetAvatarPicker";
import {
    readStashedAvatarPhoto,
    stashAvatarPhoto,
} from "../../../../lib/avatar/avatar-photo-stash";
import {presetAvatarDataUrl} from "../../../../lib/avatar/preset-avatars";

const PHOTO = "data:image/jpeg;base64,PHOTO";

beforeEach(() => {
    localStorage.clear();
});

describe("PresetAvatarPicker", () => {
    it("asks before replacing an uploaded photo and saves only on confirm", () => {
        const onSave = vi.fn();
        render(
            <PresetAvatarPicker userId="u1" avatar={PHOTO} onSave={onSave} />,
        );
        fireEvent.click(screen.getByTestId("settings-avatar-preset-spark"));
        expect(onSave).not.toHaveBeenCalled();
        expect(
            screen.getByTestId("settings-avatar-replace-dialog"),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByTestId("settings-avatar-replace-dialog-confirm"),
        );
        expect(onSave).toHaveBeenCalledWith(presetAvatarDataUrl("spark"));
        expect(readStashedAvatarPhoto("u1")).toBe(PHOTO);
    });

    it("cancel keeps the photo and stashes nothing", () => {
        const onSave = vi.fn();
        render(
            <PresetAvatarPicker userId="u1" avatar={PHOTO} onSave={onSave} />,
        );
        fireEvent.click(screen.getByTestId("settings-avatar-preset-spark"));
        fireEvent.click(
            screen.getByTestId("settings-avatar-replace-dialog-cancel"),
        );
        expect(onSave).not.toHaveBeenCalled();
        expect(readStashedAvatarPhoto("u1")).toBeNull();
        expect(
            screen.queryByTestId("settings-avatar-replace-dialog"),
        ).not.toBeInTheDocument();
    });

    it("switches figure to figure without asking", () => {
        const onSave = vi.fn();
        render(
            <PresetAvatarPicker
                userId="u1"
                avatar={presetAvatarDataUrl("cat")}
                onSave={onSave}
            />,
        );
        fireEvent.click(screen.getByTestId("settings-avatar-preset-spark"));
        expect(onSave).toHaveBeenCalledWith(presetAvatarDataUrl("spark"));
        expect(
            screen.queryByTestId("settings-avatar-replace-dialog"),
        ).not.toBeInTheDocument();
    });

    it("offers restore while a stash is parked and saves the photo back", () => {
        stashAvatarPhoto("u1", PHOTO);
        const onSave = vi.fn();
        render(
            <PresetAvatarPicker
                userId="u1"
                avatar={presetAvatarDataUrl("cat")}
                onSave={onSave}
            />,
        );
        fireEvent.click(
            screen.getByTestId("settings-avatar-restore-photo"),
        );
        expect(onSave).toHaveBeenCalledWith(PHOTO);
    });

    it("shows no restore action without a stash", () => {
        render(
            <PresetAvatarPicker
                userId="u1"
                avatar={presetAvatarDataUrl("cat")}
                onSave={vi.fn()}
            />,
        );
        expect(
            screen.queryByTestId("settings-avatar-restore-photo"),
        ).not.toBeInTheDocument();
    });
});
