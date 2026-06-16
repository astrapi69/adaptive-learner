import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import AvatarPreviewDialog from "./AvatarPreviewDialog";

function renderDialog(over: Partial<React.ComponentProps<typeof AvatarPreviewDialog>> = {}) {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
        <AvatarPreviewDialog
            imageUrl="data:image/jpeg;base64,AAAA"
            onChange={onChange}
            onClose={onClose}
            {...over}
        />,
    );
    return {onChange, onClose};
}

describe("AvatarPreviewDialog", () => {
    afterEach(() => vi.restoreAllMocks());

    it("shows the image large", () => {
        renderDialog();
        expect(screen.getByTestId("avatar-preview-large")).toHaveAttribute(
            "src",
            "data:image/jpeg;base64,AAAA",
        );
    });

    it("renders the change and close actions", () => {
        renderDialog({changeLabel: "Change picture", closeLabel: "Close"});
        expect(screen.getByTestId("avatar-preview-change")).toHaveTextContent("Change picture");
        expect(screen.getByTestId("avatar-preview-close")).toHaveTextContent("Close");
    });

    it("calls onChange when Change is clicked", () => {
        const {onChange} = renderDialog();
        fireEvent.click(screen.getByTestId("avatar-preview-change"));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Close is clicked", () => {
        const {onClose} = renderDialog();
        fireEvent.click(screen.getByTestId("avatar-preview-close"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on Escape", () => {
        const {onClose} = renderDialog();
        fireEvent.keyDown(window, {key: "Escape"});
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on a backdrop click but not on a dialog-body click", () => {
        const {onClose} = renderDialog();
        // Click on the dialog body (the title) must NOT close.
        fireEvent.pointerDown(screen.getByTestId("avatar-preview-dialog-title"));
        expect(onClose).not.toHaveBeenCalled();
        // Click on the backdrop itself closes.
        fireEvent.pointerDown(screen.getByTestId("avatar-preview-dialog"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("falls back to English labels", () => {
        renderDialog();
        expect(screen.getByTestId("avatar-preview-change")).toHaveTextContent("Change picture");
        expect(screen.getByTestId("avatar-preview-close")).toHaveTextContent("Close");
        expect(screen.getByTestId("avatar-preview-dialog-title")).toHaveTextContent(
            "Profile picture",
        );
    });
});
