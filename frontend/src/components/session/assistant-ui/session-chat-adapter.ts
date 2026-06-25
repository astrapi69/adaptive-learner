/**
 * assistant-ui adoption — Phase 0 spike (#1126).
 *
 * Bridges assistant-ui's ``ChatModelAdapter`` to the app's existing storage
 * abstraction: each run streams a reply through
 * ``getStorage().session.streamMessage(...)`` — the SAME path the current
 * SessionChat uses — so both storage modes (Dexie browser-direct / API) and
 * the #1122 imported-context rebuild are inherited for free.
 *
 * The adapter is the load-bearing seam of the migration: assistant-ui owns the
 * chat UI; this function keeps the learning-session domain (dual storage, AI
 * providers, step evaluation) on our side. No domain logic is duplicated here.
 */

import type {ChatModelAdapter, ChatModelRunOptions, ThreadMessage} from "@assistant-ui/react";

import {getStorage} from "../../../storage";

/** Concatenate the text parts of the most recent user message. */
function lastUserText(messages: readonly ThreadMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.role !== "user") continue;
        return message.content
            .map((part) =>
                (part as {type: string; text?: string}).type === "text"
                    ? ((part as {text?: string}).text ?? "")
                    : "",
            )
            .join("");
    }
    return "";
}

/**
 * Build a ``ChatModelAdapter`` bound to one learning session. ``run`` takes the
 * latest user turn, streams the assistant reply through the storage layer, and
 * yields the accumulating text as assistant-ui run results.
 *
 * @param sessionId - The LearningSession id the thread is attached to.
 *
 * @example
 * const runtime = useLocalRuntime(createSessionChatAdapter(session.id));
 */
export function createSessionChatAdapter(sessionId: string): ChatModelAdapter {
    return {
        async *run({messages, abortSignal}: ChatModelRunOptions) {
            const content = lastUserText(messages);
            if (!content) return;

            // Bridge the callback-based streamMessage into an async generator:
            // chunks land in a queue; the loop yields them as they arrive.
            const queue: string[] = [];
            let notify: (() => void) | null = null;
            let finished = false;
            let failure: unknown = null;
            const waitForNext = () =>
                new Promise<void>((resolve) => {
                    notify = resolve;
                });
            const wake = () => {
                const resolve = notify;
                notify = null;
                resolve?.();
            };

            const streamed = getStorage()
                .session.streamMessage(
                    sessionId,
                    {role: "user", content},
                    {
                        onChunk: (delta) => {
                            queue.push(delta);
                            wake();
                        },
                        onDone: () => {
                            finished = true;
                            wake();
                        },
                        signal: abortSignal,
                    },
                )
                .catch((error) => {
                    failure = error;
                    finished = true;
                    wake();
                });

            let accumulated = "";
            while (true) {
                if (queue.length > 0) {
                    accumulated += queue.shift();
                    yield {content: [{type: "text" as const, text: accumulated}]};
                    continue;
                }
                if (finished) break;
                await waitForNext();
            }

            await streamed;
            if (failure) throw failure;
        },
    };
}
