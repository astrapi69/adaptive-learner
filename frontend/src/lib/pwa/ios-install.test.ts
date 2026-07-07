/**
 * Tests for the iOS install-hint platform detection.
 */

import { describe, expect, it } from "vitest";

import {
    isIosDevice,
    isIosSafari,
    isIosStandalone,
    shouldShowIosInstallHint,
} from "./ios-install";

const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";
const DESKTOP_CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

describe("isIosDevice", () => {
    it("detects iPhone", () => {
        expect(isIosDevice(IPHONE_SAFARI, "iPhone", 5)).toBe(true);
    });
    it("detects iPadOS 13+ masquerading as Mac (MacIntel + touch)", () => {
        expect(isIosDevice(DESKTOP_CHROME, "MacIntel", 5)).toBe(true);
    });
    it("is false for Android and real desktop", () => {
        expect(isIosDevice(ANDROID_CHROME, "Linux armv8l", 5)).toBe(false);
        expect(isIosDevice(DESKTOP_CHROME, "MacIntel", 0)).toBe(false);
    });
});

describe("isIosSafari", () => {
    it("true for Safari, false for Chrome/Firefox on iOS", () => {
        expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
        expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    });
});

describe("isIosStandalone (#1357 update-restart hint gate)", () => {
    it("true only for an installed (standalone) iOS device", () => {
        expect(isIosStandalone(IPHONE_SAFARI, "iPhone", 5, true)).toBe(true);
    });
    it("false for iOS in a browser tab (not standalone)", () => {
        expect(isIosStandalone(IPHONE_SAFARI, "iPhone", 5, false)).toBe(false);
    });
    it("false for a standalone non-iOS (Android) PWA", () => {
        expect(
            isIosStandalone(ANDROID_CHROME, "Linux armv8l", 5, true),
        ).toBe(false);
    });
});

describe("shouldShowIosInstallHint", () => {
    const ios = {
        userAgent: IPHONE_SAFARI,
        platform: "iPhone",
        maxTouchPoints: 5,
        standalone: false,
        dismissed: false,
    };

    it("shows on iOS Safari, not installed, not dismissed", () => {
        expect(shouldShowIosInstallHint(ios)).toBe(true);
    });

    it("hidden when already installed (standalone)", () => {
        expect(shouldShowIosInstallHint({ ...ios, standalone: true })).toBe(false);
    });

    it("hidden when dismissed", () => {
        expect(shouldShowIosInstallHint({ ...ios, dismissed: true })).toBe(false);
    });

    it("hidden on a non-Safari iOS browser and on Android", () => {
        expect(
            shouldShowIosInstallHint({ ...ios, userAgent: IPHONE_CHROME }),
        ).toBe(false);
        expect(
            shouldShowIosInstallHint({
                ...ios,
                userAgent: ANDROID_CHROME,
                platform: "Linux armv8l",
            }),
        ).toBe(false);
    });
});
