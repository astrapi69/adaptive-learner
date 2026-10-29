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
    extractKeyTemplates,
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

describe("extractKeyTemplates (#3709)", () => {
    it("finds a key built in a template outside t() (edit-error-keys.ts)", () => {
        const source = "export function k(code) { return `create_lesson.exercises.edit.err_${code}`; }";
        const patterns = extractKeyTemplates(source);
        expect(patterns).toEqual([{prefix: "create_lesson.exercises.edit.err_", suffix: ""}]);
        expect(
            findUnusedKeys(["create_lesson.exercises.edit.err_prompt"], scan({dynamicPatterns: patterns})),
        ).toEqual([]);
    });

    it("matches a key built with two interpolations (direction.ts)", () => {
        const source = "return `lesson.exercise.instruction.${exerciseType}.${mode}`;";
        const patterns = extractKeyTemplates(source);
        const keys = ["lesson.exercise.instruction.matching.productive", "lesson.other.key"];
        expect(findUnusedKeys(keys, scan({dynamicPatterns: patterns}))).toEqual(["lesson.other.key"]);
    });

    it("matches a t() pattern with two interpolations as well", () => {
        const pattern = {prefix: "lesson.exercise.instruction.", suffix: ".${mode}"};
        const keys = ["lesson.exercise.instruction.word_tiles.receptive"];
        expect(findUnusedKeys(keys, scan({dynamicPatterns: [pattern]}))).toEqual([]);
    });

    it.each([
        ["a template without a key-path prefix", "const url = `${base}/api/${id}`;"],
        ["a template whose prefix has no dot", "const label = `item_${n}`;"],
        ["a plain string", "const k = 'nav.home';"],
    ])("ignores %s", (_label, source) => {
        expect(extractKeyTemplates(source)).toEqual([]);
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
    it("says that the keys are candidates and why each one is checked before removal", () => {
        const body = renderReport(["nav.gone"], {keysChecked: 1, filesScanned: 1, unused: 1, aged: 1}, "abc1234");
        expect(body).toContain("Every key below is a candidate, not a finding.");
        expect(body).toContain("keys composed at run time");
        expect(body).toContain("error codes the backend returns");
        expect(body).toContain("a consumer shape the detector does not read reports a used key as unused");
        expect(body).toContain("#3714 found 27 such keys before anything was removed");
    });


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
