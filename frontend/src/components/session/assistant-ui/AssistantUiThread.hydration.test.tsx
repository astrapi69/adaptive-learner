/**
 * assistant-ui Phase 4b-i-b (#1126): resume-history hydration. A resumed
 * session must show its prior conversation (the legacy SessionChat rendered the
 * full history on resume; the assistant thread otherwise starts empty). This
 * pins: prior user+assistant turns are seeded and shown, the system prompt is
 * hidden, and a new session (system-only) keeps the welcome.
 *
 * #3806: an imported session resumes the same way. It used to open clean and
 * ask the AI again on every reload; now its stored conversation comes back,
 * with the hidden opening trigger left out.
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
import {OPENING_TRIGGER} from "./session-chat-adapter";

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

    it("offers an image in a stored reply as a link on every resume, never loads it (#3803)", async () => {
        getMessages.mockResolvedValue([
            {id: "u1", role: "user", content: "Zeig mir ein Bild."},
            {id: "a1", role: "assistant", content: "Hier: ![Diagramm](https://probe-image.example/d.png)"},
        ]);

        const {container} = render(<AssistantUiThread sessionId="sess-4" />);

        const link = await screen.findByTestId("markdown-remote-image");
        expect(link).toHaveTextContent("Diagramm");
        expect(link).toHaveAttribute("href", "https://probe-image.example/d.png");
        expect(container.querySelector("img")).toBeNull();
    });

    it("keeps the welcome empty-state for a new session (system prompt only)", async () => {
        getMessages.mockResolvedValue([
            {id: "s", role: "system", content: "You are a tutor."},
        ]);
        render(<AssistantUiThread sessionId="sess-2" />);
        expect(await screen.findByTestId("chat-welcome")).toBeInTheDocument();
    });

    it("resumes an imported session with its stored turns, the opening trigger left out (#3806)", async () => {
        getMessages.mockResolvedValue([
            {id: "s", role: "system", content: "You are a tutor."},
            {id: "t", role: "user", content: OPENING_TRIGGER},
            {id: "a1", role: "assistant", content: "Was braucht eine Pflanze?"},
            {id: "u1", role: "user", content: "Licht und Wasser."},
            {id: "a2", role: "assistant", content: "Richtig. Was entsteht dabei?"},
        ]);

        render(<AssistantUiThread sessionId="sess-3" autoOpen />);

        expect(await screen.findByText(/Richtig\. Was entsteht dabei\?/)).toBeInTheDocument();
        expect(screen.getByText(/Was braucht eine Pflanze\?/)).toBeInTheDocument();
        // Only the learner's own turn is a user bubble.
        expect(screen.getAllByTestId("chat-message-user")).toHaveLength(1);
        expect(screen.getByTestId("chat-message-user")).toHaveTextContent("Licht und Wasser.");
        expect(streamMessage).not.toHaveBeenCalled();
    });

    it("leaves out every re-sent opening of a session stored before #3806", async () => {
        // Before the fix each reload stored one more trigger + reply pair.
        getMessages.mockResolvedValue([
            {id: "s", role: "system", content: "You are a tutor."},
            {id: "t1", role: "user", content: OPENING_TRIGGER},
            {id: "a1", role: "assistant", content: "Erste Eröffnung?"},
            {id: "t2", role: "user", content: OPENING_TRIGGER},
            {id: "a2", role: "assistant", content: "Zweite Eröffnung?"},
        ]);

        render(<AssistantUiThread sessionId="sess-4" autoOpen />);

        expect(await screen.findByText(/Zweite Eröffnung\?/)).toBeInTheDocument();
        expect(screen.getByText(/Erste Eröffnung\?/)).toBeInTheDocument();
        expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();
    });
});
