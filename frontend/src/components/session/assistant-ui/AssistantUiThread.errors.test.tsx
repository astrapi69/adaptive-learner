/**
 * #3377 - a failed tutor turn and a failed history load are visible.
 *
 * Before: a stream failure left an empty assistant bubble with no message
 * and no toast, and a failed history load kept the fresh welcome screen,
 * which reads as deleted history.
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const {getMessages, streamMessage, notifyError} = vi.hoisted(() => ({
    getMessages: vi.fn(),
    streamMessage: vi.fn(),
    notifyError: vi.fn(),
}));
vi.mock("../../../storage", () => ({
    getStorage: () => ({session: {getMessages, streamMessage}}),
}));
vi.mock("../../../utils/notify", () => ({
    notify: {error: notifyError, info: vi.fn(), success: vi.fn(), warning: vi.fn()},
}));

import AssistantUiThread from "./AssistantUiThread";

function send(text: string) {
    fireEvent.change(screen.getByTestId("chat-input"), {target: {value: text}});
    fireEvent.click(screen.getByTestId("chat-send"));
}

beforeEach(() => {
    getMessages.mockReset();
    streamMessage.mockReset();
    notifyError.mockReset();
    getMessages.mockResolvedValue([]);
});

describe("a failed tutor turn (#3377)", () => {
    it("shows an inline error with a retry and toasts the error object", async () => {
        const failure = new Error("HTTP 500");
        streamMessage.mockRejectedValue(failure);
        render(<AssistantUiThread sessionId="sess-err" />);
        send("Hola");

        expect(await screen.findByTestId("chat-reply-error")).toHaveTextContent(
            "The reply could not be loaded.",
        );
        expect(screen.getByTestId("chat-reply-retry")).toHaveTextContent("Try again");
        expect(notifyError).toHaveBeenCalledWith("The reply could not be loaded.", {
            error: failure,
        });
    });

    it("sends the turn again on retry and drops the error once it succeeds", async () => {
        streamMessage.mockRejectedValueOnce(new Error("network down"));
        streamMessage.mockImplementationOnce(async (_id, _body, handlers) => {
            handlers.onChunk("¡Hola!");
            handlers.onDone({});
        });
        render(<AssistantUiThread sessionId="sess-retry" />);
        send("Hola");

        fireEvent.click(await screen.findByTestId("chat-reply-retry"));

        expect(await screen.findByText("¡Hola!")).toBeInTheDocument();
        expect(streamMessage).toHaveBeenCalledTimes(2);
        expect(streamMessage.mock.calls[1][1]).toEqual({role: "user", content: "Hola"});
        expect(screen.queryByTestId("chat-reply-error")).not.toBeInTheDocument();
    });
});

describe("a failed history load (#3377)", () => {
    it("shows a notice instead of the welcome screen", async () => {
        getMessages.mockRejectedValue(new Error("HTTP 503"));
        render(<AssistantUiThread sessionId="sess-hist" />);

        expect(await screen.findByTestId("chat-history-error")).toHaveTextContent(
            "The earlier conversation could not be loaded. Nothing was deleted.",
        );
        expect(screen.queryByTestId("chat-welcome")).not.toBeInTheDocument();
    });

    it("loads the history again on retry", async () => {
        getMessages.mockRejectedValueOnce(new Error("HTTP 503"));
        getMessages.mockResolvedValueOnce([
            {id: "u1", role: "user", content: "Wie geht Konjunktiv?"},
            {id: "a1", role: "assistant", content: "Lass uns anfangen."},
        ]);
        render(<AssistantUiThread sessionId="sess-hist-retry" />);

        fireEvent.click(await screen.findByTestId("chat-history-retry"));

        expect(await screen.findByText(/Lass uns anfangen\./)).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByTestId("chat-history-error")).not.toBeInTheDocument(),
        );
    });
});
