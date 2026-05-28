import { describe, expect, it } from "vitest";

import { type DiffToken, tokenDiff } from "./token-diff";

describe("tokenDiff", () => {
    it("identical input → all equal", () => {
        expect(tokenDiff("hello world", "hello world")).toEqual<DiffToken[]>([
            { text: "hello ", type: "equal" },
            { text: "world", type: "equal" },
        ]);
    });

    it("empty user input → entire correct answer as a single insert token", () => {
        expect(tokenDiff("", "Bonjour le monde")).toEqual<DiffToken[]>([
            { text: "Bonjour le monde", type: "insert" },
        ]);
    });

    it("empty correct answer → entire user input as a single delete token", () => {
        expect(tokenDiff("hello world", "")).toEqual<DiffToken[]>([
            { text: "hello world", type: "delete" },
        ]);
    });

    it("both empty → empty diff", () => {
        expect(tokenDiff("", "")).toEqual<DiffToken[]>([]);
    });

    it("completely different (no LCS anchor) → all deletes then all inserts (no replace pairing)", () => {
        expect(tokenDiff("foo bar", "baz qux")).toEqual<DiffToken[]>([
            { text: "foo ", type: "delete" },
            { text: "bar ", type: "delete" },
            { text: "baz ", type: "insert" },
            { text: "qux", type: "insert" },
        ]);
    });

    it("case differences produce replace ops when an equal anchor is present", () => {
        expect(tokenDiff("Hello world", "hello world")).toEqual<DiffToken[]>([
            { text: "Hello ", type: "replace", expected: "hello" },
            { text: "world", type: "equal" },
        ]);
    });

    it("accent differences produce replace ops (cafe vs café)", () => {
        expect(tokenDiff("le cafe", "le café")).toEqual<DiffToken[]>([
            { text: "le ", type: "equal" },
            { text: "cafe", type: "replace", expected: "café" },
        ]);
    });

    it("collapses runs of intra-word whitespace before diffing", () => {
        expect(tokenDiff("hello   world", "hello world")).toEqual<DiffToken[]>([
            { text: "hello ", type: "equal" },
            { text: "world", type: "equal" },
        ]);
    });

    it("trims leading and trailing whitespace before diffing", () => {
        expect(tokenDiff("  hello world  ", "hello world")).toEqual<DiffToken[]>([
            { text: "hello ", type: "equal" },
            { text: "world", type: "equal" },
        ]);
    });

    it("interleaved equal-replace-equal pattern", () => {
        expect(tokenDiff("a b c", "a x c")).toEqual<DiffToken[]>([
            { text: "a ", type: "equal" },
            { text: "b ", type: "replace", expected: "x" },
            { text: "c", type: "equal" },
        ]);
    });

    it("middle insert keeps surrounding equals", () => {
        expect(tokenDiff("a c", "a b c")).toEqual<DiffToken[]>([
            { text: "a ", type: "equal" },
            { text: "b ", type: "insert" },
            { text: "c", type: "equal" },
        ]);
    });

    it("middle delete keeps surrounding equals", () => {
        expect(tokenDiff("a b c", "a c")).toEqual<DiffToken[]>([
            { text: "a ", type: "equal" },
            { text: "b ", type: "delete" },
            { text: "c", type: "equal" },
        ]);
    });

    it("multi-replace run within a single delete-insert window", () => {
        expect(tokenDiff("a b c d", "a x y d")).toEqual<DiffToken[]>([
            { text: "a ", type: "equal" },
            { text: "b ", type: "replace", expected: "x" },
            { text: "c ", type: "replace", expected: "y" },
            { text: "d", type: "equal" },
        ]);
    });

    it("unbalanced delete-insert run pairs as many as possible, then emits leftovers", () => {
        // user has 2 wrong words, correct expected 3 → 2 replace + 1 insert.
        expect(tokenDiff("a b c d", "a x y z d")).toEqual<DiffToken[]>([
            { text: "a ", type: "equal" },
            { text: "b ", type: "replace", expected: "x" },
            { text: "c ", type: "replace", expected: "y" },
            { text: "z ", type: "insert" },
            { text: "d", type: "equal" },
        ]);
    });

    it("NFC normalization: composed === decomposed Unicode compares equal", () => {
        const composed = "café";
        const decomposed = "café"; // e + COMBINING ACUTE ACCENT
        expect(tokenDiff(decomposed, composed)).toEqual<DiffToken[]>([
            { text: composed, type: "equal" },
        ]);
    });

    it("does not pair across distant runs (each run is local)", () => {
        // user: "a X b Y c", correct: "a P b Q c" → two independent replace pairs.
        expect(tokenDiff("a X b Y c", "a P b Q c")).toEqual<DiffToken[]>([
            { text: "a ", type: "equal" },
            { text: "X ", type: "replace", expected: "P" },
            { text: "b ", type: "equal" },
            { text: "Y ", type: "replace", expected: "Q" },
            { text: "c", type: "equal" },
        ]);
    });

    it("single-word identical input", () => {
        expect(tokenDiff("oui", "oui")).toEqual<DiffToken[]>([
            { text: "oui", type: "equal" },
        ]);
    });

    it("single-word case mismatch — no equal anchor, emits raw delete then insert", () => {
        // Without surrounding context, the contract says "completely different"
        // → don't pair into replace.
        expect(tokenDiff("Oui", "oui")).toEqual<DiffToken[]>([
            { text: "Oui ", type: "delete" },
            { text: "oui", type: "insert" },
        ]);
    });
});
