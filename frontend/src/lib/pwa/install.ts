/**
 * App-install availability (#604).
 *
 * Captures the browser's ``beforeinstallprompt`` event at module load
 * (so it isn't lost before any UI mounts) and exposes a tiny reactive
 * API the Settings "Install app" button uses to offer a manual install
 * at the moment the user asks — independent of the timed
 * ``InstallPrompt`` banner. No-op on browsers / platforms that never
 * fire the event (the button then renders disabled with a reason).
 */

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
    for (const l of listeners) l();
}

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferred = e as BeforeInstallPromptEvent;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        deferred = null;
        notify();
    });
}

/** True if the app is already running as an installed PWA. */
export function isStandalone(): boolean {
    try {
        if (
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(display-mode: standalone)").matches
        ) {
            return true;
        }
        return (
            typeof navigator !== "undefined" &&
            (navigator as unknown as {standalone?: boolean}).standalone === true
        );
    } catch {
        return false;
    }
}

/** Whether a manual install can be offered right now. */
export function canInstall(): boolean {
    return deferred !== null && !isStandalone();
}

/** Trigger the native install prompt. Returns the outcome. */
export async function promptInstall(): Promise<
    "accepted" | "dismissed" | "unavailable"
> {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    notify();
    return choice.outcome;
}

/** Subscribe to availability changes. Returns an unsubscribe fn. */
export function subscribeInstall(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
