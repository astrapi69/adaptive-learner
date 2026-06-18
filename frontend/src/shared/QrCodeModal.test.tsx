/**
 * Tests for QrCodeModal (#774).
 *
 * Mocks the ``qrcode`` library so no canvas runs in happy-dom. Pins: the
 * QR image + copyable URL + download link render, copy writes the URL to
 * the clipboard and reports via ``onCopied``, and backdrop / X / Escape
 * all close. The native Share button is absent when ``navigator.share``
 * is unavailable (the happy-dom default), so Download stays the fallback.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toDataURLMock = vi.fn(
    (..._args: unknown[]) => Promise.resolve("data:image/png;base64,QQ=="),
);
vi.mock("qrcode", () => ({
    default: { toDataURL: (...args: unknown[]) => toDataURLMock(...args) },
}));

import QrCodeModal from "./QrCodeModal";

const URL_UNDER_TEST = "https://astrapi69.github.io/adaptive-learner/";

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
    });
});

function renderModal(onClose = vi.fn(), onCopied = vi.fn()) {
    render(
        <QrCodeModal
            url={URL_UNDER_TEST}
            title="Share via QR code"
            onClose={onClose}
            onCopied={onCopied}
        />,
    );
    return { onClose, onCopied };
}

describe("QrCodeModal", () => {
    it("renders the QR image, the copyable URL, and a download link", async () => {
        renderModal();
        expect(screen.getByText("Share via QR code")).toBeInTheDocument();
        expect(screen.getByTestId("qr-code-modal-url")).toHaveTextContent(
            URL_UNDER_TEST,
        );
        const img = await screen.findByTestId("qr-code-modal-image");
        expect(img).toHaveAttribute("src", "data:image/png;base64,QQ==");
        // The download anchor exposes the generated PNG with a filename.
        const dl = screen.getByTestId("qr-code-modal-download");
        expect(dl).toHaveAttribute("href", "data:image/png;base64,QQ==");
        expect(dl).toHaveAttribute("download", "adaptive-learner-qr.png");
        // It encodes exactly the supplied URL at error-correction level H.
        expect(toDataURLMock).toHaveBeenCalledWith(
            URL_UNDER_TEST,
            expect.objectContaining({ errorCorrectionLevel: "H" }),
        );
    });

    it("copies the URL and reports via onCopied", async () => {
        const { onCopied } = renderModal();
        fireEvent.click(screen.getByTestId("qr-code-modal-copy"));
        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                URL_UNDER_TEST,
            ),
        );
        expect(onCopied).toHaveBeenCalled();
    });

    it("closes on backdrop click, the X button, and Escape", async () => {
        const onClose = vi.fn();
        renderModal(onClose);
        fireEvent.click(screen.getByTestId("qr-code-modal"));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("qr-code-modal-close"));
        expect(onClose).toHaveBeenCalledTimes(2);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it("does not close when the card itself is clicked", () => {
        const onClose = vi.fn();
        renderModal(onClose);
        fireEvent.click(screen.getByTestId("qr-code-modal-url"));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("hides the native share button when navigator.share is absent", async () => {
        renderModal();
        await screen.findByTestId("qr-code-modal-image");
        expect(screen.queryByTestId("qr-code-modal-share")).toBeNull();
    });

    it("uses injected labels over the English defaults", async () => {
        render(
            <QrCodeModal
                url={URL_UNDER_TEST}
                title="QR"
                onClose={vi.fn()}
                labels={{ copy: "Kopieren", download: "Herunterladen" }}
            />,
        );
        await screen.findByTestId("qr-code-modal-image");
        expect(screen.getByTestId("qr-code-modal-copy")).toHaveTextContent(
            "Kopieren",
        );
        expect(screen.getByTestId("qr-code-modal-download")).toHaveTextContent(
            "Herunterladen",
        );
    });
});
