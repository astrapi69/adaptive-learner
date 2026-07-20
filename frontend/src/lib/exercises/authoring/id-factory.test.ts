/**
 * Pins the injectable id-factory seam (#1862): each factory owns a private,
 * monotonic sequence, and two factories are independent — the property the
 * old module-global ``_exSeq`` / ``_extSeq`` counters could not offer.
 */

import {describe, expect, it} from "vitest";

import {createIdFactory} from "./id-factory";

describe("createIdFactory (#1862)", () => {
    it("counts from 1 with the given prefix", () => {
        const ids = createIdFactory("ex-manual");
        expect(ids.next()).toBe("ex-manual-1");
        expect(ids.next()).toBe("ex-manual-2");
        expect(ids.next()).toBe("ex-manual-3");
    });

    it("gives each factory an independent sequence (injectable, not global)", () => {
        const a = createIdFactory("ex-ext");
        const b = createIdFactory("ex-ext");
        expect(a.next()).toBe("ex-ext-1");
        expect(a.next()).toBe("ex-ext-2");
        // b's counter is untouched by a's advances.
        expect(b.next()).toBe("ex-ext-1");
    });

    it("never repeats an id within one factory", () => {
        const ids = createIdFactory("x");
        const seen = new Set<string>();
        for (let i = 0; i < 50; i++) seen.add(ids.next());
        expect(seen.size).toBe(50);
    });
});
