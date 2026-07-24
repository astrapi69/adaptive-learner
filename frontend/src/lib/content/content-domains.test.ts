import {describe, expect, it} from "vitest";

import {
    contentDomainToStamp,
    DEFAULT_DOMAIN,
    DOMAIN_OPTIONS,
    isKnownContentDomain,
    KNOWN_CONTENT_DOMAINS,
    LEVEL_NONE,
} from "./content-domains";

// #1716 — the shared content-domain vocabulary the CreateLesson + Share
// wizards both consume, so they mirror ONE distinction.
describe("content-domains (#1716)", () => {
    it("DOMAIN_OPTIONS leads with the language default, then the known domains", () => {
        expect(DOMAIN_OPTIONS[0]).toBe(DEFAULT_DOMAIN);
        expect(DOMAIN_OPTIONS[0]).toBe("language");
        // Every known non-language domain is offered after it.
        for (const d of KNOWN_CONTENT_DOMAINS) {
            expect(DOMAIN_OPTIONS).toContain(d);
        }
        // The language default is never inside the known-domains set.
        expect(KNOWN_CONTENT_DOMAINS.has("language")).toBe(false);
    });

    it("isKnownContentDomain recognises non-language domains, case-insensitively", () => {
        expect(isKnownContentDomain("psychology")).toBe(true);
        expect(isKnownContentDomain("Psychology")).toBe(true);
        expect(isKnownContentDomain("traffic-knowledge")).toBe(true);
    });

    it("isKnownContentDomain rejects language, empty, and unknown values", () => {
        expect(isKnownContentDomain("language")).toBe(false);
        expect(isKnownContentDomain("")).toBe(false);
        expect(isKnownContentDomain(null)).toBe(false);
        expect(isKnownContentDomain(undefined)).toBe(false);
        expect(isKnownContentDomain("not-real")).toBe(false);
    });

    it("contentDomainToStamp returns the lowercased known domain, else undefined", () => {
        expect(contentDomainToStamp("Programming")).toBe("programming");
        expect(contentDomainToStamp("knowledge")).toBe("knowledge");
        expect(contentDomainToStamp("language")).toBeUndefined();
        expect(contentDomainToStamp("")).toBeUndefined();
        expect(contentDomainToStamp(null)).toBeUndefined();
        expect(contentDomainToStamp("bogus")).toBeUndefined();
    });

    it("LEVEL_NONE is the non-empty Radix-safe sentinel for a level-less shape", () => {
        expect(LEVEL_NONE).toBe("__none__");
        expect(LEVEL_NONE.length).toBeGreaterThan(0);
    });
});
