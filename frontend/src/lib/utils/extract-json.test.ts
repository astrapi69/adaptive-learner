/**
 * Defensive JSON extraction tests (Phase 13 hotfix).
 *
 * Covers the failure shapes that broke v0.9.0 conversation
 * analysis with claude-3-5-haiku-latest: prose before/after the
 * JSON, prose containing its own braces, fenced JSON anywhere
 * in the response, and the trivial pure-JSON case.
 */

import {describe, expect, it} from "vitest";

import {
    extractJsonObject,
    findBalancedObjects,
    stripFences,
} from "./extract-json";

describe("stripFences", () => {
    it("removes a ```json + ``` fence block", () => {
        // Opening fence eats the trailing whitespace (newline);
        // closing fence stands alone.
        expect(stripFences("```json\n{\"x\":1}\n```")).toBe('{"x":1}\n');
    });

    it("removes plain ``` fences with surrounding whitespace", () => {
        // Opening pattern is greedy on \s*, so trailing space is eaten.
        expect(stripFences("foo ``` bar ``` baz")).toBe("foo bar baz");
    });

    it("is a no-op when no fences exist", () => {
        expect(stripFences("plain text {x:1}")).toBe("plain text {x:1}");
    });
});

describe("findBalancedObjects", () => {
    it("returns a single object for clean JSON", () => {
        expect(findBalancedObjects('{"a":1}')).toEqual(['{"a":1}']);
    });

    it("returns multiple candidates when prose has braces too", () => {
        const input = "intro {x} middle {actual:1} outro";
        const out = findBalancedObjects(input);
        // Both {x} and {actual:1} are balanced.
        expect(out.length).toBe(2);
        // Sorted by length desc.
        expect(out[0]).toBe("{actual:1}");
    });

    it("respects string boundaries (braces inside strings)", () => {
        const input = '{"note": "this has } and { in it", "x": 1}';
        const out = findBalancedObjects(input);
        expect(out).toEqual([input]);
    });

    it("respects backslash-escaped quotes inside strings", () => {
        const input = '{"q": "a \\"quoted\\" } brace", "x": 1}';
        const out = findBalancedObjects(input);
        expect(out).toEqual([input]);
    });

    it("handles nested objects", () => {
        const input = '{"outer": {"inner": 1}}';
        const out = findBalancedObjects(input);
        expect(out[0]).toBe(input);
        // Inner object is also a candidate.
        expect(out).toContain('{"inner": 1}');
    });

    it("returns empty array on unbalanced input", () => {
        expect(findBalancedObjects("{unclosed")).toEqual([]);
    });
});

