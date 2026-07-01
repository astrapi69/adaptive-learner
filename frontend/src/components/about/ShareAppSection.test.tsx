/**
 * Tests for ShareAppSection (#774, extended #1172, #1316) — the About-tab
 * share entry point. Mocks ``qrcode`` (no canvas) and ``notify``; pins that
 * the Haupt (stable) strand offers a QR code + link to the production URL,
 * that the Latest (test) strand offers a warned link to the preview URL AND
 * (since #1316) a QR code pointed at the preview URL with the warning kept,
 * and that copying inside the QR modal raises a toast.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
    default: { toDataURL: vi.fn(async () => "data:image/png;base64,QQ==") },
}));

const successMock = vi.fn();
vi.mock("../../utils/notify", () => ({
    notify: { success: (m: string) => successMock(m), error: vi.fn() },
}));

import {
    HAUPT_APP_URL,
    LATEST_APP_URL,
} from "../../lib/share/generate-share-text";
import ShareAppSection from "./ShareAppSection";

const t = (_k: string, fallback?: string) => fallback ?? _k;

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
    });
});

describe("ShareAppSection", () => {
    it("renders both strands; the QR modal is closed by default", () => {
        render(<ShareAppSection t={t} />);
        expect(screen.getByTestId("about-share-haupt")).toBeInTheDocument();
        expect(screen.getByTestId("about-share-latest")).toBeInTheDocument();
        expect(screen.getByTestId("about-share-show-qr")).toBeInTheDocument();
        expect(screen.queryByTestId("qr-code-modal")).toBeNull();
    });

    it("Haupt: opens the QR modal pointed at the production URL", async () => {
        render(<ShareAppSection t={t} />);
        fireEvent.click(screen.getByTestId("about-share-show-qr"));
        expect(screen.getByTestId("qr-code-modal")).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByTestId("qr-code-modal-image")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("qr-code-modal-url")).toHaveTextContent(
            HAUPT_APP_URL,
        );
    });

    it("Haupt: also exposes a plain link to the production URL", () => {
        render(<ShareAppSection t={t} />);
        const link = screen.getByTestId("about-share-haupt-link");
        expect(link).toHaveAttribute("href", HAUPT_APP_URL);
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    });

    it("Latest: offers a warned link to the preview URL", () => {
        render(<ShareAppSection t={t} />);
        const link = screen.getByTestId("about-share-latest-link");
        expect(link).toHaveAttribute("href", LATEST_APP_URL);
        expect(link).toHaveAttribute("target", "_blank");
        expect(
            screen.getByTestId("about-share-latest-warning"),
        ).toBeInTheDocument();
    });

    it("Latest: exposes its own QR trigger while keeping the warning (#1316)", () => {
        render(<ShareAppSection t={t} />);
        const latest = screen.getByTestId("about-share-latest");
        expect(
            latest.querySelector('[data-testid="about-share-latest-show-qr"]'),
        ).not.toBeNull();
        // The instability warning stays alongside the QR (no bare scan-and-go).
        expect(
            screen.getByTestId("about-share-latest-warning"),
        ).toBeInTheDocument();
    });

    it("Latest: opens the QR modal pointed at the preview URL (#1316)", async () => {
        render(<ShareAppSection t={t} />);
        fireEvent.click(screen.getByTestId("about-share-latest-show-qr"));
        expect(screen.getByTestId("qr-code-modal")).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByTestId("qr-code-modal-image")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("qr-code-modal-url")).toHaveTextContent(
            LATEST_APP_URL,
        );
    });

    it("raises a success toast when the URL is copied", async () => {
        render(<ShareAppSection t={t} />);
        fireEvent.click(screen.getByTestId("about-share-show-qr"));
        fireEvent.click(screen.getByTestId("qr-code-modal-copy"));
        await waitFor(() => expect(successMock).toHaveBeenCalled());
    });

    it("closes the modal via the X button", () => {
        render(<ShareAppSection t={t} />);
        fireEvent.click(screen.getByTestId("about-share-show-qr"));
        fireEvent.click(screen.getByTestId("qr-code-modal-close"));
        expect(screen.queryByTestId("qr-code-modal")).toBeNull();
    });
});
