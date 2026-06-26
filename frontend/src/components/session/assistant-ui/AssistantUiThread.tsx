/**
 * assistant-ui adoption — Phase 0 spike (#1126).
 *
 * A minimal assistant-ui Thread wired to the app's session storage via
 * {@link createSessionChatAdapter}. This is the PROOF-OF-SEAM: the chat UI is
 * assistant-ui's; the backend is our existing ``getStorage().session.*`` (so
 * Dexie browser-direct mode works with no backend, inheriting the #1122
 * context rebuild).
 *
 * Intentionally unstyled beyond structural classes — theming, i18n, domain
 * panels (step-eval, method-switch, XP), Voice and testid parity are later
 * migration phases. NOT wired into the live session flow; mounted only behind
 * the opt-in ``?ui=assistant`` flag so the production chat is untouched.
 */

import {useMemo} from "react";
import {
    AssistantRuntimeProvider,
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useLocalRuntime,
} from "@assistant-ui/react";

import {createSessionChatAdapter} from "./session-chat-adapter";

interface AssistantUiThreadProps {
    /** LearningSession id the thread streams against. */
    sessionId: string;
}

function UserMessage() {
    return (
        <div className="aui-message aui-message-user" data-testid="aui-user-message">
            <MessagePrimitive.Content />
        </div>
    );
}

function AssistantMessage() {
    return (
        <div className="aui-message aui-message-assistant" data-testid="aui-assistant-message">
            <MessagePrimitive.Content />
        </div>
    );
}

/**
 * Render the assistant-ui Thread for one session. Wrap in
 * ``AssistantRuntimeProvider`` with a local runtime backed by our adapter.
 */
export default function AssistantUiThread({sessionId}: AssistantUiThreadProps) {
    const runtime = useLocalRuntime(
        useMemo(() => createSessionChatAdapter(sessionId), [sessionId]),
    );

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <ThreadPrimitive.Root className="aui-thread" data-testid="aui-thread">
                <ThreadPrimitive.Viewport className="aui-thread-viewport">
                    <ThreadPrimitive.Messages
                        components={{
                            UserMessage,
                            AssistantMessage,
                        }}
                    />
                </ThreadPrimitive.Viewport>
                <ComposerPrimitive.Root className="aui-composer">
                    <ComposerPrimitive.Input
                        className="aui-composer-input"
                        data-testid="aui-composer-input"
                        placeholder="Write your reply…"
                    />
                    <ComposerPrimitive.Send
                        className="aui-composer-send"
                        data-testid="aui-composer-send"
                    />
                </ComposerPrimitive.Root>
            </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
    );
}
