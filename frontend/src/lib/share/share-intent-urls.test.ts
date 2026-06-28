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

    it("builds an X intent URL with the encoded text and url", () => {
        const x = buildShareIntentUrls(TEXT, URL).find((i) => i.platform === "x");
        expect(x?.url).toBe(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(TEXT)}&url=${encodeURIComponent(URL)}`,
        );
    });

    it("builds a WhatsApp URL with the encoded text+url combined", () => {
        const wa = buildShareIntentUrls(TEXT, URL).find(
            (i) => i.platform === "whatsapp",
        );
        expect(wa?.url).toBe(
            `https://wa.me/?text=${encodeURIComponent(`${TEXT} ${URL}`)}`,
        );
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
