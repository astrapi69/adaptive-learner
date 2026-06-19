import {describe, it, expect} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import OfflineBadge from "./OfflineBadge";

describe("OfflineBadge", () => {
    it("shows the online label + data-online when online", () => {
        cleanup();
        render(
            <OfflineBadge online onlineLabel="Online" offlineLabel="Offline" />,
        );
        const b = screen.getByTestId("offline-badge");
        expect(b).toHaveAttribute("data-online", "true");
        expect(b).toHaveTextContent("Online");
        expect(b).toHaveAttribute("role", "status");
    });

    it("shows the offline label when offline", () => {
        cleanup();
        render(
            <OfflineBadge
                online={false}
                onlineLabel="Online"
                offlineLabel="Offline"
            />,
        );
        const b = screen.getByTestId("offline-badge");
        expect(b).toHaveAttribute("data-online", "false");
        expect(b).toHaveTextContent("Offline");
    });

    it("forwards caller class names + testId", () => {
        cleanup();
        render(
            <OfflineBadge
                online
                onlineLabel="On"
                offlineLabel="Off"
                testId="nav-online-indicator"
                className="nav-online-indicator"
            />,
        );
        expect(
            screen.getByTestId("nav-online-indicator"),
        ).toHaveClass("nav-online-indicator");
    });
});
