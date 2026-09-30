/**
 * #3358 - one screen wake lock hook for every "someone is reading" state:
 * silent reading in a lesson, the runner modes, and read-aloud.
 *
 * The sentinel mock fires ``release`` the way a browser does when the
 * page goes hidden; the #2666 mock hard-coded ``released: false`` and had
 * no event, so it could not show that the re-acquire never happened.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {useScreenWakeLock} from "./useScreenWakeLock";

type Listener = () => void;

/** A sentinel that behaves like the browser's: ``release`` fires its
 *  listeners and flips ``released``. */
function makeSentinel() {
    const listeners: Listener[] = [];
    const sentinel = {
        released: false,
        addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
        removeEventListener: vi.fn(),
        release: vi.fn(async () => {
            sentinel.released = true;
            listeners.forEach((listener) => listener());
        }),
    };
    return sentinel;
}

function mountWakeLock(request: ReturnType<typeof vi.fn>) {
    (navigator as unknown as {wakeLock: {request: typeof request}}).wakeLock = {request};
}

function setVisibility(state: "hidden" | "visible") {
    Object.defineProperty(document, "visibilityState", {configurable: true, get: () => state});
    document.dispatchEvent(new Event("visibilitychange"));
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

afterEach(() => {
    delete (navigator as unknown as {wakeLock?: unknown}).wakeLock;
    setVisibility("visible");
});

describe("useScreenWakeLock (#3358)", () => {
    it.each([
        [true, 1],
        [false, 0],
    ])("active=%s requests the screen lock %i time(s)", async (active, calls) => {
        const request = vi.fn(async () => makeSentinel());
        mountWakeLock(request);
        renderHook(() => useScreenWakeLock(active));
        await flush();
        expect(request).toHaveBeenCalledTimes(calls);
        if (calls) expect(request).toHaveBeenCalledWith("screen");
    });

    it("re-acquires after the browser released the lock on hide", async () => {
        const sentinels: ReturnType<typeof makeSentinel>[] = [];
        const request = vi.fn(async () => {
            const sentinel = makeSentinel();
            sentinels.push(sentinel);
            return sentinel;
        });
        mountWakeLock(request);
        renderHook(() => useScreenWakeLock(true));
        await flush();
        await act(async () => {
            setVisibility("hidden");
            await sentinels[0].release();
        });
        await act(async () => {
            setVisibility("visible");
        });
        await flush();
        expect(request).toHaveBeenCalledTimes(2);
    });

    it("retries once on the next pointerdown when the request was refused", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const request = vi
            .fn()
            .mockRejectedValueOnce(new DOMException("not allowed", "NotAllowedError"))
            .mockResolvedValue(makeSentinel());
        mountWakeLock(request);
        renderHook(() => useScreenWakeLock(true));
        await flush();
        expect(warn).toHaveBeenCalled();
        await act(async () => {
            window.dispatchEvent(new Event("pointerdown"));
        });
        await flush();
        expect(request).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    it("releases the lock when it turns inactive", async () => {
        const sentinel = makeSentinel();
        mountWakeLock(vi.fn(async () => sentinel));
        const {rerender} = renderHook(({active}) => useScreenWakeLock(active), {
            initialProps: {active: true},
        });
        await flush();
        rerender({active: false});
        await flush();
        expect(sentinel.release).toHaveBeenCalled();
    });
});
