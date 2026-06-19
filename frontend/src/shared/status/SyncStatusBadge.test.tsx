import {describe, it, expect} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import SyncStatusBadge from "./SyncStatusBadge";

describe("SyncStatusBadge", () => {
    it("renders nothing when nothing is pending", () => {
        cleanup();
        render(<SyncStatusBadge pendingCount={0} />);
        expect(screen.queryByTestId("sync-status-badge")).not.toBeInTheDocument();
    });

    it("renders the count when pending", () => {
        cleanup();
        render(<SyncStatusBadge pendingCount={3} ariaLabel="3 pending" />);
        const b = screen.getByTestId("sync-status-badge");
        expect(b).toHaveTextContent("3");
        expect(b).toHaveAttribute("aria-label", "3 pending");
        expect(b).toHaveAttribute("data-pending", "3");
    });

    it("caps the displayed number", () => {
        cleanup();
        render(<SyncStatusBadge pendingCount={150} max={99} />);
        expect(screen.getByTestId("sync-status-badge")).toHaveTextContent("99+");
    });
});
