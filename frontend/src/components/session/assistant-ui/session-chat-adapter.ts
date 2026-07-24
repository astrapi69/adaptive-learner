/**
 * assistant-ui adoption — session-chat adapter (#1126).
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
 *
 * Phase 3b part 2 (#1126): the adapter also serves an AI OPENING turn. When the
 * thread starts a run carrying ``runConfig.custom[OPENING_RUN_FLAG]`` (fired by
 * ``AssistantUiThread`` on an imported-session init via
 * ``thread.startRun({parentId: null})``), there is no user message — the adapter
 * sends a hidden opening trigger so the AI produces the first lesson question.
 * ``startRun`` appends NO user message, so this NEVER shows a user bubble; the
 * trigger reaches only the backend (which has the imported context via #1122).
 */

import type {ChatModelAdapter, ChatModelRunOptions, ThreadMessage} from "@assistant-ui/react";

import {getStorage} from "../../../storage";
import type {SessionMessageExchangeResult} from "../../../types";

/**
 * Domain-side callbacks the thread wires into the adapter (#1126 Phase 4a).
 * ``onExchange`` receives the full ``SessionMessageExchangeResult`` from each
 * completed turn so the session shell can advance the cycle step, surface the
 * step-evaluation verdict, and fire the auto-loop / step-advance toasts — the
 * same domain handling the legacy SessionChat path does via
 * ``useSessionMessaging.handleSend``. Without it, the assistant thread would
 * stream text but silently drop the learning mechanics.
 */
export interface SessionChatAdapterCallbacks {
    onExchange?: (result: SessionMessageExchangeResult) => void;
}

/**
 * ``runConfig.custom`` flag the thread sets to request an AI opening turn.
 * Shared with ``AssistantUiThread`` so the two agree on the signal.
 */
export const OPENING_RUN_FLAG = "sessionOpening";

/**
 * Hidden backend trigger for the opening turn. It is sent to ``streamMessage``
 * as the user turn but is NEVER rendered (``startRun`` adds no user message), so
 * it is a backend directive, not UI chrome — hence not an i18n catalog string.
 * The AI's visible reply language is governed server-side (the #1122 context +
 * the reply-language directive), independent of this instruction's wording.
 */
const OPENING_TRIGGER =
    "Begin this learning session now: ask the learner your first question " +
    "based on the lesson and imported-chat context. Do not summarize; open " +
    "with the next question.";

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
 * @param callbacks - Domain-side hooks; ``onExchange`` fires once per completed
 *   turn with the full exchange result (cycle step, step evaluation, topic
 *   transition), so the session shell keeps the learning mechanics in sync.
 *
 * @example
 * const runtime = useLocalRuntime(
 *     createSessionChatAdapter(session.id, {onExchange: applyExchangeOutcome}),
 * );
 */
export function createSessionChatAdapter(
    sessionId: string,
    callbacks?: SessionChatAdapterCallbacks,
): ChatModelAdapter {
    return {
        async *run({messages, runConfig, abortSignal}: ChatModelRunOptions) {
            // Normal turn: the latest user message. Opening turn: no user
            // message (startRun with parentId null), so fall back to the hidden
            // opening trigger when the thread flagged this run as the opening.
            const isOpening = runConfig?.custom?.[OPENING_RUN_FLAG] === true;
            const content = lastUserText(messages) || (isOpening ? OPENING_TRIGGER : "");
            if (!content) return;

            // Bridge the callback-based streamMessage into an async generator:
            // chunks land in a queue; the loop yields them as they arrive.
            const queue: string[] = [];
            let notify: (() => void) | null = null;
            let finished = false;
            let failure: unknown = null;
            let exchange: SessionMessageExchangeResult | null = null;
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
                        onDone: (result) => {
                            exchange = result;
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

            // Feed the completed turn to the session shell so it advances the
            // cycle step, surfaces the step-evaluation verdict, and fires the
            // auto-loop / step-advance toasts — parity with the legacy path.
            if (exchange) callbacks?.onExchange?.(exchange);
        },
    };
}
