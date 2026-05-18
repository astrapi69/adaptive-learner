import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import InstallPrompt from "./InstallPrompt";

/**
 * Fake ``BeforeInstallPromptEvent`` — the real type is a
 * browser-only API not present in happy-dom. We construct a
 * plain Event + tack on the two methods the component uses.
 */
function fireBeforeInstallPrompt(
    promptResult: "accepted" | "dismissed" = "accepted",
) {
    const ev = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
    };
    ev.prompt = vi.fn(() => Promise.resolve());
    ev.userChoice = Promise.resolve({outcome: promptResult});
    window.dispatchEvent(ev);
    return ev;
}

describe("InstallPrompt", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders nothing before the beforeinstallprompt event fires", () => {
        render(<InstallPrompt />);
        expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
    });

    it("renders the banner after beforeinstallprompt fires", async () => {
        render(<InstallPrompt />);
        await act(async () => {
            fireBeforeInstallPrompt();
        });
        await waitFor(() =>
            expect(screen.getByTestId("install-prompt")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("install-prompt-install")).toBeInTheDocument();
        expect(screen.getByTestId("install-prompt-dismiss")).toBeInTheDocument();
    });

    it("calling prompt() and accepted does NOT permanently dismiss", async () => {
        render(<InstallPrompt />);
        await act(async () => {
            fireBeforeInstallPrompt("accepted");
        });
        await screen.findByTestId("install-prompt");
        await act(async () => {
            fireEvent.click(screen.getByTestId("install-prompt-install"));
        });
        // The component hides because the prompt resolved + we
        // cleared the deferred ref; but localStorage stays empty
        // since the user ACCEPTED (so a future browser session
        // could re-prompt if needed).
        await waitFor(() =>
            expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument(),
        );
        expect(localStorage.getItem("adaptive-learner.install_dismissed")).toBeNull();
    });

    it("native prompt dismissed → flag persisted to localStorage", async () => {
        render(<InstallPrompt />);
        await act(async () => {
            fireBeforeInstallPrompt("dismissed");
        });
        await screen.findByTestId("install-prompt");
        await act(async () => {
            fireEvent.click(screen.getByTestId("install-prompt-install"));
        });
        await waitFor(() =>
            expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument(),
        );
        expect(localStorage.getItem("adaptive-learner.install_dismissed")).toBe(
            "1",
        );
    });

    it("clicking Not now persists dismissed flag", async () => {
        render(<InstallPrompt />);
        await act(async () => {
            fireBeforeInstallPrompt();
        });
        await screen.findByTestId("install-prompt");
        fireEvent.click(screen.getByTestId("install-prompt-dismiss"));
        await waitFor(() =>
            expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument(),
        );
        expect(localStorage.getItem("adaptive-learner.install_dismissed")).toBe(
            "1",
        );
    });

    it("does NOT render again on remount when previously dismissed", async () => {
        localStorage.setItem("adaptive-learner.install_dismissed", "1");
        const {rerender} = render(<InstallPrompt />);
        // Even if the event fires, the dismissed flag wins.
        await act(async () => {
            fireBeforeInstallPrompt();
        });
        // No re-render trigger from the event alone (the dismissed
        // state was already true at mount); force a rerender to be
        // safe.
        rerender(<InstallPrompt />);
        expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
    });

    it("hides when appinstalled event fires (user installed via browser UI)", async () => {
        render(<InstallPrompt />);
        await act(async () => {
            fireBeforeInstallPrompt();
        });
        await screen.findByTestId("install-prompt");
        await act(async () => {
            window.dispatchEvent(new Event("appinstalled"));
        });
        await waitFor(() =>
            expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument(),
        );
    });

    it("region has correct aria attributes", async () => {
        render(<InstallPrompt />);
        await act(async () => {
            fireBeforeInstallPrompt();
        });
        const region = await screen.findByTestId("install-prompt");
        expect(region.getAttribute("role")).toBe("region");
        expect(region.getAttribute("aria-label")).toMatch(
            /Install Adaptive Learner|Adaptive Learner installieren|Instalar Adaptive Learner|Installer Adaptive Learner|Εγκατάσταση Adaptive Learner/,
        );
    });
});
