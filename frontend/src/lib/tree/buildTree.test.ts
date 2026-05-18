import {describe, it, expect} from "vitest";

import {buildTreeFromFlat} from "./buildTree";

interface Topic {
    id: string;
    parentId: string | null;
    title: string;
    orderIndex: number;
}

const ROWS: Topic[] = [
    {id: "r1", parentId: null, title: "Root 1", orderIndex: 0},
    {id: "r2", parentId: null, title: "Root 2", orderIndex: 1},
    {id: "c1", parentId: "r1", title: "Child A", orderIndex: 1},
    {id: "c2", parentId: "r1", title: "Child B", orderIndex: 0},
    {id: "g1", parentId: "c2", title: "Grandchild", orderIndex: 0},
];

describe("buildTreeFromFlat()", () => {
    it("builds a forest preserving insertion order when no sort", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, {
            getId: (r) => r.id,
            getParentId: (r) => r.parentId,
            formatter: (v) => v.title,
        });
        expect(forest).toHaveLength(2);
        expect(forest.map((n) => n.id)).toEqual(["r1", "r2"]);

        const r1 = forest[0];
        const directChildren = r1.children();
        // Insertion order: c1 then c2 (the order rows appear in
        // the input list); no orderIndex sort applied yet.
        expect(directChildren.map((n) => n.id)).toEqual(["c1", "c2"]);
    });

    it("sorts siblings via the sort comparator", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, {
            getId: (r) => r.id,
            getParentId: (r) => r.parentId,
            sort: (a, b) => a.orderIndex - b.orderIndex,
        });
        const r1 = forest[0];
        const children = r1.children();
        // orderIndex: c2=0 comes before c1=1.
        expect(children.map((n) => n.id)).toEqual(["c2", "c1"]);
    });

    it("returns an empty array for an empty input", () => {
        const forest = buildTreeFromFlat<Topic, string>([], {
            getId: (r) => r.id,
            getParentId: (r) => r.parentId,
        });
        expect(forest).toEqual([]);
    });

    it("rejects duplicate ids loudly", () => {
        const bad: Topic[] = [
            {id: "x", parentId: null, title: "first", orderIndex: 0},
            {id: "x", parentId: null, title: "dup", orderIndex: 1},
        ];
        expect(() =>
            buildTreeFromFlat<Topic, string>(bad, {
                getId: (r) => r.id,
                getParentId: (r) => r.parentId,
            }),
        ).toThrow(/duplicate id x/);
    });

    it("rejects unknown parent references loudly", () => {
        const bad: Topic[] = [
            {id: "c", parentId: "missing", title: "orphan", orderIndex: 0},
        ];
        expect(() =>
            buildTreeFromFlat<Topic, string>(bad, {
                getId: (r) => r.id,
                getParentId: (r) => r.parentId,
            }),
        ).toThrow(/unknown parent missing/);
    });

    it("rejects cycles", () => {
        // a -> b -> c -> a: no root, every row is linked to a
        // parent that doesn't reach the top.
        const cyclic: Topic[] = [
            {id: "a", parentId: "c", title: "a", orderIndex: 0},
            {id: "b", parentId: "a", title: "b", orderIndex: 0},
            {id: "c", parentId: "b", title: "c", orderIndex: 0},
        ];
        expect(() =>
            buildTreeFromFlat<Topic, string>(cyclic, {
                getId: (r) => r.id,
                getParentId: (r) => r.parentId,
            }),
        ).toThrow(/cycle or orphan/);
    });

    it("supports number ids", () => {
        const numeric = [
            {id: 1, parentId: null, label: "root"},
            {id: 2, parentId: 1, label: "child"},
        ];
        const forest = buildTreeFromFlat<typeof numeric[number], number>(numeric, {
            getId: (r) => r.id,
            getParentId: (r) => r.parentId,
        });
        expect(forest).toHaveLength(1);
        const child = forest[0].find((n) => n.id === 2);
        expect(child?.value.label).toBe("child");
    });

    it("supports a single deep chain", () => {
        const chain: Topic[] = [
            {id: "a", parentId: null, title: "a", orderIndex: 0},
            {id: "b", parentId: "a", title: "b", orderIndex: 0},
            {id: "c", parentId: "b", title: "c", orderIndex: 0},
            {id: "d", parentId: "c", title: "d", orderIndex: 0},
        ];
        const forest = buildTreeFromFlat<Topic, string>(chain, {
            getId: (r) => r.id,
            getParentId: (r) => r.parentId,
        });
        expect(forest).toHaveLength(1);
        const leaf = forest[0].find((n) => n.id === "d")!;
        expect(leaf.depth()).toBe(3);
        expect(leaf.path().map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
    });
});
