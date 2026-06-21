import { describe, it, expect } from "vitest";

import {
    importHeadingTitle,
    prettifyConversationTitle,
} from "./import-title";

describe("#234 — Import-Detail heading title", () => {
    describe("importHeadingTitle prefers the analysis topic", () => {
        it("uses the analysis topic when present", () => {
            expect(
                importHeadingTitle("my-chat-export.json", "German grammar"),
            ).toBe("German grammar");
        });

        it("trims a whitespace-padded topic", () => {
            expect(importHeadingTitle("anything", "  Bayes theorem  ")).toBe(
                "Bayes theorem",
            );
        });

        it("falls back to the prettified stored title when topic is empty", () => {
            expect(importHeadingTitle("my-chat-export.json", "")).toBe(
                "my chat export",
            );
            expect(importHeadingTitle("my-chat-export.json", undefined)).toBe(
                "my chat export",
            );
            expect(importHeadingTitle("my-chat-export.json", null)).toBe(
                "my chat export",
            );
            expect(importHeadingTitle("anything", "   ")).toBe("anything");
        });
    });

    describe("prettifyConversationTitle", () => {
        it("strips known import extensions", () => {
            expect(prettifyConversationTitle("export.json")).toBe("export");
            expect(prettifyConversationTitle("notes.md")).toBe("notes");
            expect(prettifyConversationTitle("chat.html")).toBe("chat");
        });

        it("de-slugs hyphen/underscore filenames", () => {
            expect(prettifyConversationTitle("my-chat-export")).toBe(
                "my chat export",
            );
            expect(prettifyConversationTitle("deep_dive_topic.txt")).toBe(
                "deep dive topic",
            );
        });

        it("leaves genuine human titles with spaces untouched", () => {
            expect(
                prettifyConversationTitle("Grammatik mit adaptivem Lernprotokoll"),
            ).toBe("Grammatik mit adaptivem Lernprotokoll");
        });

        it("does not de-slug a title that has spaces even with a hyphen", () => {
            expect(prettifyConversationTitle("Claude 3.5 - a chat")).toBe(
                "Claude 3.5 - a chat",
            );
        });
    });
});
