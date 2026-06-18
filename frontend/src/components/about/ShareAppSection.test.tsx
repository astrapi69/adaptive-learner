/**
 * Tests for ShareAppSection (#774) — the About-tab entry point for QR
 * sharing. Mocks ``qrcode`` (no canvas) and ``notify``; pins that the
 * "Show QR code" button opens QrCodeModal pointed at the app URL, and
 * that copying inside the modal raises a success toast.
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

import { SHARE_URL } from "../../lib/share/generate-share-text";
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
    it("renders the share entry and is closed by default", () => {
        render(<ShareAppSection t={t} />);
        expect(screen.getByTestId("about-share-show-qr")).toBeInTheDocument();
        expect(screen.queryByTestId("qr-code-modal")).toBeNull();
    });

    it("opens the QR modal pointed at the app URL", async () => {
        render(<ShareAppSection t={t} />);
        fireEvent.click(screen.getByTestId("about-share-show-qr"));
        expect(screen.getByTestId("qr-code-modal")).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByTestId("qr-code-modal-image")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("qr-code-modal-url")).toHaveTextContent(SHARE_URL);
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
