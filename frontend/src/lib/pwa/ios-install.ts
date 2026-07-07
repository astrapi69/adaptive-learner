/**
 * ios-install — platform detection for the iOS "Add to Home Screen" hint.
 *
 * iOS Safari has no ``beforeinstallprompt`` event (and no real fullscreen API
 * for web content), so the only way to a chrome-less app on iPhone/iPad is
 * adding the standalone PWA to the home screen via the Share sheet. We surface a
 * short, dismissable instruction — but ONLY on iOS Safari and ONLY before the
 * app is installed, so it never appears where it can't apply.
 *
 * Pure functions over explicit inputs so they unit-test without stubbing
 * ``navigator``; the component reads the real values and passes them in.
 */

/** True for an iOS device. iPadOS 13+ reports as desktop Safari, so the
 *  ``MacIntel`` + multi-touch combination is treated as iPad. */
export function isIosDevice(
    userAgent: string,
    platform: string,
    maxTouchPoints: number,
): boolean {
    if (/\b(iphone|ipod|ipad)\b/i.test(userAgent)) return true;
    return platform === "MacIntel" && maxTouchPoints > 1;
}

/** True when the iOS browser is Safari (the only iOS browser that can add to
 *  the home screen). Other iOS browsers are WebKit shells that cannot, so we
 *  exclude them by their UA tokens. */
export function isIosSafari(userAgent: string): boolean {
    return !/\b(crios|fxios|edgios|opios|mercury|gsa)\b/i.test(userAgent);
}

/**
 * True for an installed iOS PWA running standalone (#1357). On iOS/WKWebView a
 * new service worker often does not take control on ``skipWaiting`` + reload —
 * it activates reliably only after the app is fully closed and reopened. The
 * update banner surfaces that clear-text step ONLY in this exact situation, so
 * the hint never appears where the normal reload would have worked.
 */
export function isIosStandalone(
    userAgent: string,
    platform: string,
    maxTouchPoints: number,
    standalone: boolean,
): boolean {
    return (
        standalone && isIosDevice(userAgent, platform, maxTouchPoints)
    );
}

export interface IosHintInputs {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
    /** Already running as an installed PWA (display-mode standalone). */
    standalone: boolean;
    /** The user already dismissed the hint. */
    dismissed: boolean;
}

/**
 * Whether to show the iOS "Add to Home Screen" hint: an iOS-Safari device that
 * is not already installed and hasn't dismissed the hint.
 */
export function shouldShowIosInstallHint(inputs: IosHintInputs): boolean {
    if (inputs.standalone || inputs.dismissed) return false;
    if (!isIosDevice(inputs.userAgent, inputs.platform, inputs.maxTouchPoints)) {
        return false;
    }
    return isIosSafari(inputs.userAgent);
}
