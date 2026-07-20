import {describe, expect, it} from "vitest";

import {
    buildVerifyMessages,
    parseVerifyVerdict,
    type VerifyAnswerContext,
} from "./build-verify-prompt";

const CTX: VerifyAnswerContext = {
    prompt: "Translate: single",
    userAnswer: "noch Single",
    acceptedAnswers: ["Single"],
    uiLanguage: "de",
    targetLanguage: "en",
    sourceLanguage: "de",
    domain: "language",
};

describe("buildVerifyMessages (#1798)", () => {
    it("includes the question, learner answer and accepted answers", () => {
        const messages = buildVerifyMessages(CTX);
        const joined = messages.map((m) => m.content).join("\n");
        expect(joined).toContain("Translate: single");
        expect(joined).toContain("noch Single");
        expect(joined).toContain("Single");
    });

    it("asks for JSON and the learner's UI language", () => {
        const system = buildVerifyMessages(CTX).find((m) => m.role === "system");
        expect(system).toBeDefined();
        expect(system!.content).toMatch(/JSON/i);
        expect(system!.content).toContain("de");
    });

    it("ends with a user turn carrying the learner's answer", () => {
        const messages = buildVerifyMessages(CTX);
        const last = messages[messages.length - 1];
        expect(last.role).toBe("user");
        expect(last.content).toContain("noch Single");
    });
});

describe("parseVerifyVerdict (#1798)", () => {
    it("parses a clean yes verdict + reason", () => {
        expect(
            parseVerifyVerdict('{"verdict":"yes","reason":"Same meaning."}'),
        ).toEqual({verdict: "yes", reason: "Same meaning."});
    });

    it("parses partial and no", () => {
        expect(parseVerifyVerdict('{"verdict":"partial","reason":"x"}').verdict).toBe(
            "partial",
        );
        expect(parseVerifyVerdict('{"verdict":"no","reason":"y"}').verdict).toBe("no");
    });

    it("recovers JSON wrapped in prose / fences", () => {
        const raw = 'Sure!\n```json\n{"verdict":"yes","reason":"ok"}\n```';
        expect(parseVerifyVerdict(raw)).toEqual({verdict: "yes", reason: "ok"});
    });

    it("maps an unrecognised verdict value to unknown", () => {
        expect(parseVerifyVerdict('{"verdict":"maybe","reason":"z"}').verdict).toBe(
            "unknown",
        );
    });

    it("falls back to unknown with the raw text when not JSON", () => {
        const result = parseVerifyVerdict("I think it is basically right.");
        expect(result.verdict).toBe("unknown");
        expect(result.reason).toBe("I think it is basically right.");
    });

    it("recovers a verdict from JSON with a trailing comma (#1883)", () => {
        // Many BYOK models emit a trailing comma, which JSON.parse rejects.
        const result = parseVerifyVerdict(
            '{"verdict": "no", "reason": "Different meaning.",}',
        );
        expect(result.verdict).toBe("no");
        expect(result.reason).toBe("Different meaning.");
    });

    it("recovers a verdict from single-quoted JSON (#1883)", () => {
        const result = parseVerifyVerdict(
            "{'verdict': 'yes', 'reason': 'Accepted synonym.'}",
        );
        expect(result.verdict).toBe("yes");
        expect(result.reason).toBe("Accepted synonym.");
    });

    it("recovers a verdict from smart-quoted JSON (#1883)", () => {
        const result = parseVerifyVerdict(
            "{“verdict”: “partial”, “reason”: “Only half right.”}",
        );
        expect(result.verdict).toBe("partial");
    });

    it("tolerates a verdict phrased with extra words (#1883)", () => {
        const result = parseVerifyVerdict(
            '{"verdict": "no, the answer is wrong", "reason": "It changes the meaning."}',
        );
        expect(result.verdict).toBe("no");
        expect(result.reason).toBe("It changes the meaning.");
    });

    it("never surfaces a raw JSON blob as the reason on total failure (#1883)", () => {
        // A malformed reply with no salvageable verdict must NOT dump the raw
        // JSON at the learner — that was the display bug.
        const raw = '{"foo": "bar", "baz": [1, 2,}';
        const result = parseVerifyVerdict(raw);
        expect(result.verdict).toBe("unknown");
        expect(result.reason).toBe("");
    });
});
