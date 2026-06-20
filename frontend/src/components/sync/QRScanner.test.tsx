/**
 * Tests for the QRScanner component (Phase 20A).
 *
 * Mocks the ``html5-qrcode`` ``Html5Qrcode`` class with a
 * controllable fake so we can verify:
 *   - start() is called on mount with the rear camera.
 *   - stop() is called on unmount (no zombie camera).
 *   - The scan callback fires onSuccess for valid pairing URIs
 *     and onInvalidQr for everything else.
 *   - Permission-denied / no-camera errors land on onError with
 *     the right ``code`` so the parent can render an actionable
 *     hint.
 */

import {render, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import QRScanner from "./QRScanner";
import {buildPairingUri} from "../../storage/sync/sync-engine";

interface FakeInstance {
    instances: FakeInstance[];
    startCalls: number;
    stopCalls: number;
    lastCameraConfig: unknown;
    lastScanConfig: unknown;
    scanCallback:
        | ((decoded: string, raw: {decodedText: string}) => void)
        | null;
    triggerScan: (text: string) => void;
    startReject?: Error;
}

const fakeState: {
    instances: FakeInstance[];
    nextStartError?: Error;
} = {instances: []};

vi.mock("html5-qrcode", () => {
    class Html5Qrcode {
        private inst: FakeInstance;

        constructor(_elementId: string, _verbose: boolean) {
            this.inst = {
                instances: fakeState.instances,
                startCalls: 0,
                stopCalls: 0,
                lastCameraConfig: null,
                lastScanConfig: null,
                scanCallback: null,
                triggerScan(text: string) {
                    this.scanCallback?.(text, {decodedText: text});
                },
            };
            fakeState.instances.push(this.inst);
        }

        async start(
            cameraConfig: unknown,
            scanConfig: unknown,
            onScan: (decoded: string, raw: {decodedText: string}) => void,
        ): Promise<void> {
            this.inst.startCalls += 1;
            this.inst.lastCameraConfig = cameraConfig;
            this.inst.lastScanConfig = scanConfig;
            this.inst.scanCallback = onScan;
            if (fakeState.nextStartError) {
                const err = fakeState.nextStartError;
                fakeState.nextStartError = undefined;
                throw err;
            }
        }

        async stop(): Promise<void> {
            this.inst.stopCalls += 1;
            this.inst.scanCallback = null;
        }
    }
    return {Html5Qrcode};
});

beforeEach(() => {
    fakeState.instances = [];
    fakeState.nextStartError = undefined;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("QRScanner", () => {
    it("starts the rear camera on mount and stops it on unmount", async () => {
        const {unmount} = render(
            <QRScanner
                onSuccess={() => {}}
                onError={() => {}}
            />,
        );
        await waitFor(() => {
            expect(fakeState.instances).toHaveLength(1);
            expect(fakeState.instances[0].startCalls).toBe(1);
        });
        // ``facingMode: "environment"`` -> rear camera on phones.
        expect(fakeState.instances[0].lastCameraConfig).toEqual({
            facingMode: "environment",
        });
        unmount();
        await waitFor(() => {
            expect(fakeState.instances[0].stopCalls).toBe(1);
        });
    });

    it("fires onSuccess with the parsed payload when a valid pairing QR scans", async () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        render(
            <QRScanner onSuccess={onSuccess} onError={onError} />,
        );
        await waitFor(() => {
            expect(fakeState.instances[0].scanCallback).not.toBeNull();
        });
        const uri = buildPairingUri({
            host: "192.168.1.42",
            port: 18001,
            token: "abcdef123",
        });
        fakeState.instances[0].triggerScan(uri);
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledTimes(1);
        });
        const [payload, rawText] = onSuccess.mock.calls[0];
        expect(payload).toEqual({
            host: "192.168.1.42",
            port: 18001,
            token: "abcdef123",
        });
        expect(rawText).toBe(uri);
        expect(onError).not.toHaveBeenCalled();
        // Scanner stops itself after a successful scan — no
        // zombie camera even if the parent forgets to unmount.
        await waitFor(() => {
            expect(fakeState.instances[0].stopCalls).toBe(1);
        });
    });

    it("calls onInvalidQr (not onSuccess) for non-pairing QR content", async () => {
        const onSuccess = vi.fn();
        const onInvalidQr = vi.fn();
        render(
            <QRScanner
                onSuccess={onSuccess}
                onError={() => {}}
                onInvalidQr={onInvalidQr}
            />,
        );
        await waitFor(() => {
            expect(fakeState.instances[0].scanCallback).not.toBeNull();
        });
        fakeState.instances[0].triggerScan("https://random-url.example.com");
        await waitFor(() => {
            expect(onInvalidQr).toHaveBeenCalledWith(
                "https://random-url.example.com",
            );
        });
        expect(onSuccess).not.toHaveBeenCalled();
        // We keep scanning (no stop) so the user can re-aim.
        expect(fakeState.instances[0].stopCalls).toBe(0);
    });

    it("only fires onSuccess once even if the library reports multiple matches", async () => {
        const onSuccess = vi.fn();
        render(<QRScanner onSuccess={onSuccess} onError={() => {}} />);
        await waitFor(() => {
            expect(fakeState.instances[0].scanCallback).not.toBeNull();
        });
        const uri = buildPairingUri({
            host: "h",
            port: 1234,
            token: "t",
        });
        fakeState.instances[0].triggerScan(uri);
        fakeState.instances[0].triggerScan(uri);
        fakeState.instances[0].triggerScan(uri);
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledTimes(1);
        });
    });

    it("classifies permission-denied start error", async () => {
        fakeState.nextStartError = new Error(
            "NotAllowedError: Permission denied",
        );
        const onError = vi.fn();
        render(<QRScanner onSuccess={() => {}} onError={onError} />);
        await waitFor(() => {
            expect(onError).toHaveBeenCalledTimes(1);
        });
        expect(onError.mock.calls[0][0].code).toBe("permission-denied");
    });

    it("classifies no-camera start error", async () => {
        fakeState.nextStartError = new Error("NotFoundError: no camera");
        const onError = vi.fn();
        render(<QRScanner onSuccess={() => {}} onError={onError} />);
        await waitFor(() => {
            expect(onError).toHaveBeenCalledTimes(1);
        });
        expect(onError.mock.calls[0][0].code).toBe("no-camera");
    });

    it("classifies unrecognized start error as init-failed", async () => {
        fakeState.nextStartError = new Error("something else entirely");
        const onError = vi.fn();
        render(<QRScanner onSuccess={() => {}} onError={onError} />);
        await waitFor(() => {
            expect(onError).toHaveBeenCalledTimes(1);
        });
        expect(onError.mock.calls[0][0].code).toBe("init-failed");
    });

    // --- v1.7.0 / Phase 20D — viewfinder overlay -------------------

    it("renders the viewfinder overlay once the scanner reaches the 'scanning' state", async () => {
        const {getByTestId, queryByTestId} = render(
            <QRScanner onSuccess={() => {}} onError={() => {}} />,
        );
        // Pre-start: no viewfinder while the start() promise is
        // still pending (status is "starting").
        expect(queryByTestId("qr-viewfinder")).toBeNull();
        // Wait until the mock's start() resolves and React commits
        // the "scanning" status.
        await waitFor(() => {
            expect(getByTestId("qr-scanner").dataset.status).toBe("scanning");
        });
        const viewfinder = getByTestId("qr-viewfinder");
        expect(viewfinder).toBeTruthy();
        // Four corner brackets sit inside the cutout.
        expect(viewfinder.querySelectorAll(".qr-viewfinder-corner")).toHaveLength(4);
        // The animated scan-line is present (animation gets
        // disabled by the global.css prefers-reduced-motion rule;
        // not testable here without a CSS engine).
        expect(viewfinder.querySelector(".qr-viewfinder-scanline")).toBeTruthy();
    });

    it("removes the viewfinder once a successful scan settles the scanner", async () => {
        const onSuccess = vi.fn();
        const {getByTestId, queryByTestId} = render(
            <QRScanner onSuccess={onSuccess} onError={() => {}} />,
        );
        await waitFor(() => {
            expect(getByTestId("qr-scanner").dataset.status).toBe("scanning");
        });
        const uri = buildPairingUri({
            host: "192.168.1.42",
            port: 18001,
            token: "abc",
        });
        fakeState.instances[0].triggerScan(uri);
        await waitFor(() => {
            expect(getByTestId("qr-scanner").dataset.status).toBe("settled");
        });
        // The settled state hides the viewfinder so the success
        // panel above doesn't compete with the moving scan-line.
        expect(queryByTestId("qr-viewfinder")).toBeNull();
    });
});
