/**
 * Learning-path layout + edges (Phase 66D / EXP-022).
 *
 * Pure helpers (no React): dagre auto-layout, edge construction with
 * per-state styling, and localStorage persistence of the user's
 * custom node positions. Kept React-free so the graph builder (66E)
 * and tests can use them directly.
 */

import dagre from "dagre";
import type {Edge, Node} from "@xyflow/react";

export interface LayoutOpts {
    /** "TB" = top-to-bottom (within a set), "LR" = left-to-right. */
    direction?: "TB" | "LR";
    nodeWidth?: number;
    nodeHeight?: number;
}

const DEFAULT_W = 190;
const DEFAULT_H = 95;

/** dagre auto-layout. Pure: returns new nodes with computed
 *  positions; the input is not mutated. Nodes without edges still
 *  get placed (dagre ranks isolated nodes too). */
export function layoutGraph(
    nodes: Node[],
    edges: Edge[],
    opts: LayoutOpts = {},
): Node[] {
    const {direction = "TB", nodeWidth = DEFAULT_W, nodeHeight = DEFAULT_H} =
        opts;
    const g = new dagre.graphlib.Graph();
    g.setGraph({rankdir: direction, nodesep: 50, ranksep: 70, marginx: 20, marginy: 20});
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of nodes) {
        g.setNode(n.id, {
            width: (n.width as number | undefined) ?? nodeWidth,
            height: (n.height as number | undefined) ?? nodeHeight,
        });
    }
    for (const e of edges) {
        if (g.hasNode(e.source) && g.hasNode(e.target)) {
            g.setEdge(e.source, e.target);
        }
    }
    dagre.layout(g);
    return nodes.map((n) => {
        const p = g.node(n.id);
        if (!p) return n;
        const w = (n.width as number | undefined) ?? nodeWidth;
        const h = (n.height as number | undefined) ?? nodeHeight;
        // dagre returns center coords; React Flow wants top-left.
        return {...n, position: {x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2)}};
    });
}

export type LearningPathEdgeKind = "completed" | "upcoming" | "adaptive";

/** Build a styled edge. ``completed`` = solid success, ``upcoming``
 *  = dashed muted, ``adaptive`` = animated dashed accent (the
 *  recommendation pointer). Colours come from CSS classes so they
 *  stay theme-aware. */
export function makeEdge(
    id: string,
    source: string,
    target: string,
    kind: LearningPathEdgeKind,
): Edge {
    return {
        id,
        source,
        target,
        className: `lp-edge lp-edge--${kind}`,
        animated: kind === "adaptive",
        data: {kind},
    };
}

// --- custom-position persistence (localStorage, per user) ----------

const POS_PREFIX = "adaptive-learner.learning-path-positions";

export interface StoredPositions {
    [nodeId: string]: {x: number; y: number};
}

function posKey(userId: string): string {
    return `${POS_PREFIX}:${userId || "anon"}`;
}

export function savePositions(userId: string, positions: StoredPositions): void {
    try {
        localStorage.setItem(posKey(userId), JSON.stringify(positions));
    } catch {
        /* best-effort */
    }
}

export function loadPositions(userId: string): StoredPositions | null {
    try {
        const raw = localStorage.getItem(posKey(userId));
        return raw ? (JSON.parse(raw) as StoredPositions) : null;
    } catch {
        return null;
    }
}

export function clearPositions(userId: string): void {
    try {
        localStorage.removeItem(posKey(userId));
    } catch {
        /* ignore */
    }
}

/** Overlay stored custom positions onto auto-laid-out nodes. */
export function applyStoredPositions(
    nodes: Node[],
    positions: StoredPositions | null,
): Node[] {
    if (!positions) return nodes;
    return nodes.map((n) =>
        positions[n.id] ? {...n, position: positions[n.id]} : n,
    );
}

/** Snapshot the current node positions for persistence. */
export function snapshotPositions(nodes: Node[]): StoredPositions {
    const out: StoredPositions = {};
    for (const n of nodes) out[n.id] = {x: n.position.x, y: n.position.y};
    return out;
}
