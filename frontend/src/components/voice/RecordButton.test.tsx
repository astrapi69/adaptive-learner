/**
 * RecordButton render tests (engine#68 idea 3: speak-and-record).
 *
 * Mirrors ``MicButton.test.tsx``'s mocking approach, adapted for
 * MediaRecorder/getUserMedia instead of SpeechRecognition.
 */

import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {I18nProvider} from "../../hooks/ui/useI18n";

const notifyError = vi.fn();
vi.mock("../../utils/notify", () => ({
    notify: {
        error: (...args: unknown[]) => notifyError(...args),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

import RecordButton from "./RecordButton";

interface MockRecorderInstance {
    ondataavailable: ((event: {data: {size: number}}) => void) | null;
    onstop: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
}

const instances: MockRecorderInstance[] = [];

function mountSupported(rejectName: string | null = null): void {
    instances.length = 0;
    class MockMediaRecorder {
        ondataavailable: ((event: {data: {size: number}}) => void) | null = null;
        onstop: (() => void) | null = null;
        start = vi.fn();
        stop = vi.fn(() => {
            this.ondataavailable?.({data: {size: 1}});
            this.onstop?.();
        });
        constructor() {
            instances.push(this as unknown as MockRecorderInstance);
        }
        static isTypeSupported(): boolean {
            return true;
        }
    }
    (window as unknown as {MediaRecorder: unknown}).MediaRecorder = MockMediaRecorder;
    const track = {stop: vi.fn()};
    (navigator as unknown as {mediaDevices: {getUserMedia: unknown}}).mediaDevices = {
        getUserMedia: vi.fn(() =>
            rejectName
                ? Promise.reject(Object.assign(new Error(rejectName), {name: rejectName}))
                : Promise.resolve({getTracks: () => [track]}),
        ),
    };
}

function unmount(): void {
    delete (window as unknown as Record<string, unknown>).MediaRecorder;
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
}

beforeEach(() => {
    unmount();
    notifyError.mockReset();
});

afterEach(() => {
    unmount();
});

describe("RecordButton visibility gate", () => {
    it("renders nothing when MediaRecorder/getUserMedia are unavailable", () => {
        const {container} = render(
            <I18nProvider>
                <RecordButton onRecorded={() => {}} />
            </I18nProvider>,
        );
        expect(container.querySelector('[data-testid="record-button"]')).toBeNull();
    });

    it("renders when supported", () => {
        mountSupported();
        render(
            <I18nProvider>
                <RecordButton onRecorded={() => {}} testId="t1" />
            </I18nProvider>,
        );
        expect(screen.getByTestId("record-button-t1")).toBeTruthy();
    });
});

describe("RecordButton click toggle", () => {
    it("first click requests the mic and flips data-recording", async () => {
        mountSupported();
        render(
            <I18nProvider>
                <RecordButton onRecorded={() => {}} testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("record-button-t1");
        expect(btn.getAttribute("data-recording")).toBe("false");
        await act(async () => {
            fireEvent.click(btn);
        });
        await waitFor(() => expect(instances).toHaveLength(1));
        expect(btn.getAttribute("data-recording")).toBe("true");
        expect(instances[0].start).toHaveBeenCalled();
    });

    it("second click stops the recorder and fires onRecorded", async () => {
        mountSupported();
        const onRecorded = vi.fn();
        render(
            <I18nProvider>
                <RecordButton onRecorded={onRecorded} testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("record-button-t1");
        await act(async () => {
            fireEvent.click(btn);
        });
        await waitFor(() => expect(instances).toHaveLength(1));
        await act(async () => {
            fireEvent.click(btn);
        });
        expect(instances[0].stop).toHaveBeenCalled();
        expect(onRecorded).toHaveBeenCalledTimes(1);
        expect(btn.getAttribute("data-recording")).toBe("false");
    });

    it("shows a friendly message and resets on permission denial", async () => {
        mountSupported("NotAllowedError");
        render(
            <I18nProvider>
                <RecordButton onRecorded={() => {}} testId="t1" />
            </I18nProvider>,
        );
        const btn = screen.getByTestId("record-button-t1");
        await act(async () => {
            fireEvent.click(btn);
        });
        await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
        expect(btn.getAttribute("data-recording")).toBe("false");
        const msg = String(notifyError.mock.calls[0][0]);
        expect(msg).not.toContain("NotAllowedError");
        expect(msg.length).toBeGreaterThan(0);
    });
});
