/**
 * Step evaluator parser tests (Phase 10D).
 *
 * The evaluator's robustness is in parseEvaluationResponse: any
 * structural problem must collapse to the deterministic +1
 * fallback. We exercise the markdown-fence strip, the partial-
 * field rejection, the int / float clamping, and the wraps.
 */

import {describe, expect, it} from "vitest";

import {
    buildEvaluationMessages,
    parseEvaluationResponse,
} from "./step-evaluator";

describe("parseEvaluationResponse", () => {
    it("happy path: valid JSON without fences", () => {
        const r = parseEvaluationResponse(
            JSON.stringify({
                advance: true,
                confidence: 0.85,
                reason: "Learner clearly grasped the input.",
                suggested_step: 2,
            }),
            1,
        );
        expect(r.advance).toBe(true);
        expect(r.confidence).toBeCloseTo(0.85);
        expect(r.suggested_step).toBe(2);
        expect(r.fallback_used).toBe(false);
        expect(r.reason).toContain("grasped");
    });

    it("strips ```json ... ``` fences", () => {
        const fenced = "```json\n" + JSON.stringify({
            advance: false,
            confidence: 0.3,
            reason: "stay",
            suggested_step: 3,
        }) + "\n```";
        const r = parseEvaluationResponse(fenced, 3);
        expect(r.fallback_used).toBe(false);
        expect(r.advance).toBe(false);
        expect(r.suggested_step).toBe(3);
    });

    it("snips JSON out of surrounding prose", () => {
        const prose = `Sure! Here is the verdict:\n{"advance":true,"confidence":0.7,"reason":"ok","suggested_step":4}\nLet me know!`;
        const r = parseEvaluationResponse(prose, 3);
        expect(r.fallback_used).toBe(false);
        expect(r.suggested_step).toBe(4);
    });

    it("null/empty -> deterministic +1 fallback", () => {
        const r = parseEvaluationResponse(null, 2);
        expect(r.fallback_used).toBe(true);
        expect(r.advance).toBe(true);
        expect(r.suggested_step).toBe(3);
    });

    it("invalid JSON -> deterministic +1 fallback", () => {
        const r = parseEvaluationResponse("not json", 4);
        expect(r.fallback_used).toBe(true);
        expect(r.suggested_step).toBe(5);
    });

    it("missing required fields -> fallback", () => {
        const r = parseEvaluationResponse(JSON.stringify({confidence: 0.7}), 3);
        expect(r.fallback_used).toBe(true);
        expect(r.suggested_step).toBe(4);
    });

    it("clamps suggested_step into [1,7]", () => {
        const high = parseEvaluationResponse(
            JSON.stringify({advance: true, confidence: 0.9, suggested_step: 99}),
            3,
        );
        expect(high.suggested_step).toBe(7);
        const low = parseEvaluationResponse(
            JSON.stringify({advance: true, confidence: 0.9, suggested_step: -3}),
            3,
        );
        expect(low.suggested_step).toBe(1);
    });

    it("clamps confidence into [0,1]", () => {
        const high = parseEvaluationResponse(
            JSON.stringify({advance: true, confidence: 5, suggested_step: 2}),
            1,
        );
        expect(high.confidence).toBe(1);
        const low = parseEvaluationResponse(
            JSON.stringify({advance: true, confidence: -1, suggested_step: 2}),
            1,
        );
        expect(low.confidence).toBe(0);
    });

    it("at step 7 fallback returns stay-at-7", () => {
        const r = parseEvaluationResponse(null, 7);
        expect(r.advance).toBe(false);
        expect(r.suggested_step).toBe(7);
        expect(r.fallback_used).toBe(true);
    });

    it("missing reason gets a placeholder", () => {
        const r = parseEvaluationResponse(
            JSON.stringify({advance: true, confidence: 0.9, suggested_step: 2}),
            1,
        );
        expect(r.reason).toBe("(no reason provided)");
    });

    it("trims long reason to 240 chars", () => {
        const reason = "x".repeat(500);
        const r = parseEvaluationResponse(
            JSON.stringify({
                advance: true,
                confidence: 0.9,
                suggested_step: 2,
                reason,
            }),
            1,
        );
        expect(r.reason).toHaveLength(240);
    });
});

describe("buildEvaluationMessages", () => {
    it("produces [system, user] with the schema in system + transcript in user", () => {
        const msgs = buildEvaluationMessages({
            method: "deductive",
            currentStep: 1,
            history: [
                {role: "system", content: "S"},
                {role: "user", content: "Hi"},
                {role: "assistant", content: "Hello"},
            ],
            outputLanguage: "de",
        });
        expect(msgs).toHaveLength(2);
        expect(msgs[0].role).toBe("system");
        expect(msgs[0].content).toContain("JSON");
        expect(msgs[1].role).toBe("user");
        expect(msgs[1].content).toContain("method: deductive");
        expect(msgs[1].content).toContain("current_step: 1");
        expect(msgs[1].content).toContain("output_language: de");
        // Transcript renders Learner / AI labels.
        expect(msgs[1].content).toContain("Learner: Hi");
        expect(msgs[1].content).toContain("AI: Hello");
    });

    it("truncates the transcript to the last 8 turns", () => {
        const long = Array.from({length: 20}, (_, i) => ({
            role: "user" as const,
            content: `msg ${i}`,
        }));
        const msgs = buildEvaluationMessages({
            method: "inductive",
            currentStep: 3,
            history: long,
            outputLanguage: "en",
        });
        // Only the last 8 should appear.
        expect(msgs[1].content).toContain("msg 19");
        expect(msgs[1].content).toContain("msg 12");
        expect(msgs[1].content).not.toContain("msg 11");
    });
});
