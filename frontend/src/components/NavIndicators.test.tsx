import {describe, it, expect, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import {NavSyncIndicator, NavOnlineIndicator} from "./NavIndicators";

vi.mock("../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_k: string, fb?: string) => fb ?? _k,
        lang: "en",
    }),
}));

function wrap(node: React.ReactNode) {
    return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe("NavSyncIndicator pending badge (#604)", () => {
    it("shows the pending count badge when there are pending changes", () => {
        cleanup();
        wrap(<NavSyncIndicator paired pendingCount={3} />);
        expect(screen.getByTestId("sync-status-badge")).toHaveTextContent("3");
    });

    it("hides the badge when nothing is pending", () => {
        cleanup();
        wrap(<NavSyncIndicator paired pendingCount={0} />);
        expect(
            screen.queryByTestId("sync-status-badge"),
        ).not.toBeInTheDocument();
    });

    it("defaults to no badge when pendingCount is omitted", () => {
        cleanup();
        wrap(<NavSyncIndicator paired />);
        expect(
            screen.queryByTestId("sync-status-badge"),
        ).not.toBeInTheDocument();
    });
});

describe("NavOnlineIndicator delegates to OfflineBadge", () => {
    it("keeps the nav testid + data-online contract", () => {
        cleanup();
        render(<NavOnlineIndicator online={false} />);
        const el = screen.getByTestId("nav-online-indicator");
        expect(el).toHaveAttribute("data-online", "false");
        expect(el).toHaveClass("nav-online-indicator", "is-offline");
    });
});
