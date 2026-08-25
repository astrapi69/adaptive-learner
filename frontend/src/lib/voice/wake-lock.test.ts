/**
 * Screen Wake Lock wrapper tests (#2666).
 *
 * happy-dom doesn't ship ``navigator.wakeLock`` so we mount a small
 * mock for the tests that exercise the supported path, and confirm
 * the helpers short-circuit cleanly when the API is absent.
 */

import {afterEach, describe, expect, it, vi} from "vitest";

import {isWakeLockSupported, releaseWakeLock, requestWakeLock} from "./wake-lock";

function mountMockWakeLock(options: {rejects?: boolean} = {}): {
    request: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
} {
    const release = vi.fn().mockResolvedValue(undefined);
    const sentinel = {release, released: false};
    const request = options.rejects
        ? vi.fn().mockRejectedValue(new Error("NotAllowedError"))
        : vi.fn().mockResolvedValue(sentinel);
    (navigator as unknown as {wakeLock: {request: typeof request}}).wakeLock = {
        request,
    };
    return {request, release};
}

afterEach(() => {
    delete (navigator as unknown as {wakeLock?: unknown}).wakeLock;
    vi.restoreAllMocks();
});

describe("isWakeLockSupported", () => {
    it("returns false when navigator.wakeLock is absent", () => {
        expect(isWakeLockSupported()).toBe(false);
    });

    it("returns true when navigator.wakeLock is present", () => {
        mountMockWakeLock();
        expect(isWakeLockSupported()).toBe(true);
    });
});

describe("requestWakeLock", () => {
    it("returns null when the API is unsupported", async () => {
        await expect(requestWakeLock()).resolves.toBeNull();
    });

    it("returns the sentinel when the request succeeds", async () => {
        const {request} = mountMockWakeLock();
        const handle = await requestWakeLock();
        expect(request).toHaveBeenCalledWith("screen");
        expect(handle).not.toBeNull();
    });

    it("returns null when the request is refused (e.g. low battery)", async () => {
        mountMockWakeLock({rejects: true});
        await expect(requestWakeLock()).resolves.toBeNull();
    });
});

describe("releaseWakeLock", () => {
    it("is a no-op for a null handle", async () => {
        await expect(releaseWakeLock(null)).resolves.toBeUndefined();
    });

    it("calls release() on a held handle", async () => {
        const {release} = mountMockWakeLock();
        const handle = await requestWakeLock();
        await releaseWakeLock(handle);
        expect(release).toHaveBeenCalled();
    });

    it("swallows a release() rejection (already released by the browser)", async () => {
        mountMockWakeLock();
        const handle = await requestWakeLock();
        (handle as unknown as {release: () => Promise<void>}).release = vi
            .fn()
            .mockRejectedValue(new Error("already released"));
        await expect(releaseWakeLock(handle)).resolves.toBeUndefined();
    });
});
