/**
 * Tests for QRImageUpload (Phase 20C).
 *
 * Mocks ``Html5Qrcode.scanFile`` so the suite never opens the
 * real codec. Verifies the four observable outcomes: idle ->
 * success (valid pairing URI), idle -> invalid (decoded but not
 * a pairing URI), idle -> decode-failed (no QR found), and the
 * input-reset behaviour that lets the user re-pick the same
 * file.
 */

import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import QRImageUpload from "./QRImageUpload";
import {buildPairingUri} from "../../storage/sync/sync-engine";

const scanFileMock = vi.fn();

vi.mock("html5-qrcode", () => {
    class Html5Qrcode {
        constructor(_id: string) {}
        async scanFile(file: File, _showImage: boolean): Promise<string> {
            return scanFileMock(file);
        }
    }
    return {Html5Qrcode};
});

beforeEach(() => {
    scanFileMock.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

function pickFile(input: HTMLInputElement, file: File) {
    Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
    });
    fireEvent.change(input);
}

describe("QRImageUpload", () => {
    it("fires onScan with the raw URI when the image decodes to a valid pairing URI", async () => {
        const uri = buildPairingUri({
            host: "192.168.1.42",
            port: 18001,
            token: "abc",
        });
        scanFileMock.mockResolvedValue(uri);

        const onScan = vi.fn();
        render(<QRImageUpload onScan={onScan} />);
        const input = screen.getByTestId(
            "qr-image-upload-input",
        ) as HTMLInputElement;
        pickFile(input, new File(["fake"], "qr.png", {type: "image/png"}));

        await waitFor(() => {
            expect(onScan).toHaveBeenCalledWith(uri);
        });
        // No error displayed on the happy path.
        expect(screen.queryByTestId("qr-image-upload-invalid")).toBeNull();
        expect(screen.queryByTestId("qr-image-upload-failed")).toBeNull();
    });

    it("shows 'Not a valid pairing code' when the image decodes to non-pairing content", async () => {
        scanFileMock.mockResolvedValue("https://random-url.example.com");
        const onScan = vi.fn();
        render(<QRImageUpload onScan={onScan} />);
        pickFile(
            screen.getByTestId("qr-image-upload-input") as HTMLInputElement,
            new File(["fake"], "qr.png", {type: "image/png"}),
        );
        await waitFor(() => {
            expect(screen.getByTestId("qr-image-upload-invalid")).toBeTruthy();
        });
        expect(onScan).not.toHaveBeenCalled();
    });

    it("shows the decode-failed message when no QR is found in the image", async () => {
        scanFileMock.mockRejectedValue(
            new Error("QR code parse error, error = NotFoundException"),
        );
        const onScan = vi.fn();
        render(<QRImageUpload onScan={onScan} />);
        pickFile(
            screen.getByTestId("qr-image-upload-input") as HTMLInputElement,
            new File(["fake"], "qr.png", {type: "image/png"}),
        );
        await waitFor(() => {
            expect(screen.getByTestId("qr-image-upload-failed")).toBeTruthy();
        });
        expect(onScan).not.toHaveBeenCalled();
    });

    it("resets the input after each pick so re-picking the same file fires again", async () => {
        const uri = buildPairingUri({host: "h", port: 1234, token: "t"});
        scanFileMock.mockResolvedValue(uri);
        const onScan = vi.fn();
        render(<QRImageUpload onScan={onScan} />);
        const input = screen.getByTestId(
            "qr-image-upload-input",
        ) as HTMLInputElement;
        const file = new File(["fake"], "qr.png", {type: "image/png"});
        pickFile(input, file);
        await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1));
        // After processing, the input value is reset to ""; the
        // user can pick the SAME file again and the change event
        // fires anew.
        expect(input.value).toBe("");
        pickFile(input, file);
        await waitFor(() => expect(onScan).toHaveBeenCalledTimes(2));
    });
});
