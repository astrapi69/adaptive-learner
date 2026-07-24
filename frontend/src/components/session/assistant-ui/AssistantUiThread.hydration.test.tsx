/**
 * assistant-ui Phase 4b-i-b (#1126): resume-history hydration. A resumed REGULAR
 * session must show its prior conversation (the legacy SessionChat rendered the
 * full history on resume; the assistant thread otherwise starts empty). This
 * pins: prior user+assistant turns are seeded and shown, the system prompt is
 * hidden, a new session (system-only) keeps the welcome, and an imported session
 * (autoOpen) does NOT hydrate (clean open, #1143).
 */

import {render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const {getMessages, streamMessage} = vi.hoisted(() => ({
    getMessages: vi.fn(),
    streamMessage: vi.fn(),
}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({session: {getMessages, streamMessage}}),
}));

import AssistantUiThread from "./AssistantUiThread";

describe("AssistantUiThread resume hydration (Phase 4b-i-b, #1126)", () => {
    beforeEach(() => {
        getMessages.mockReset();
        streamMessage.mockReset();
    });

    it("seeds a resumed regular session with its prior turns, hiding the system prompt", async () => {
        getMessages.mockResolvedValue([
            {id: "s", role: "system", content: "You are a tutor."},
            {id: "u1", role: "user", content: "Wie geht Konjunktiv?"},
            {id: "a1", role: "assistant", content: "Lass uns anfangen."},
        ]);

        render(<AssistantUiThread sessionId="sess-1" />);

        expect(await screen.findByText(/Wie geht Konjunktiv\?/)).toBeInTheDocument();
        expect(await screen.findByText(/Lass uns anfangen\./)).toBeInTheDocument();
        // The system prompt is orchestrator metadata, never a bubble.
        expect(screen.queryByText(/You are a tutor\./)).not.toBeInTheDocument();
    });

    it("keeps the welcome empty-state for a new session (system prompt only)", async () => {
        getMessages.mockResolvedValue([
            {id: "s", role: "system", content: "You are a tutor."},
        ]);
        render(<AssistantUiThread sessionId="sess-2" />);
        expect(await screen.findByTestId("chat-welcome")).toBeInTheDocument();
    });

    it("does NOT hydrate an imported session (autoOpen opens it clean)", async () => {
        streamMessage.mockImplementation(async () => {});
        render(<AssistantUiThread sessionId="sess-3" autoOpen />);
        // Clean open: history is never loaded for imported sessions.
        expect(getMessages).not.toHaveBeenCalled();
    });
});
