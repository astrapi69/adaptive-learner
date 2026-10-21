/**
 * A session's stored conversation, as the assistant-ui thread reads it on
 * resume (#3806).
 *
 * The thread loads ``getStorage().session.getMessages`` in both storage modes
 * and answers two questions from it, here as pure functions:
 *
 *   - which turns the learner sees again ({@link visibleTurns}): never the
 *     system prompt (orchestrator metadata) and never the hidden opening
 *     trigger, which only ever went to the AI;
 *   - whether the conversation has begun ({@link conversationStarted}): an
 *     imported-chat session asks its AI opening question only while nothing
 *     is on record.
 *
 * The record of a sent opening is the trigger turn itself. Both storage modes
 * persist a sent user turn BEFORE the provider call (Dexie
 * ``sendMessageStream``, API ``POST /message/stream``), so once the opening
 * has gone out it is on record, and a reload, a re-open or a second tab finds
 * it there instead of asking the AI again.
 */

import type {SessionMessage} from "../../../types";
import {OPENING_TRIGGER} from "./session-chat-adapter";

function isOpeningTrigger(message: SessionMessage): boolean {
    return message.role === "user" && message.content === OPENING_TRIGGER;
}

/**
 * The stored turns a resumed thread shows, oldest first, shaped for
 * ``thread.reset``. Drops the system prompt and every hidden opening trigger
 * (a session stored before #3806 can hold one per reload); keeps the learner's
 * own turns and every AI turn.
 *
 * @param history - The session's messages as ``getMessages`` returns them.
 * @returns The visible turns; empty for a session where nothing visible was
 *   said yet, e.g. an opening whose reply never arrived.
 *
 * @example
 * const prior = visibleTurns(await getStorage().session.getMessages(id));
 * if (prior.length > 0) runtime.thread.reset(prior);
 */
export function visibleTurns(
    history: readonly SessionMessage[],
): {id: string; role: "user" | "assistant"; content: string}[] {
    return history
        .filter((message) => message.role !== "system" && !isOpeningTrigger(message))
        .map((message) => ({
            id: message.id,
            role: message.role as "user" | "assistant",
            content: message.content,
        }));
}

/**
 * Whether anything beyond the system prompt is on record: a sent opening
 * (with or without its reply), or a turn the learner wrote. ``false`` only for
 * a session nobody has spoken in yet, the one state in which an imported
 * session may send its AI opening.
 *
 * @param history - The session's messages as ``getMessages`` returns them.
 * @returns ``true`` once the conversation has begun.
 *
 * @example
 * if (autoOpen && !conversationStarted(history)) startOpening();
 */
export function conversationStarted(history: readonly SessionMessage[]): boolean {
    return history.some((message) => message.role !== "system");
}
