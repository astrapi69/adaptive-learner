/**
 * Tests for QRScannerModal (Phase 20D).
 *
 * Pins the modal-level behaviour that isn't covered by the
 * bare QRScanner.test.tsx: success panel animation class,
 * haptic feedback on successful scan, Escape-to-close,
 * click-on-backdrop close, body-scroll lock.
 *
 * The inner QRScanner is stubbed so the suite doesn't drag
 * html5-qrcode into happy-dom. The stub exposes ``__lastProps``
 * so individual tests can simulate a scan / error / invalid-QR
 * without touching the real library.
 */

import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import QRScannerModal from "./QRScannerModal";

interface ScannerProps {
    onSuccess: (payload: {host: string; port: number; token: string}, raw: string) => void;
    onError: (err: {code: string; message: string}) => void;
    onInvalidQr?: (rawText: string) => void;
}

const scannerProps: {current: ScannerProps | null} = {current: null};

vi.mock("./QRScanner", () => ({
    default: (props: ScannerProps) => {
        scannerProps.current = props;
        return <div data-testid="qr-scanner-stub" />;
    },
}));

vi.mock("./QRImageUpload", () => ({
    default: () => <div data-testid="qr-image-upload-stub" />,
}));

beforeEach(() => {
    scannerProps.current = null;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("QRScannerModal", () => {
    it("does not render when open=false", () => {
        render(
            <QRScannerModal
                open={false}
                onScan={() => {}}
                onClose={() => {}}
            />,
        );
        expect(screen.queryByTestId("qr-scanner-modal")).toBeNull();
    });

    it("renders the scanner + instructions when open", () => {
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={() => {}}
            />,
        );
        expect(screen.getByTestId("qr-scanner-modal")).toBeTruthy();
        expect(screen.getByTestId("qr-scanner-stub")).toBeTruthy();
        expect(screen.getByTestId("qr-scanner-instruction")).toBeTruthy();
    });

    it("Escape key closes the modal", () => {
        const onClose = vi.fn();
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={onClose}
            />,
        );
        fireEvent.keyDown(window, {key: "Escape"});
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("clicking the dimmed backdrop closes the modal", () => {
        const onClose = vi.fn();
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={onClose}
            />,
        );
        const backdrop = screen.getByTestId("qr-scanner-modal");
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("clicking inside the panel does NOT close the modal", () => {
        const onClose = vi.fn();
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={onClose}
            />,
        );
        // Clicking the scanner stub bubbles to the panel, not the
        // backdrop. Without the e.target === e.currentTarget guard
        // this would close on every interaction.
        fireEvent.click(screen.getByTestId("qr-scanner-stub"));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("body-scroll is locked while the modal is open and restored on unmount", () => {
        const previous = document.body.style.overflow;
        const {unmount} = render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={() => {}}
            />,
        );
        expect(document.body.style.overflow).toBe("hidden");
        unmount();
        expect(document.body.style.overflow).toBe(previous);
    });

    it("successful scan shows the success panel with the animated checkmark class", async () => {
        const onScan = vi.fn();
        render(
            <QRScannerModal
                open={true}
                onScan={onScan}
                onClose={() => {}}
            />,
        );
        await waitFor(() => expect(scannerProps.current).not.toBeNull());
        act(() => {
            scannerProps.current!.onSuccess(
                {host: "h", port: 1, token: "t"},
                "adaptive-learner://sync?host=h&port=1&token=t",
            );
        });
        expect(screen.getByTestId("qr-scanner-success")).toBeTruthy();
        // The checkmark carries the animation class; reduced-
        // motion users get the no-anim variant from global.css.
        const cm = screen.getByTestId("qr-success-checkmark");
        expect(cm.className).toContain("qr-success-checkmark");
        expect(onScan).toHaveBeenCalledWith(
            "adaptive-learner://sync?host=h&port=1&token=t",
        );
    });

    it("successful scan triggers haptic feedback when navigator.vibrate is available", async () => {
        const vibrateMock = vi.fn(() => true);
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateMock,
            configurable: true,
        });
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={() => {}}
            />,
        );
        await waitFor(() => expect(scannerProps.current).not.toBeNull());
        act(() => {
            scannerProps.current!.onSuccess(
                {host: "h", port: 1, token: "t"},
                "adaptive-learner://sync?host=h&port=1&token=t",
            );
        });
        expect(vibrateMock).toHaveBeenCalledWith(50);
    });

    it("non-pairing QR shows the inline 'invalid' hint and keeps the scanner mounted", async () => {
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={() => {}}
            />,
        );
        await waitFor(() => expect(scannerProps.current).not.toBeNull());
        act(() => {
            scannerProps.current!.onInvalidQr?.("https://random.example");
        });
        expect(screen.getByTestId("qr-scanner-invalid-hint")).toBeTruthy();
        // Scanner still mounted — the user can re-aim.
        expect(screen.getByTestId("qr-scanner-stub")).toBeTruthy();
    });

    it("camera permission denied surfaces the error panel with retry + upload fallback", async () => {
        render(
            <QRScannerModal
                open={true}
                onScan={() => {}}
                onClose={() => {}}
            />,
        );
        await waitFor(() => expect(scannerProps.current).not.toBeNull());
        act(() => {
            scannerProps.current!.onError({
                code: "permission-denied",
                message: "NotAllowedError",
            });
        });
        expect(screen.getByTestId("qr-scanner-error")).toBeTruthy();
        expect(screen.getByTestId("qr-scanner-retry")).toBeTruthy();
        // Upload fallback is reachable from the error panel too.
        expect(screen.getByTestId("qr-image-upload-stub")).toBeTruthy();
    });
});
