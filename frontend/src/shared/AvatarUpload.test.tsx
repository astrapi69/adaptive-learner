import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import AvatarUpload from "./AvatarUpload";
import * as resize from "../lib/avatar/resize-image";

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

describe("AvatarUpload", () => {
    beforeEach(() => vi.restoreAllMocks());

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

    it("processes a selected file and reports the data URL", async () => {
        vi.spyOn(resize, "processAvatarFile").mockResolvedValue("data:image/jpeg;base64,ZZ");
        const {onChange} = renderUpload(null);
        const file = new File(["x"], "a.png", {type: "image/png"});
        fireEvent.change(screen.getByTestId("avatar-file-input"), {target: {files: [file]}});
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("data:image/jpeg;base64,ZZ"));
    });

    it("reports the error key when processing fails", async () => {
        vi.spyOn(resize, "processAvatarFile").mockRejectedValue(
            new Error("avatar.error.too_large"),
        );
        const {onError} = renderUpload(null);
        const file = new File(["x"], "a.png", {type: "image/png"});
        fireEvent.change(screen.getByTestId("avatar-file-input"), {target: {files: [file]}});
        await waitFor(() => expect(onError).toHaveBeenCalledWith("avatar.error.too_large"));
    });

    it("removes the picture via onChange(null)", () => {
        const {onChange} = renderUpload("data:image/jpeg;base64,AAAA");
        fireEvent.click(screen.getByTestId("avatar-remove-button"));
        expect(onChange).toHaveBeenCalledWith(null);
    });
});
