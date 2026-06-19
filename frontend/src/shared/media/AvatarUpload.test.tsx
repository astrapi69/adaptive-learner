import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import AvatarUpload from "./AvatarUpload";
import * as cropImage from "../../lib/avatar/crop-image";

function renderUpload(value: string | null, over: Partial<React.ComponentProps<typeof AvatarUpload>> = {}) {
    const onChange = vi.fn();
    const onError = vi.fn();
    render(
        <AvatarUpload
            name="Jane Doe"
            value={value}
            uploadLabel="Upload picture"
            removeLabel="Remove"
            onChange={onChange}
            onError={onError}
            testId="up"
            {...over}
        />,
    );
    return {onChange, onError};
}

function selectFile(type = "image/png") {
    const file = new File(["x"], "a.png", {type});
    fireEvent.change(screen.getByTestId("avatar-file-input"), {target: {files: [file]}});
    return file;
}

describe("AvatarUpload", () => {
    beforeEach(() => {
        vi.spyOn(cropImage, "loadImageFromBlob").mockResolvedValue({
            naturalWidth: 400,
            naturalHeight: 300,
            src: "blob:fake",
        } as unknown as HTMLImageElement);
    });
    afterEach(() => vi.restoreAllMocks());

    it("shows the initials fallback and no remove button without a value", () => {
        renderUpload(null);
        expect(screen.getByTestId("avatar-preview-initials")).toHaveTextContent("JD");
        expect(screen.queryByTestId("avatar-remove-button")).not.toBeInTheDocument();
    });

    it("shows the image preview and a remove button with a value", () => {
        renderUpload("data:image/jpeg;base64,AAAA");
        expect(screen.getByTestId("avatar-preview-image")).toHaveAttribute(
            "src",
            "data:image/jpeg;base64,AAAA",
        );
        expect(screen.getByTestId("avatar-remove-button")).toBeInTheDocument();
    });

    it("opens the crop dialog after a file is selected", async () => {
        renderUpload(null);
        expect(screen.queryByTestId("image-crop-dialog")).not.toBeInTheDocument();
        selectFile();
        await waitFor(() =>
            expect(screen.getByTestId("image-crop-dialog")).toBeInTheDocument(),
        );
    });

    it("confirming the crop reports the cropped data URL", async () => {
        vi.spyOn(cropImage, "cropToBlob").mockResolvedValue(
            new Blob(["jpeg"], {type: "image/jpeg"}),
        );
        vi.spyOn(cropImage, "blobToDataUrl").mockResolvedValue(
            "data:image/jpeg;base64,ZZ",
        );
        const {onChange} = renderUpload(null);
        selectFile();
        await screen.findByTestId("crop-confirm");
        fireEvent.click(screen.getByTestId("crop-confirm"));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("data:image/jpeg;base64,ZZ"));
        // Dialog closes after applying.
        expect(screen.queryByTestId("image-crop-dialog")).not.toBeInTheDocument();
    });

    it("cancelling the crop changes nothing and closes the dialog", async () => {
        const {onChange} = renderUpload(null);
        selectFile();
        await screen.findByTestId("crop-cancel");
        fireEvent.click(screen.getByTestId("crop-cancel"));
        await waitFor(() =>
            expect(screen.queryByTestId("image-crop-dialog")).not.toBeInTheDocument(),
        );
        expect(onChange).not.toHaveBeenCalled();
    });

    it("rejects an unsupported file type without opening the dialog", () => {
        const {onError} = renderUpload(null);
        selectFile("image/gif");
        expect(onError).toHaveBeenCalledWith("avatar.error.unsupported_type");
        expect(screen.queryByTestId("image-crop-dialog")).not.toBeInTheDocument();
    });

    it("reports too_large when the cropped blob exceeds the cap", async () => {
        vi.spyOn(cropImage, "cropToBlob").mockResolvedValue(
            new Blob(["jpeg"], {type: "image/jpeg"}),
        );
        // A data URL whose payload exceeds AVATAR_MAX_BYTES (100 KiB).
        const huge = "data:image/jpeg;base64," + "A".repeat(200 * 1024);
        vi.spyOn(cropImage, "blobToDataUrl").mockResolvedValue(huge);
        const {onChange, onError} = renderUpload(null);
        selectFile();
        await screen.findByTestId("crop-confirm");
        fireEvent.click(screen.getByTestId("crop-confirm"));
        await waitFor(() => expect(onError).toHaveBeenCalledWith("avatar.error.too_large"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("removes the picture via onChange(null)", () => {
        const {onChange} = renderUpload("data:image/jpeg;base64,AAAA");
        fireEvent.click(screen.getByTestId("avatar-remove-button"));
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it("clicking the avatar with a picture opens the preview dialog (#638)", () => {
        renderUpload("data:image/jpeg;base64,AAAA");
        expect(screen.queryByTestId("avatar-preview-dialog")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("avatar-trigger"));
        expect(screen.getByTestId("avatar-preview-dialog")).toBeInTheDocument();
        expect(screen.getByTestId("avatar-preview-large")).toHaveAttribute(
            "src",
            "data:image/jpeg;base64,AAAA",
        );
    });

    it("clicking the avatar without a picture opens the file picker directly (#638)", () => {
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
        renderUpload(null);
        fireEvent.click(screen.getByTestId("avatar-trigger"));
        expect(screen.queryByTestId("avatar-preview-dialog")).not.toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("Change in the preview opens the file picker and closes the preview (#638)", () => {
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
        renderUpload("data:image/jpeg;base64,AAAA");
        fireEvent.click(screen.getByTestId("avatar-trigger"));
        fireEvent.click(screen.getByTestId("avatar-preview-change"));
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("avatar-preview-dialog")).not.toBeInTheDocument();
    });

    it("Escape closes the preview dialog (#638)", () => {
        renderUpload("data:image/jpeg;base64,AAAA");
        fireEvent.click(screen.getByTestId("avatar-trigger"));
        expect(screen.getByTestId("avatar-preview-dialog")).toBeInTheDocument();
        fireEvent.keyDown(window, {key: "Escape"});
        expect(screen.queryByTestId("avatar-preview-dialog")).not.toBeInTheDocument();
    });
});
