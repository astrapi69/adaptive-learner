import {describe, it, expect} from "vitest";

import {TypedTreeNode} from "./TypedTreeNode";

interface Topic {
    title: string;
}

describe("TypedTreeNode.of()", () => {
    it("constructs a single-node tree", () => {
        const root = TypedTreeNode.of<Topic>({
            id: "r",
            value: {title: "Root"},
            children: [],
        });
        expect(root.id).toBe("r");
        expect(root.value.title).toBe("Root");
        expect(root.isRoot()).toBe(true);
        expect(root.isLeaf()).toBe(true);
        expect(root.depth()).toBe(0);
        expect(root.count()).toBe(1);
    });

    it("constructs a deep tree and reports structure", () => {
        const root = TypedTreeNode.of<Topic>({
            id: "r",
            value: {title: "Root"},
            children: [
                {
                    id: "c1",
                    value: {title: "Child 1"},
                    children: [{id: "g1", value: {title: "Grand 1"}, children: []}],
                },
                {id: "c2", value: {title: "Child 2"}, children: []},
            ],
        });
        expect(root.isLeaf()).toBe(false);
        expect(root.count()).toBe(4);
        const c1 = root.find((n) => n.id === "c1")!;
        expect(c1.isLeaf()).toBe(false);
        expect(c1.depth()).toBe(1);
        expect(c1.parent()?.id).toBe("r");
        const g1 = root.find((n) => n.id === "g1")!;
        expect(g1.isLeaf()).toBe(true);
        expect(g1.depth()).toBe(2);
        expect(g1.path().map((n) => n.id)).toEqual(["r", "c1", "g1"]);
    });
});

describe("TypedTreeNode display + traversal", () => {
    const root = TypedTreeNode.of<Topic>(
        {
            id: "r",
            value: {title: "Root"},
            children: [
                {
                    id: "c1",
                    value: {title: "Alpha"},
                    children: [{id: "g1", value: {title: "Alpha-1"}, children: []}],
                },
                {id: "c2", value: {title: "Beta"}, children: []},
            ],
        },
        (v) => v.title,
    );

    it("displayValue() uses the formatter from of()", () => {
        expect(root.displayValue()).toBe("Root");
        const g1 = root.find((n) => n.id === "g1")!;
        expect(g1.displayValue()).toBe("Alpha-1");
    });

    it("displayValue() accepts an override formatter", () => {
        expect(root.displayValue((v) => v.title.toUpperCase())).toBe("ROOT");
    });

    it("walk() pre-order visits parents before children", () => {
        const seen: string[] = [];
        root.walk((n) => {
            seen.push(String(n.id));
        });
        expect(seen).toEqual(["r", "c1", "g1", "c2"]);
    });

    it("walk() breadth-first visits one level at a time", () => {
        const seen: string[] = [];
        root.walk((n) => {
            seen.push(String(n.id));
        }, "breadth");
        expect(seen).toEqual(["r", "c1", "c2", "g1"]);
    });

    it("walk() post-order visits children before parents", () => {
        const seen: string[] = [];
        root.walk((n) => {
            seen.push(String(n.id));
        }, "post");
        // post-order means leaves first, then parents. For this
        // tree: g1 (leaf), c1 (parent of g1), c2 (leaf), r.
        expect(seen).toEqual(["g1", "c1", "c2", "r"]);
    });

    it("walk() halts entirely when the visitor returns false", () => {
        // tree-model's walk treats a strict ``false`` return as a
        // global stop signal — not "skip this subtree". Documenting
        // the contract here: callers that want skip-subtree should
        // gate their own work inside the visitor and keep returning
        // ``true``; callers that want full-halt return ``false``.
        const seen: string[] = [];
        root.walk((n) => {
            seen.push(String(n.id));
            if (n.id === "c1") return false;
            return true;
        });
        expect(seen).toContain("c1");
        expect(seen).not.toContain("g1");
        expect(seen).not.toContain("c2");
    });

    it("find() returns the first match in pre-order", () => {
        const node = root.find((n) => n.value.title.startsWith("Alpha"));
        expect(node?.id).toBe("c1");
    });

    it("find() returns undefined when no match", () => {
        expect(root.find((n) => n.id === "missing")).toBeUndefined();
    });

    it("findAll() returns every match", () => {
        const matches = root.findAll((n) => n.value.title.startsWith("Alpha"));
        expect(matches.map((m) => m.id)).toEqual(["c1", "g1"]);
    });

    it("children() returns DIRECT children only", () => {
        const direct = root.children();
        expect(direct.map((c) => c.id)).toEqual(["c1", "c2"]);
    });

    it("childIndex() returns the parent-relative position", () => {
        const c2 = root.find((n) => n.id === "c2")!;
        expect(c2.childIndex()).toBe(1);
        expect(root.find((n) => n.id === "c1")!.childIndex()).toBe(0);
    });

    it("toRow() returns a deep clone of the underlying structure", () => {
        const dump = root.toRow();
        expect(dump.id).toBe("r");
        expect(dump.children).toHaveLength(2);
        expect(dump.children[0].children[0].id).toBe("g1");
        // Mutating the dump must NOT touch the original.
        dump.children = [];
        expect(root.count()).toBe(4);
    });
});

describe("TypedTreeNode typed IDs", () => {
    type TopicId = string & {readonly __brand: "TopicId"};
    const mkId = (s: string) => s as TopicId;

    it("preserves branded id types through traversal", () => {
        const root = TypedTreeNode.of<Topic, TopicId>({
            id: mkId("r"),
            value: {title: "Root"},
            children: [{id: mkId("c"), value: {title: "Child"}, children: []}],
        });
        const child = root.find((n) => n.id === mkId("c"));
        expect(child).toBeDefined();
        // The id retains its branded type at compile time; at
        // runtime we just verify the value round-trips.
        const id: TopicId = child!.id;
        expect(id).toBe("c");
    });
});
