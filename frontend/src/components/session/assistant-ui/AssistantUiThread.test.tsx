/**
 * assistant-ui Phase 2 parity (#1126): the flag-gated thread reaches i18n +
 * testid parity with the legacy SessionChat. This pins the presentation
 * surface (composer placeholder/label from the i18n catalog, the shared
 * ``chat-*`` testids, the welcome empty-state) so a later cutover keeps the
 * E2E selectors green. The streaming bridge itself is covered by
 * session-chat-adapter.test.ts.
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

// The adapter reads getStorage() lazily inside run(); mount never calls it.
// Mock anyway so a construction-time regression can't reach real storage.
vi.mock("../../../storage", () => ({
    getStorage: () => ({session: {streamMessage: vi.fn()}}),
}));

import AssistantUiThread from "./AssistantUiThread";

describe("AssistantUiThread (Phase 2 parity, #1126)", () => {
    it("renders the shared chat-* testids so the cutover keeps E2E green", () => {
        render(<AssistantUiThread sessionId="sess-1" />);
        expect(screen.getByTestId("session-chat")).toBeInTheDocument();
        expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
        expect(screen.getByTestId("chat-input")).toBeInTheDocument();
        expect(screen.getByTestId("chat-send")).toBeInTheDocument();
    });

    it("labels the composer from the i18n catalog, not hardcoded English chrome", () => {
        render(<AssistantUiThread sessionId="sess-1" />);
        const input = screen.getByTestId("chat-input");
        expect(input).toHaveAttribute("placeholder", "Write your reply…");
        expect(screen.getByTestId("chat-send")).toHaveTextContent("Send");
    });

    it("shows the welcome empty-state before the first turn", async () => {
        // assistant-ui's ``thread.isEmpty`` is a derived store value that
        // settles after the first subscription tick (useSyncExternalStore),
        // so this is an async find, not a synchronous get.
        render(<AssistantUiThread sessionId="sess-1" />);
        expect(await screen.findByTestId("chat-welcome")).toBeInTheDocument();
    });
});
