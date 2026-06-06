import {describe, expect, it} from "vitest";

import type {Subject} from "../../types/domain";
import {
    countProjectsPerSubject,
    groupSubjectsByCategory,
    rankSubjects,
    SUBJECT_GROUP_THRESHOLD,
} from "./subjectFilter";

function subject(id: string, name: string, parent_id: string | null = null): Subject {
    return {
        id,
        parent_id,
        name,
        description: null,
        icon: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    };
}

describe("countProjectsPerSubject", () => {
    it("counts how many projects carry each subject", () => {
        const byProject = new Map([
            ["p1", new Set(["a", "b"])],
            ["p2", new Set(["a"])],
            ["p3", new Set(["a", "c"])],
        ]);
        const counts = countProjectsPerSubject(byProject);
        expect(counts.get("a")).toBe(3);
        expect(counts.get("b")).toBe(1);
        expect(counts.get("c")).toBe(1);
    });
});

describe("rankSubjects", () => {
    it("sorts by usage descending, then by name", () => {
        const subjects = [
            subject("a", "Banana"),
            subject("b", "Apple"),
            subject("c", "Cherry"),
        ];
        const usage = new Map([
            ["a", 1],
            ["b", 1],
            ["c", 5],
        ]);
        const ranked = rankSubjects(subjects, usage);
        // Cherry (5) first; Apple/Banana tie at 1, broken by name.
        expect(ranked.map((s) => s.name)).toEqual(["Cherry", "Apple", "Banana"]);
    });

    it("does not mutate the input array", () => {
        const subjects = [subject("a", "A"), subject("b", "B")];
        const copy = [...subjects];
        rankSubjects(subjects, new Map());
        expect(subjects).toEqual(copy);
    });
});

describe("groupSubjectsByCategory", () => {
    it("groups leaves under their parent and orders by total usage", () => {
        const sci = subject("sci", "Sciences");
        const lang = subject("lang", "Languages");
        const chemistry = subject("chem", "Chemistry", "sci");
        const physics = subject("phys", "Physics", "sci");
        const french = subject("fr", "French", "lang");
        const all = [sci, lang, chemistry, physics, french];
        const usage = new Map([
            ["chem", 1],
            ["phys", 1],
            ["fr", 5],
        ]);
        const ranked = rankSubjects([chemistry, physics, french], usage);
        const groups = groupSubjectsByCategory(ranked, all, usage);

        // Languages (total 5) ranks above Sciences (total 2).
        expect(groups.map((g) => g.categoryName)).toEqual([
            "Languages",
            "Sciences",
        ]);
        expect(groups[0].subjects.map((s) => s.name)).toEqual(["French"]);
        expect(groups[1].subjects.map((s) => s.name)).toEqual([
            "Chemistry",
            "Physics",
        ]);
    });

    it("treats a used top-level subject as its own category", () => {
        const sci = subject("sci", "Sciences");
        const groups = groupSubjectsByCategory(
            [sci],
            [sci],
            new Map([["sci", 2]]),
        );
        expect(groups).toHaveLength(1);
        expect(groups[0].categoryId).toBe("sci");
        expect(groups[0].subjects).toEqual([sci]);
    });
});

describe("SUBJECT_GROUP_THRESHOLD", () => {
    it("groups only past a flat-list-friendly size", () => {
        expect(SUBJECT_GROUP_THRESHOLD).toBe(5);
    });
});
