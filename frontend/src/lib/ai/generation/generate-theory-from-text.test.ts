import {describe, it, expect, vi} from "vitest";

import {
    buildTheoryRephrasePrompt,
    parseGeneratedTheory,
    generateTheoryFromText,
} from "./generate-theory-from-text";
import type {AiProvider} from "./generate-exercises";

const SAMPLE =
    "Iwan Pawlow zeigte mit seinen Hunden die klassische Konditionierung. " +
    "Ein neutraler Reiz wird durch wiederholte Kopplung mit einem " +
    "unbedingten Reiz zu einem bedingten Reiz, der eine bedingte Reaktion " +
    "ausloest.";

describe("buildTheoryRephrasePrompt", () => {
    it("carries an explicit rephrasing instruction (own words, no copy)", () => {
        const prompt = buildTheoryRephrasePrompt(SAMPLE);
        // The copyright/quality guardrail: the model must reformulate, not
        // copy or merely trim the source. Assert the instruction is present
        // so a prompt edit that drops it fails loudly (#1743).
        expect(prompt).toMatch(/own words/i);
        expect(prompt).toMatch(/do not copy|not copy|verbatim/i);
    });

    it("embeds the source text so the model has the material", () => {
        const prompt = buildTheoryRephrasePrompt(SAMPLE);
        expect(prompt).toContain(SAMPLE);
    });

    it("asks for JSON with a theory_steps array", () => {
        const prompt = buildTheoryRephrasePrompt(SAMPLE);
        expect(prompt).toMatch(/theory_steps/);
        expect(prompt).toMatch(/json/i);
    });
});

describe("parseGeneratedTheory", () => {
    it("parses a well-formed theory_steps object into steps with ids", () => {
        const raw = JSON.stringify({
            theory_steps: [
                {title: "Klassische Konditionierung", body: "Ein Lernprozess ..."},
                {title: "Die drei Reize", body: "Neutral, unbedingt, bedingt ..."},
            ],
        });
        const {steps, errors} = parseGeneratedTheory(raw);
        expect(errors).toEqual([]);
        expect(steps).toHaveLength(2);
        expect(steps[0].id).toBe("theory-1");
        expect(steps[1].id).toBe("theory-2");
        expect(steps[0].title).toBe("Klassische Konditionierung");
        expect(steps[0].body).toContain("Lernprozess");
    });

    it("tolerates fenced JSON and surrounding prose", () => {
        const raw =
            "Sure! Here you go:\n```json\n" +
            JSON.stringify({theory_steps: [{title: "T", body: "Body text"}]}) +
            "\n```\nHope that helps.";
        const {steps} = parseGeneratedTheory(raw);
        expect(steps).toHaveLength(1);
        expect(steps[0].body).toBe("Body text");
    });

    it("drops steps with an empty body (a theory step needs prose)", () => {
        const raw = JSON.stringify({
            theory_steps: [
                {title: "Keeps", body: "Has prose"},
                {title: "Dropped", body: "   "},
            ],
        });
        const {steps} = parseGeneratedTheory(raw);
        expect(steps).toHaveLength(1);
        expect(steps[0].title).toBe("Keeps");
    });

    it("never throws on malformed output; returns an error instead", () => {
        const {steps, errors} = parseGeneratedTheory("not json at all");
        expect(steps).toEqual([]);
        expect(errors.length).toBeGreaterThan(0);
    });
});

describe("generateTheoryFromText", () => {
    function mockProvider(reply: string): AiProvider {
        return {complete: vi.fn(async () => reply)};
    }

    it("returns no steps for blank input without calling the provider", async () => {
        const provider = mockProvider("{}");
        const {steps, errors} = await generateTheoryFromText("   ", provider);
        expect(steps).toEqual([]);
        expect(errors.length).toBeGreaterThan(0);
        expect(provider.complete).not.toHaveBeenCalled();
    });

    it("sends the rephrasing prompt and returns parsed steps", async () => {
        const reply = JSON.stringify({
            theory_steps: [{title: "Konditionierung", body: "In eigenen Worten ..."}],
        });
        const provider = mockProvider(reply);
        const {steps} = await generateTheoryFromText(SAMPLE, provider);
        expect(steps).toHaveLength(1);
        // The prompt actually sent must carry the reformulation guardrail.
        const sentPrompt = (provider.complete as ReturnType<typeof vi.fn>).mock
            .calls[0][0] as string;
        expect(sentPrompt).toMatch(/own words/i);
        expect(sentPrompt).toContain(SAMPLE);
    });

    it("produces reformulated theory, not the source text verbatim", async () => {
        // A faithful model rephrases; the generated body must not be a
        // 1:1 copy of the pasted source (the core #1743 guardrail).
        const reply = JSON.stringify({
            theory_steps: [
                {
                    title: "Klassische Konditionierung",
                    body:
                        "Der Hund lernt, auf ein Signal zu reagieren, weil es " +
                        "wiederholt mit Futter verbunden wurde.",
                },
            ],
        });
        const provider = mockProvider(reply);
        const {steps} = await generateTheoryFromText(SAMPLE, provider);
        expect(steps[0].body).not.toBe(SAMPLE);
        expect(steps[0].body?.trim().length).toBeGreaterThan(0);
    });

    it("propagates a provider transport/auth error to the caller", async () => {
        const provider: AiProvider = {
            complete: vi.fn(async () => {
                throw new Error("HTTP 401: invalid key");
            }),
        };
        await expect(
            generateTheoryFromText(SAMPLE, provider),
        ).rejects.toThrow(/401/);
    });
});
