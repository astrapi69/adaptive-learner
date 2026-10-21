/**
 * #3806 - reading a session's stored conversation: which turns a resumed
 * thread shows again, and whether the conversation has begun, which is the
 * gate for an imported session's one AI opening.
 */

import {describe, expect, it} from "vitest";

import type {SessionMessage} from "../../../types";
import {OPENING_TRIGGER} from "./session-chat-adapter";
import {conversationStarted, visibleTurns} from "./session-history";

function turn(id: string, role: SessionMessage["role"], content: string): SessionMessage {
    return {id, session_id: "sess-1", role, content, created_at: "2026-10-20T10:00:00Z"};
}

const SYSTEM = turn("s", "system", "You are a tutor.");
const TRIGGER = turn("t", "user", OPENING_TRIGGER);
const QUESTION = turn("a1", "assistant", "Was braucht eine Pflanze?");
const ANSWER = turn("u1", "user", "Licht und Wasser.");

describe("visibleTurns", () => {
    it("returns the learner's and the AI's turns in order, without the system prompt and the trigger", () => {
        expect(visibleTurns([SYSTEM, TRIGGER, QUESTION, ANSWER])).toEqual([
            {id: "a1", role: "assistant", content: "Was braucht eine Pflanze?"},
            {id: "u1", role: "user", content: "Licht und Wasser."},
        ]);
    });

    it.each<[string, SessionMessage[]]>([
        ["no history at all", []],
        ["only the system prompt", [SYSTEM]],
        ["an opening whose reply never arrived", [SYSTEM, TRIGGER]],
    ])("returns nothing for %s", (_case, history) => {
        expect(visibleTurns(history)).toEqual([]);
    });

    it("keeps an AI turn that repeats the trigger's wording: only the learner-side trigger is hidden", () => {
        const echoed = turn("a2", "assistant", OPENING_TRIGGER);
        expect(visibleTurns([SYSTEM, echoed])).toEqual([
            {id: "a2", role: "assistant", content: OPENING_TRIGGER},
        ]);
    });
});

describe("conversationStarted", () => {
    it.each<[string, SessionMessage[], boolean]>([
        ["no history at all", [], false],
        ["a new session (only the system prompt)", [SYSTEM], false],
        ["a sent opening without its reply", [SYSTEM, TRIGGER], true],
        ["an opening and its reply", [SYSTEM, TRIGGER, QUESTION], true],
        ["a learner who wrote first", [SYSTEM, ANSWER], true],
    ])("%s -> %s", (_case, history, started) => {
        expect(conversationStarted(history)).toBe(started);
    });
});