describe("extractJsonObject", () => {
    it("parses pure JSON", () => {
        const out = extractJsonObject('{"topic":"Bayes","level":3}');
        expect(out).toEqual({topic: "Bayes", level: 3});
    });

    it("parses fenced JSON wrapped in prose (the Haiku failure shape)", () => {
        const raw =
            "Here's the analysis:\n\n" +
            "```json\n" +
            '{"topic":"Bayes","summary":"Foundations look solid."}\n' +
            "```\n\n" +
            "Let me know if you need more detail.";
        const out = extractJsonObject(raw);
        expect(out).toEqual({
            topic: "Bayes",
            summary: "Foundations look solid.",
        });
    });

    it("parses JSON with prose-braces BEFORE it", () => {
        // The classic regression: greedy match would grab from
        // ``{placeholder}`` through the closing brace.
        const raw =
            "Sure! The user struggled with {placeholder} concepts. " +
            "Here is the analysis: " +
            '{"topic":"Bayes"}';
        const out = extractJsonObject(raw);
        expect(out).toEqual({topic: "Bayes"});
    });

    it("parses JSON with prose-braces AFTER it", () => {
        const raw =
            '{"topic":"X"} Let me know if you need {something} else.';
        const out = extractJsonObject(raw);
        expect(out).toEqual({topic: "X"});
    });

    it("picks the LARGEST balanced object when several parse", () => {
        const raw =
            'note: {"hint":"x"} ... analysis: ' +
            '{"topic":"Real","subtopics":["a","b"],"summary":"ok"}';
        const out = extractJsonObject(raw);
        expect(out?.topic).toBe("Real");
    });

    it("handles 'I'll analyze...' preamble + trailing prose", () => {
        const raw =
            "I'll analyze this conversation now.\n\n" +
            '{"topic":"Induction","user_level":"beginner",' +
            '"summary":"Beginner question on induction."}\n\n' +
            "Hope this helps! Let me know.";
        const out = extractJsonObject(raw);
        expect(out?.topic).toBe("Induction");
        expect(out?.user_level).toBe("beginner");
    });

    it("handles nested objects in the result", () => {
        const raw =
            "Result: " +
            '{"topic":"X","metadata":{"model":"haiku","tokens":42}}';
        const out = extractJsonObject(raw);
        expect((out?.metadata as Record<string, unknown>).model).toBe("haiku");
    });

    it("handles strings containing braces", () => {
        const raw =
            'Analysis: {"note":"The user wrote `{name}` as a literal","x":1}';
        const out = extractJsonObject(raw);
        expect(out?.x).toBe(1);
        expect(out?.note).toContain("{name}");
    });

    it("handles JSON arrays inside the object", () => {
        const raw =
            "Done!\n" +
            '{"strengths":["a","b"],"weaknesses":["c"],"x":1}\n' +
            "End.";
        const out = extractJsonObject(raw);
        expect(out?.strengths).toEqual(["a", "b"]);
    });

    it("returns null on empty input", () => {
        expect(extractJsonObject("")).toBeNull();
        expect(extractJsonObject("   ")).toBeNull();
    });

    it("returns null when there is no JSON object at all", () => {
        expect(extractJsonObject("not json, no braces, just words")).toBeNull();
    });

    it("returns null when only an array is present (object required)", () => {
        expect(extractJsonObject("[1, 2, 3]")).toBeNull();
    });

    it("returns null on malformed JSON-like content", () => {
        expect(extractJsonObject("{not valid json}")).toBeNull();
    });

    it("ignores text outside fences that itself looks JSON-y", () => {
        // Outer ``{placeholder}`` parses but is not the answer
        // — the fenced larger one wins.
        const raw =
            "Note: see {hint} above.\n" +
            "```json\n" +
            '{"topic":"Real","summary":"Real analysis."}\n' +
            "```\n" +
            "Cheers.";
        const out = extractJsonObject(raw);
        expect(out?.topic).toBe("Real");
    });

    it("survives mid-string fences without leading prose", () => {
        const raw = '```json{"topic":"X"}```';
        const out = extractJsonObject(raw);
        expect(out?.topic).toBe("X");
    });

    it("handles the realistic Haiku response shape end-to-end", () => {
        const raw =
            "Sure, here's the structured analysis:\n\n" +
            "```json\n" +
            "{\n" +
            '  "topic": "Bayesian inference",\n' +
            '  "subtopics": ["priors", "posteriors", "likelihood"],\n' +
            '  "user_level": "beginner",\n' +
            '  "strengths": ["clear question framing"],\n' +
            '  "weaknesses": ["confused likelihood with posterior"],\n' +
            '  "error_patterns": ["swapped p(A|B) and p(B|A)"],\n' +
            '  "recommended_method": "inductive",\n' +
            '  "recommended_focus": "Walk through 3 concrete examples.",\n' +
            '  "summary": "Beginner Bayes — needs concrete examples."\n' +
            "}\n" +
            "```\n\n" +
            "Let me know if you'd like me to expand on any of the {weaknesses} I identified!";
        const out = extractJsonObject(raw);
        expect(out?.topic).toBe("Bayesian inference");
        expect(out?.user_level).toBe("beginner");
        expect(out?.recommended_method).toBe("inductive");
        expect(Array.isArray(out?.subtopics)).toBe(true);
    });
});
