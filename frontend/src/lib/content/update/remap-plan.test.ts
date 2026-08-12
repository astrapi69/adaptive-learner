/**
 * #2308 Weg C — the derivation that turns an orphaning update into a
 * proposed re-keying.
 *
 * The two "uncertain" cases below are not invented: they are the only two
 * events of their kind found in the whole content history (#2301, measured
 * over 9 repos / 312 commits). Both MUST come out uncertain, because both are
 * exactly the shape a position-only key would attach to the wrong element.
 */

import {describe, expect, it} from "vitest";
import {planElementKeyRemaps} from "./remap-plan";
import type {PeekLesson} from "./update-impact";

const SET = "es-a1";
const L = "01.json";

function lesson(exercises: PeekLesson["exercises"]): PeekLesson[] {
    return [{filename: L, exercises}];
}

const srs = (element_key: string, exercise_id = "ex-1") => ({
    lesson_id: L,
    exercise_id,
    element_key,
});

describe("planElementKeyRemaps: the correction-at-a-fixed-position case", () => {
    it("maps an edited answer onto its replacement (the 186-slot majority)", () => {
        const old = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "こんにちは", right: "hallo"},
                {left: "おはよう", right: "guten Morgen"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "こんにちは (konnichiwa)", right: "hallo"},
                {left: "おはよう (ohayou)", right: "guten Morgen"},
            ]},
        ]);
        const plan = planElementKeyRemaps(
            [srs("こんにちは"), srs("おはよう")],
            old,
            incoming,
            SET,
        );
        expect(plan.uncertain).toEqual([]);
        expect(plan.certain).toEqual([
            {set_id: SET, lesson_id: L, exercise_id: "ex-1",
             old: "こんにちは", new: "こんにちは (konnichiwa)"},
            {set_id: SET, lesson_id: L, exercise_id: "ex-1",
             old: "おはよう", new: "おはよう (ohayou)"},
        ]);
    });

    it("proposes nothing for a row whose key still resolves", () => {
        const both = lesson([
            {id: "ex-1", type: "free_text", accept: ["Merci"]},
        ]);
        const plan = planElementKeyRemaps([srs("Merci")], both, both, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toEqual([]);
    });
});

