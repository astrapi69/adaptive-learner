/**
 * Tests for the "N content updates" header badge (#2904): it surfaces the
 * existing per-row update_available signal outside the /content page, and
 * renders nothing when nothing is out of date.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_k: string, fallback?: string) => fallback ?? _k,
        lang: "en",
    }),
}));

const getContentUpdateCountMock = vi.fn();

vi.mock("../../lib/content/browse/content-updates-badge", () => ({
    getContentUpdateCount: () => getContentUpdateCountMock(),
}));

import NavContentUpdatesBadge from "./NavContentUpdatesBadge";

beforeEach(() => {
    getContentUpdateCountMock.mockReset();
});

describe("NavContentUpdatesBadge", () => {
    it("renders nothing while no content set has an update", async () => {
        getContentUpdateCountMock.mockResolvedValueOnce(0);
        render(
            <MemoryRouter>
                <NavContentUpdatesBadge />
            </MemoryRouter>,
        );
        await waitFor(() => expect(getContentUpdateCountMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("nav-content-updates-badge"),
        ).not.toBeInTheDocument();
    });

    it("shows the count and links to /content when updates exist", async () => {
        getContentUpdateCountMock.mockResolvedValueOnce(3);
        render(
            <MemoryRouter>
                <NavContentUpdatesBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-content-updates-badge");
        expect(badge).toHaveTextContent("3");
        expect(badge).toHaveAttribute("href", "/content");
    });

    it("composes the accessible name from the visible label plus the action", async () => {
        getContentUpdateCountMock.mockResolvedValueOnce(1);
        render(
            <MemoryRouter>
                <NavContentUpdatesBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-content-updates-badge");
        expect(badge.getAttribute("aria-label")).toContain("1 updates");
        expect(badge.getAttribute("aria-label")).toContain("view content");
    });
});
