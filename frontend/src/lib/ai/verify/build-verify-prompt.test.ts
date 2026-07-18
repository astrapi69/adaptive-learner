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
});
