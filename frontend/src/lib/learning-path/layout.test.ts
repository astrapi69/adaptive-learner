import {beforeEach, describe, expect, it} from "vitest";
import type {Edge, Node} from "@xyflow/react";

import {
    applyStoredPositions,
    clearPositions,
    layoutGraph,
    loadPositions,
    makeEdge,
    savePositions,
    snapshotPositions,
} from "./layout";

function node(id: string): Node {
    return {id, position: {x: 0, y: 0}, data: {}};
}

describe("layoutGraph", () => {
    it("assigns finite, distinct positions for a chain", () => {
        const nodes = [node("a"), node("b"), node("c")];
        const edges: Edge[] = [
            {id: "ab", source: "a", target: "b"},
            {id: "bc", source: "b", target: "c"},
        ];
        const out = layoutGraph(nodes, edges);
        for (const n of out) {
            expect(Number.isFinite(n.position.x)).toBe(true);
            expect(Number.isFinite(n.position.y)).toBe(true);
        }
        // Top-to-bottom: each later node is lower than the previous.
        expect(out[1].position.y).toBeGreaterThan(out[0].position.y);
        expect(out[2].position.y).toBeGreaterThan(out[1].position.y);
    });

    it("places isolated nodes without throwing", () => {
        const out = layoutGraph([node("solo")], []);
        expect(Number.isFinite(out[0].position.x)).toBe(true);
    });

    it("is deterministic", () => {
        const nodes = [node("a"), node("b")];
        const edges: Edge[] = [{id: "ab", source: "a", target: "b"}];
        expect(layoutGraph(nodes, edges)).toEqual(layoutGraph(nodes, edges));
    });
});

describe("makeEdge", () => {
    it("styles per kind", () => {
        expect(makeEdge("e", "a", "b", "completed").className).toContain(
            "lp-edge--completed",
        );
        expect(makeEdge("e", "a", "b", "upcoming").animated).toBe(false);
        const adaptive = makeEdge("e", "a", "b", "adaptive");
        expect(adaptive.animated).toBe(true);
        expect(adaptive.className).toContain("lp-edge--adaptive");
    });
});

describe("position persistence", () => {
    beforeEach(() => localStorage.clear());

    it("round-trips save → load → clear (per user)", () => {
        savePositions("u1", {a: {x: 10, y: 20}});
        expect(loadPositions("u1")).toEqual({a: {x: 10, y: 20}});
        expect(loadPositions("u2")).toBeNull(); // per-user isolation
        clearPositions("u1");
        expect(loadPositions("u1")).toBeNull();
    });

    it("applies + snapshots positions", () => {
        const nodes = [node("a"), node("b")];
        const applied = applyStoredPositions(nodes, {a: {x: 5, y: 6}});
        expect(applied[0].position).toEqual({x: 5, y: 6});
        expect(applied[1].position).toEqual({x: 0, y: 0});
        const moved = [{...node("a"), position: {x: 9, y: 9}}];
        expect(snapshotPositions(moved)).toEqual({a: {x: 9, y: 9}});
    });
});