describe("planElementKeyRemaps: what must NOT be guessed", () => {
    it("a reorder is uncertain, never mapped (the 135c4442 event)", () => {
        // Two images were wrongly marked correct; taking the second one back
        // makes position 0 point at a DIFFERENT sentence. A position key would
        // silently move this learner's progress onto the other element.
        const old = lesson([
            {id: "ex-1", type: "picture_choice", images: [
                {label: "que je t'ai recommande", is_correct: "true", src: "a.png"},
                {label: "dont nous avons parle", is_correct: "true", src: "b.png"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "picture_choice", images: [
                {label: "dont nous avons parle", is_correct: "true", src: "b.png"},
                {label: "que je t'ai recommande", src: "a.png"},
            ]},
        ]);
        const plan = planElementKeyRemaps(
            [srs("que je t'ai recommande")],
            old,
            incoming,
            SET,
        );
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toHaveLength(1);
        expect(plan.uncertain[0].reason).toBe("reordered");
        expect(plan.uncertain[0].candidate).toBe("dont nous avons parle");
    });

    it("an insertion is uncertain, never mapped (the bc582f1d event)", () => {
        const old = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "Ankereffekt", right: "a"},
                {left: "Hinterfragen und Fachwissen", right: "b"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "Ankereffekt", right: "a"},
                {left: "Erstes Angebot", right: "c"},
                {left: "Hinterfragen und Fachwissen", right: "b"},
            ]},
        ]);
        const plan = planElementKeyRemaps(
            [srs("Hinterfragen und Fachwissen")],
            old,
            incoming,
            SET,
        );
        // The key still resolves here (it only moved), so there is nothing to
        // rescue - but the list length changed, so nothing may be inferred
        // from position either.
        expect(plan.certain).toEqual([]);
    });

    it("a length change with a genuinely lost key is uncertain, not mapped", () => {
        const old = lesson([
            {id: "ex-1", type: "cloze", blanks: [
                {accept: ["suis"]}, {accept: ["tres"]},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "cloze", blanks: [{accept: ["bin"]}]},
        ]);
        const plan = planElementKeyRemaps([srs("suis")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("shifted");
    });

    it("an exercise type the rule does not know yields no mapping", () => {
        const old = lesson([{id: "ex-1", type: "ext:acme-ordering"}]);
        const incoming = lesson([{id: "ex-1", type: "ext:acme-ordering"}]);
        const plan = planElementKeyRemaps([srs("whatever")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("unknown_type");
    });

    it("a vanished exercise is uncertain, not mapped onto a neighbour", () => {
        const old = lesson([{id: "ex-1", type: "free_text", accept: ["Merci"]}]);
        const incoming = lesson([{id: "ex-2", type: "free_text", accept: ["Danke"]}]);
        const plan = planElementKeyRemaps([srs("Merci")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("exercise_gone");
    });

    it("a vanished lesson is uncertain, not mapped", () => {
        const old = lesson([{id: "ex-1", type: "free_text", accept: ["Merci"]}]);
        const plan = planElementKeyRemaps([srs("Merci")], old, [], SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("lesson_gone");
    });

    it("a key that is not in the cached version either is uncertain", () => {
        // The learner's row predates the cached content (an earlier update
        // already moved it). There is no position to read, so there is
        // nothing to infer.
        const old = lesson([{id: "ex-1", type: "free_text", accept: ["Merci"]}]);
        const incoming = lesson([{id: "ex-1", type: "free_text", accept: ["Merci!"]}]);
        const plan = planElementKeyRemaps([srs("Gracias")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("not_in_cached");
    });
});

describe("planElementKeyRemaps: shape guarantees", () => {
    it("never proposes two mappings onto the same new key", () => {
        // Both old keys would land on the same replacement; mapping both would
        // collapse two learner rows onto one. The remap primitive skips the
        // second, but the PLAN must not offer it in the first place.
        const old = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "a", right: "x"}, {left: "b", right: "y"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "c", right: "x"}, {left: "c", right: "y"},
            ]},
        ]);
        const plan = planElementKeyRemaps([srs("a"), srs("b")], old, incoming, SET);
        const targets = plan.certain.map((r) => r.new);
        expect(new Set(targets).size).toBe(targets.length);
    });

    it("is deterministic and side-effect free", () => {
        const old = lesson([{id: "ex-1", type: "free_text", accept: ["A"]}]);
        const incoming = lesson([{id: "ex-1", type: "free_text", accept: ["B"]}]);
        const first = planElementKeyRemaps([srs("A")], old, incoming, SET);
        const second = planElementKeyRemaps([srs("A")], old, incoming, SET);
        expect(first).toEqual(second);
    });

    it("returns empty for no identities (nothing to rescue, nothing to ask)", () => {
        const l = lesson([{id: "ex-1", type: "free_text", accept: ["A"]}]);
        expect(planElementKeyRemaps([], l, l, SET)).toEqual({
            certain: [],
            uncertain: [],
        });
    });
});

// --- #2130 stable_id key switch --------------------------------------------

describe("planElementKeyRemaps with stable_id-keyed rows (#2130)", () => {
    it("finds the exercise via stable_id and proposes the corrected key", () => {
        const cached = [{
            filename: "01.json",
            exercises: [{
                id: "ex-match-1",
                stable_id: "greetings-match-x7",
                type: "matching",
                pairs: [{left: "こんにちわ", right: "hallo"}],
            }],
        }];
        const incoming = [{
            filename: "01.json",
            exercises: [{
                id: "ex-match-1-renamed",
                stable_id: "greetings-match-x7",
                type: "matching",
                pairs: [{left: "こんにちは", right: "hallo"}],
            }],
        }];
        const plan = planElementKeyRemaps(
            [{lesson_id: "01.json", exercise_id: "greetings-match-x7", element_key: "こんにちわ"}],
            cached,
            incoming,
            "ja-a1",
        );
        expect(plan.uncertain).toEqual([]);
        expect(plan.certain).toEqual([{
            set_id: "ja-a1",
            lesson_id: "01.json",
            exercise_id: "greetings-match-x7",
            old: "こんにちわ",
            new: "こんにちは",
        }]);
    });
});

// --- engine#91 element-level stable_id key switch ---------------------------

describe("planElementKeyRemaps with element-level stable_id (engine#91)", () => {
    it("a text correction under an existing element stable_id proposes NOTHING - the row's identity key still resolves, nothing looks changed", () => {
        const old = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "bonjour", right: "hallo", stable_id: "pair-aaaa0001"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "bonjour (corrige)", right: "hallo", stable_id: "pair-aaaa0001"},
            ]},
        ]);
        // The row's element_key is already the stable_id (it was recorded
        // after the element-identity switch shipped).
        const plan = planElementKeyRemaps([srs("pair-aaaa0001")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toEqual([]);
    });

    it("the mint transition (old key = content text, new key = fresh stable_id) classifies as a normal certain correction", () => {
        const old = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "bonjour", right: "hallo"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "matching", pairs: [
                {left: "bonjour", right: "hallo", stable_id: "pair-aaaa0001"},
            ]},
        ]);
        const plan = planElementKeyRemaps([srs("bonjour")], old, incoming, SET);
        expect(plan.uncertain).toEqual([]);
        expect(plan.certain).toEqual([
            {set_id: SET, lesson_id: L, exercise_id: "ex-1", old: "bonjour", new: "pair-aaaa0001"},
        ]);
    });

    it("a text correction under an existing blank stable_id proposes nothing (cloze, mirrors the matching case)", () => {
        const old = lesson([
            {id: "ex-1", type: "cloze", blanks: [
                {accept: ["suis"], stable_id: "blank-aaaa0001"},
            ]},
        ]);
        const incoming = lesson([
            {id: "ex-1", type: "cloze", blanks: [
                {accept: ["suis (variante)"], stable_id: "blank-aaaa0001"},
            ]},
        ]);
        const plan = planElementKeyRemaps([srs("blank-aaaa0001")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toEqual([]);
    });
});
