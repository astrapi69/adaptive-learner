import {describe, expect, it} from "vitest";

import {buildShareIntentUrls, type SharePlatform} from "./share-intent-urls";

const TEXT = 'I completed "Numbers 1-10" with 90%! 🎓 9 of 10 correct. #AdaptiveLearner';
const URL = "https://astrapi69.github.io/adaptive-learner/";

describe("buildShareIntentUrls", () => {
    it("builds a Facebook sharer URL with the encoded app URL", () => {
        const fb = buildShareIntentUrls(TEXT, URL).find(
            (i) => i.platform === "facebook",
        );
        expect(fb?.url).toBe(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL)}`,
        );
    });

    it("builds a LinkedIn share-offsite URL with the encoded app URL", () => {
        const li = buildShareIntentUrls(TEXT, URL).find(
            (i) => i.platform === "linkedin",
        );
        expect(li?.url).toBe(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(URL)}`,
        );
    });

    it("puts the result text AND the link into the X intent's text param (#1227)", () => {
        const x = buildShareIntentUrls(TEXT, URL).find((i) => i.platform === "x");
        // The link must travel inside `text`, not a separate &url= param,
        // which the twitter.com -> x.com compose flow drops in practice.
        expect(x?.url).toBe(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${TEXT} ${URL}`)}`,
        );
        const params = new URLSearchParams(x!.url.split("?")[1]);
        expect(params.get("text")).toBe(`${TEXT} ${URL}`);
        expect(params.has("url")).toBe(false);
        // The prefilled tweet body really does carry both the result and link.
        expect(params.get("text")).toContain(TEXT);
        expect(params.get("text")).toContain(URL);
    });

    it("builds a WhatsApp URL with the encoded text+url combined", () => {
        const wa = buildShareIntentUrls(TEXT, URL).find(
            (i) => i.platform === "whatsapp",
        );
        expect(wa?.url).toBe(
            `https://wa.me/?text=${encodeURIComponent(`${TEXT} ${URL}`)}`,
        );
    });

    it("round-trips the X text param through decodeURIComponent (umlauts/emoji/#)", () => {
        const text = 'Ich habe "Zählen 1-10" mit 90%! 🎓 9/10 #AdaptiveLernen';
        const x = buildShareIntentUrls(text, URL).find((i) => i.platform === "x");
        const raw = x!.url.split("text=")[1];
        expect(decodeURIComponent(raw)).toBe(`${text} ${URL}`);
    });

    it("keeps Facebook and LinkedIn link-only — no text param added (#1227)", () => {
        const intents = buildShareIntentUrls(TEXT, URL);
        for (const platform of ["facebook", "linkedin"] as const) {
            const intent = intents.find((i) => i.platform === platform)!;
            const params = new URLSearchParams(intent.url.split("?")[1]);
            expect(params.has("text")).toBe(false);
            expect(intent.url).not.toContain(encodeURIComponent(TEXT));
        }
    });

    it("stays valid for an empty and a very long title", () => {
        for (const text of ["", "x".repeat(5000)]) {
            const intents = buildShareIntentUrls(text, URL);
            for (const intent of intents) {
                expect(() => new globalThis.URL(intent.url)).not.toThrow();
            }
        }
    });

    it("URL-encodes special characters (spaces, #, quotes, emoji)", () => {
        const x = buildShareIntentUrls(TEXT, URL).find((i) => i.platform === "x");
        // No raw space / # / double-quote leaks into the query string.
        expect(x?.url).not.toContain(" ");
        expect(x?.url).toContain("%20"); // encoded space
        expect(x?.url).toContain("%23"); // encoded #
        expect(x?.url).toContain("%22"); // encoded "
    });

    it("offers exactly Facebook, LinkedIn, X and WhatsApp — no Instagram", () => {
        const platforms = buildShareIntentUrls(TEXT, URL).map((i) => i.platform);
        expect(platforms).toEqual<SharePlatform[]>([
            "facebook",
            "linkedin",
            "x",
            "whatsapp",
        ]);
        expect(platforms).not.toContain("instagram" as SharePlatform);
        // Belt and braces: no built URL points at instagram.com.
        expect(
            buildShareIntentUrls(TEXT, URL).some((i) =>
                i.url.includes("instagram"),
            ),
        ).toBe(false);
    });
});
