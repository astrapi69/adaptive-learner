/**
 * The unused-catalog-key report (#3444) against the gate contract (#2083):
 * it finds, it is clean on a clean input, it fails closed, it says what it
 * checked, and its answer does not depend on input order.
 */

import {describe, expect, it} from "vitest";

import {
    AGE_DAYS,
    ReportBasisError,
    agedUnusedKeys,
    findUnusedKeys,
    renderReport,
    type ConsumerScan,
} from "./unused-catalog-keys";

function scan(over: Partial<ConsumerScan> = {}): ConsumerScan {
    return {namedKeys: new Set(), dynamicPatterns: [], texts: ["const unrelated = 1;"], ...over};
}

describe("findUnusedKeys (#3444)", () => {
    it("finds a key no channel reads", () => {
        expect(findUnusedKeys(["nav.home", "nav.gone"], scan({namedKeys: new Set(["nav.home"])}))).toEqual([
            "nav.gone",
        ]);
    });

    it.each([
        ["a static or data-held key", scan({namedKeys: new Set(["nav.home"])})],
        ["a dynamic t() pattern", scan({dynamicPatterns: [{prefix: "nav.", suffix: ""}]})],
        ["a literal in YAML", scan({texts: ["title_key: nav.home\n"]})],
        ["a literal in a JSON key list (shell-keys.json)", scan({texts: ['["nav.home"]']})],
        ["a block consumer naming the field (labels.ts)", scan({texts: ["const b = catalog.nav; b.home;"]})],
        ["a Python block consumer", scan({texts: ['block = loaded.get("nav")\nhome = block["home"]']})],
    ])("is clean when %s reads the key", (_label, input) => {
        expect(findUnusedKeys(["nav.home"], input)).toEqual([]);
    });

    it.each([
        ["a longer key sharing the prefix", "nav.homepage"],
        ["the key as part of a dotted path", "x.nav.home"],
    ])("does not count %s as a use", (_label, text) => {
        expect(findUnusedKeys(["nav.home"], scan({texts: [text]}))).toEqual(["nav.home"]);
    });

    it("does not let a block consumer cover a nested key", () => {
        const texts = ["const b = catalog.nav; b.home;"];
        expect(findUnusedKeys(["nav.menu.home"], scan({texts}))).toEqual(["nav.menu.home"]);
    });

    it.each([
        ["no catalog keys", [] as string[], scan()],
        ["no source files", ["nav.home"], scan({texts: []})],
    ])("fails closed with %s", (_label, keys, input) => {
        expect(() => findUnusedKeys(keys, input)).toThrow(ReportBasisError);
    });

    it("gives the same answer for any input order", () => {
        const keys = ["b.two", "a.one", "c.three"];
        const first = findUnusedKeys(keys, scan());
        expect(findUnusedKeys([...keys].reverse(), scan())).toEqual(first);
        expect(first).toEqual(["a.one", "b.two", "c.three"]);
    });
});

describe("agedUnusedKeys (#3444)", () => {
    it(`keeps only keys that existed ${AGE_DAYS} days ago`, () => {
        expect(agedUnusedKeys(["a.old", "a.new"], new Set(["a.old", "a.used"]))).toEqual(["a.old"]);
    });

    it("fails closed without an old catalog (shallow clone, wrong ref)", () => {
        expect(() => agedUnusedKeys(["a.old"], new Set())).toThrow(ReportBasisError);
    });
});

describe("renderReport (#3444)", () => {
    it("states what it checked and groups the keys by block", () => {
        const body = renderReport(
            ["nav.gone", "app.old", "nav.away"],
            {keysChecked: 3988, filesScanned: 1646, unused: 224, aged: 3},
            "abc1234",
        );
        expect(body).toContain("Checked 3988 keys of the English catalog against 1646 source files");
        expect(body).toContain("224 without a consumer, 3 of them older than 14 days");
        expect(body.indexOf("<code>app</code> (1)")).toBeLessThan(body.indexOf("<code>nav</code> (2)"));
        expect(body).toContain("- `nav.away`");
    });
});
