import {describe, it, expect} from "vitest";

import {relativeTime} from "./relative-time";

const NOW = new Date("2026-06-04T12:00:00Z");

function ago(seconds: number): Date {
    return new Date(NOW.getTime() - seconds * 1000);
}

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const ALL_LANGS = ["de", "en", "es", "fr", "el", "pt", "tr", "ja"];

describe("relativeTime", () => {
    it("renders 'now' for very recent instants (under 10s)", () => {
        expect(relativeTime(ago(3), "en", NOW)).toBe("now");
        // German renders the same bucket as "jetzt".
        expect(relativeTime(ago(3), "de", NOW)).toBe("jetzt");
    });

    it("renders seconds for the sub-minute range", () => {
        expect(relativeTime(ago(30), "en", NOW)).toBe("30 seconds ago");
    });

    it("renders minutes", () => {
        expect(relativeTime(ago(5 * MIN), "en", NOW)).toBe("5 minutes ago");
        expect(relativeTime(ago(5 * MIN), "de", NOW)).toBe("vor 5 Minuten");
    });

    it("renders hours", () => {
        expect(relativeTime(ago(3 * HOUR), "en", NOW)).toBe("3 hours ago");
    });

    it("collapses 1 day to the natural 'yesterday' form", () => {
        expect(relativeTime(ago(DAY), "en", NOW)).toBe("yesterday");
        expect(relativeTime(ago(DAY), "de", NOW)).toBe("gestern");
    });

    it("renders multiple days", () => {
        expect(relativeTime(ago(3 * DAY), "en", NOW)).toBe("3 days ago");
        expect(relativeTime(ago(3 * DAY), "de", NOW)).toBe("vor 3 Tagen");
    });

    it("renders weeks", () => {
        expect(relativeTime(ago(2 * WEEK), "en", NOW)).toBe("2 weeks ago");
        expect(relativeTime(ago(2 * WEEK), "de", NOW)).toBe("vor 2 Wochen");
    });

    it("renders months", () => {
        expect(relativeTime(ago(MONTH), "en", NOW)).toBe("last month");
        // Two months reads in the numeric form across locales.
        expect(relativeTime(ago(2 * MONTH), "en", NOW)).toBe("2 months ago");
    });

    it("renders years", () => {
        expect(relativeTime(ago(YEAR), "en", NOW)).toBe("last year");
    });

    it("produces a non-empty string for all 8 languages", () => {
        for (const lang of ALL_LANGS) {
            const out = relativeTime(ago(3 * DAY), lang, NOW);
            expect(out).toBeTruthy();
            expect(typeof out).toBe("string");
        }
    });

    it("never throws on a structurally invalid language tag", () => {
        // A malformed BCP-47 tag would make the Intl constructor throw;
        // the helper must degrade to English instead of bubbling up.
        expect(() => relativeTime(ago(3 * DAY), "!!bad!!", NOW)).not.toThrow();
        expect(relativeTime(ago(3 * DAY), "!!bad!!", NOW)).toBe("3 days ago");
    });

    it("uses the current time when now is omitted (smoke)", () => {
        // Just-created instant resolves to the 'now' bucket.
        expect(relativeTime(new Date(), "en")).toBe("now");
    });
});
