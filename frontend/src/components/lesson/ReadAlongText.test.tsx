/**
 * ReadAlongText — follow-along tokenizer + highlight (TTS C5).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import ReadAlongText, {
    activeTokenIndex,
    tokenizeForReadAlong,
} from "./ReadAlongText";

describe("tokenizeForReadAlong", () => {
    it("splits into word + whitespace tokens with char offsets", () => {
        const toks = tokenizeForReadAlong("Hola mundo");
        expect(toks).toEqual([
            {text: "Hola", start: 0, isWord: true},
            {text: " ", start: 4, isWord: false},
            {text: "mundo", start: 5, isWord: true},
        ]);
    });
});

describe("activeTokenIndex", () => {
    const toks = tokenizeForReadAlong("Hola mundo");
    it("locates the word containing the active char", () => {
        expect(activeTokenIndex(toks, 0)).toBe(0); // start of "Hola"
        expect(activeTokenIndex(toks, 2)).toBe(0); // inside "Hola"
        expect(activeTokenIndex(toks, 5)).toBe(2); // start of "mundo"
    });
    it("returns -1 for whitespace, out-of-range, or idle (-1)", () => {
        expect(activeTokenIndex(toks, 4)).toBe(-1); // the space
        expect(activeTokenIndex(toks, 99)).toBe(-1);
        expect(activeTokenIndex(toks, -1)).toBe(-1);
    });
});

describe("ReadAlongText render", () => {
    it("marks the active word with .tts-active and leaves others plain", () => {
        render(<ReadAlongText text="Hola mundo" activeChar={5} />);
        const container = screen.getByTestId("lesson-read-along");
        const active = container.querySelector('[data-active="true"]');
        expect(active).not.toBeNull();
        expect(active!.textContent).toBe("mundo");
        expect(active!.className).toContain("tts-active");
        // The full text is still present (words + the space between).
        expect(container.textContent).toBe("Hola mundo");
    });

    it("highlights nothing when idle (activeChar -1)", () => {
        render(<ReadAlongText text="Hola mundo" activeChar={-1} />);
        const container = screen.getByTestId("lesson-read-along");
        expect(container.querySelector(".tts-active")).toBeNull();
    });
});
