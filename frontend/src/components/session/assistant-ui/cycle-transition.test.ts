/**
 * assistant-ui Phase 4b-i (#1126): the cycle-transition formatter preserves the
 * auto-loop learning content (cycle label + summary + next topic) as inline
 * markdown, so the assistant thread keeps parity with the legacy SessionChat
 * card instead of degrading it to a bare "Cycle N started" toast.
 */

import {describe, expect, it} from "vitest";

import {formatCycleTransition} from "./cycle-transition";
import type {TopicTransitionVerdict} from "../../../types";

const t = (_k: string, fallback?: string) => fallback ?? _k;

function transition(over: Partial<TopicTransitionVerdict> = {}): TopicTransitionVerdict {
    return {
        summary: "You practised reflexive verbs.",
        next_topic: "Modal verbs",
        next_topic_rationale: "",
        looped: true,
        new_cycle_count: 2,
        ...over,
    } as TopicTransitionVerdict;
}

describe("formatCycleTransition (#1126 Phase 4b-i)", () => {
    it("keeps the cycle label, summary and next topic (parity with the legacy card)", () => {
        const md = formatCycleTransition(transition(), t);
        expect(md).toContain("**Cycle 2**");
        expect(md).toContain("You practised reflexive verbs.");
        expect(md).toContain("**Next topic:** Modal verbs");
    });

    it("omits the next-topic line when there is none", () => {
        const md = formatCycleTransition(transition({next_topic: null}), t);
        expect(md).toContain("You practised reflexive verbs.");
        expect(md).not.toContain("Next topic:");
    });
});
