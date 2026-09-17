/** Tests for AIV-07 (#3060): planning, applying and undoing AI-check suggestions. */

import {describe, expect, it} from "vitest";

import type {ContentLesson, ContentSetEntry} from "../../../storage/types";
import type {ValidationResult} from "../../ai/validation/content-validator";
import {applyFixes, buildResaveInput, planFixes, undoFixes} from "./ai-fix";

function lesson(id: string, cards: ContentLesson["cards"]): ContentLesson {
    return {
        id,
        title: `Lektion ${id}`,
        estimated_minutes: 5,
        cards,
        steps: [],
    } as unknown as ContentLesson;
}

const LESSONS: ContentLesson[] = [
    lesson("01", [
        {id: "c1", front: "libro", back: "Buch", tags: []},
        {id: "c2", front: "casa", back: "Haus", notes: "f.", tags: []},
    ] as unknown as ContentLesson["cards"]),
    lesson("02", [{id: "c3", front: "perro", back: "Hund", tags: []}] as unknown as ContentLesson["cards"]),
];

const ENTRY: ContentSetEntry = {
    source: "user-generated",
    branch: "",
    id: "my-set",
    title: "Meine Tiere",
    title_native: "Mis animales",
    language: "es",
    target_language: "es",
    source_language: "de",
    level: "A1",
    domain: "imported",
    version: "1.0.0",
    lesson_count: 2,
    description: "Eigene Karten",
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    book: {title: "Ein Buch", author: "Jemand"} as unknown as ContentSetEntry["book"],
    attribution: {origin_source: "x"} as unknown as ContentSetEntry["attribution"],
};

const RESULTS: ValidationResult[] = [
    {card_id: "c1", ok: true, issues: []},
    {
        card_id: "c2",
        ok: false,
        issues: [
            {field: "front", problem: "Artikel fehlt", suggestion: "la casa"},
            {field: "back", problem: "Tippfehler", suggestion: "Haus"},
            {field: "tags", problem: "fehlt", suggestion: "Substantiv"},
            {field: "notes", problem: "unklar", suggestion: ""},
        ],
    },
    {card_id: "c3", ok: false, issues: [{field: "back", problem: "Genus", suggestion: "der Hund"}]},
    {card_id: "ghost", ok: false, issues: [{field: "front", problem: "x", suggestion: "y"}]},
];

describe("planFixes (#3060)", () => {
    it("turns field suggestions on known cards into candidates and keeps the rest manual", () => {
        const plan = planFixes(RESULTS, LESSONS);
        expect(plan.candidates.map((c) => [c.cardId, c.field, c.before, c.after])).toEqual([
            ["c2", "front", "casa", "la casa"],
            ["c3", "back", "Hund", "der Hund"],
        ]);
        expect(plan.candidates[0]).toMatchObject({lessonId: "01", lessonTitle: "Lektion 01", front: "casa"});
        // Same value, unknown field, empty suggestion, unknown card: never applied.
        expect(plan.manual.map((m) => [m.cardId, m.field])).toEqual([
            ["c2", "tags"],
            ["c2", "notes"],
            ["ghost", "front"],
        ]);
    });

    it("gives every candidate a stable unique key", () => {
        const keys = planFixes(RESULTS, LESSONS).candidates.map((c) => c.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys[0]).toBe("c2::front");
    });

    it("yields an empty plan for an all-ok report", () => {
        expect(planFixes([{card_id: "c1", ok: true, issues: []}], LESSONS)).toEqual({
            candidates: [],
            manual: [],
        });
    });
});

describe("buildResaveInput (#3060)", () => {
    it("carries every catalog field of the set into the write input", () => {
        const input = buildResaveInput(ENTRY, LESSONS);
        expect(input).toMatchObject({
            set_id: "my-set",
            title: "Meine Tiere",
            title_native: "Mis animales",
            language: "es",
            target_language: "es",
            source_language: "de",
            level: "A1",
            origin: "imported",
            description: "Eigene Karten",
            book: ENTRY.book,
            attribution: ENTRY.attribution,
        });
        expect(input.lessons).toHaveLength(2);
    });

    it("falls back to the imported origin when the entry's domain is not an origin", () => {
        expect(buildResaveInput({...ENTRY, domain: "language"}, LESSONS).origin).toBe("imported");
        expect(buildResaveInput({...ENTRY, domain: "adaptive"}, LESSONS).origin).toBe("adaptive");
    });
});

describe("applyFixes + undoFixes (#3060)", () => {
    it("patches only the selected fields, keeps ids, and records a snapshot", () => {
        const plan = planFixes(RESULTS, LESSONS);
        const selected = plan.candidates.filter((c) => c.cardId === "c2");
        const {input, snapshot} = applyFixes(ENTRY, LESSONS, selected, "2026-09-09T12:00:00Z");
        const c2 = input.lessons[0].cards.find((c) => c.id === "c2");
        expect(c2?.front).toBe("la casa");
        expect(c2?.back).toBe("Haus");
        expect(input.lessons[1].cards[0].back).toBe("Hund");
        expect(input.lessons[0].cards.map((c) => c.id)).toEqual(["c1", "c2"]);
        // The caller's lessons are not mutated.
        expect(LESSONS[0].cards[1].front).toBe("casa");
        expect(snapshot).toEqual({
            source: "user-generated",
            setId: "my-set",
            appliedAt: "2026-09-09T12:00:00Z",
            changes: [{lessonId: "01", cardId: "c2", field: "front", before: "casa", after: "la casa"}],
        });
    });

    it("undo restores the recorded value only where the applied value is still in place", () => {
        const plan = planFixes(RESULTS, LESSONS);
        const {input, snapshot} = applyFixes(ENTRY, LESSONS, plan.candidates, "2026-09-09T12:00:00Z");
        const edited = structuredClone(input.lessons);
        // The learner edited c3 after the fix: that field must stay as edited.
        edited[1].cards[0].back = "der Hund (m.)";
        const undone = undoFixes(ENTRY, edited, snapshot);
        expect(undone.restored).toBe(1);
        expect(undone.input.lessons[0].cards[1].front).toBe("casa");
        expect(undone.input.lessons[1].cards[0].back).toBe("der Hund (m.)");
    });
});
