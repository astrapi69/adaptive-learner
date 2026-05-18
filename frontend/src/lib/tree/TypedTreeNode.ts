/**
 * TypedTreeNode<V, K> — generic, typed tree-node adapter.
 *
 * Wraps the `tree-model` npm package's traversal engine
 * (https://github.com/joaonuno/tree-model-js, MIT, ~500 LOC) and
 * adds a thin typed surface over it:
 *
 *   - Typed IDs (K = string by default but free to be number /
 *     branded string / etc.) so a LearningTopic tree's IDs cannot
 *     accidentally cross with a Curriculum tree's IDs.
 *   - displayValue() formatter hook for rendering.
 *   - leaf detection.
 *   - Visitor callbacks (pre / post / breadth strategies passed
 *     through verbatim to tree-model).
 *   - Convenience find / findAll / path / depth.
 *
 * Companion `buildTreeFromFlat` (see ./buildTree.ts) handles the
 * common case of converting a flat list of records keyed by
 * (id, parentId) — e.g. the LearningTopic rows returned by the
 * Curriculum API — into a forest of TypedTreeNodes.
 *
 * Why not roll our own tree from scratch: tree-model already
 * carries pre/post/breadth traversal, getPath, drop, addChild and
 * a stable model-comparator hook. Re-implementing those is a
 * solved-problem expense the project doesn't need to pay.
 *
 * Source: hybrid port of astrapi69's Java tree-api + gen-tree
 * libraries (project-reference §5.2), trimmed to what the
 * Adaptive Learner curriculum + skill-tree use cases need.
 */

import TreeModel from "tree-model";

/**
 * Strategy passed to tree-model.walk / all / first. ``pre`` is
 * depth-first pre-order (parents before children), ``post`` is
 * depth-first post-order (children before parents), ``breadth``
 * is BFS (level by level).
 */
export type TraversalStrategy = "pre" | "post" | "breadth";

/**
 * Visitor signature: return ``false`` to stop the walk early
 * (matches tree-model's convention). Returning ``undefined`` /
 * ``true`` continues the walk.
 */
export type Visitor<V, K> = (node: TypedTreeNode<V, K>) => boolean | void;

/**
 * Function that produces the human-readable label for a value.
 * Defaults to ``String(value)`` when the caller doesn't override.
 */
export type DisplayFormatter<V> = (value: V) => string;

/**
 * The shape tree-model stores per node. ``id`` is the typed key,
 * ``value`` is the user's payload, ``children`` is the recursive
 * array tree-model walks. Keep the children array under the
 * default ``children`` key so we don't need to configure
 * ``childrenPropertyName`` on the TreeModel instance.
 */
export interface TreeRow<V, K> {
    id: K;
    value: V;
    children: TreeRow<V, K>[];
}

const MODEL = new TreeModel();

/**
 * Generic typed tree node. ``V`` is the payload type, ``K`` is the
 * id type (string by default). Construct directly via
 * ``TypedTreeNode.of(...)`` or via the ``buildTreeFromFlat`` helper.
 *
 * Tree-model's mutation API (addChild, drop) is intentionally
 * NOT re-exported here — the tree is built once via
 * ``buildTreeFromFlat`` and consumed read-only by the React UI.
 * Adding a typed addChild later is straightforward when an editor
 * surface needs it.
 */
export class TypedTreeNode<V, K = string> {
    /**
     * The underlying tree-model node. ``model`` carries our
     * ``TreeRow<V, K>``; tree-model stores it verbatim and only
     * touches the ``children`` array for traversal.
     */
    private readonly _node: TreeModel.Node<TreeRow<V, K>>;

    private readonly _formatter: DisplayFormatter<V>;

    private constructor(node: TreeModel.Node<TreeRow<V, K>>, formatter: DisplayFormatter<V>) {
        this._node = node;
        this._formatter = formatter;
    }

    /**
     * Construct a TypedTreeNode from a TreeRow-shaped object.
     * Recursively builds children. Used by ``buildTreeFromFlat``
     * and by tests; application code prefers the builder.
     */
    static of<V, K = string>(
        row: TreeRow<V, K>,
        formatter: DisplayFormatter<V> = (v) => String(v),
    ): TypedTreeNode<V, K> {
        const node = MODEL.parse(row);
        return new TypedTreeNode<V, K>(node, formatter);
    }

    // --- Identity / payload ------------------------------------------------

    /** Typed id of this node. */
    get id(): K {
        return this._node.model.id;
    }

    /** User-supplied payload for this node. */
    get value(): V {
        return this._node.model.value;
    }

    /**
     * The human-readable label, computed by the formatter passed
     * to ``of()``. Defaults to ``String(value)`` so a payload of
     * type ``{title: string}`` renders as ``[object Object]`` unless
     * the caller passes a formatter — keeps this method honest.
     */
    displayValue(formatter?: DisplayFormatter<V>): string {
        return (formatter ?? this._formatter)(this.value);
    }

    // --- Structure ---------------------------------------------------------

    /** True when this node has no parent (forest root). */
    isRoot(): boolean {
        return this._node.isRoot();
    }

    /** True when this node has no children. */
    isLeaf(): boolean {
        return !this._node.hasChildren();
    }

    /**
     * Depth from the root: 0 for the root, 1 for a direct child,
     * etc. Implemented via ``getPath().length - 1`` since
     * tree-model doesn't ship a depth helper.
     */
    depth(): number {
        return this._node.getPath().length - 1;
    }

    /** Index of this node among its parent's children. */
    childIndex(): number {
        return this._node.getIndex();
    }

    /**
     * Direct children only (no recursion). The array is fresh on
     * every call; mutating it has no effect on the underlying
     * tree-model node.
     */
    children(): TypedTreeNode<V, K>[] {
        // tree-model exposes children only via the model array;
        // walking with strategy "pre" and depth filter is the
        // documented way to get a direct-children list.
        const out: TypedTreeNode<V, K>[] = [];
        // ``children`` array on the model carries the raw rows,
        // not the tree-model Node instances. tree-model attaches
        // the Node onto each row at parse time as a hidden
        // ``children`` getter is NOT provided; we walk one level
        // via the breadth strategy with a depth-1 cutoff.
        this._node.walk({strategy: "breadth"}, (child) => {
            if (child === this._node) return true;
            // Only keep direct children: skip grandchildren.
            const parentPath = child.getPath();
            if (parentPath[parentPath.length - 2] === this._node) {
                out.push(new TypedTreeNode<V, K>(child, this._formatter));
            }
            return true;
        });
        return out;
    }

    /**
     * Parent node, or ``null`` for the root. Inferred from
     * ``getPath()`` — tree-model has no direct ``getParent``.
     */
    parent(): TypedTreeNode<V, K> | null {
        const path = this._node.getPath();
        if (path.length < 2) return null;
        const parent = path[path.length - 2];
        return new TypedTreeNode<V, K>(parent, this._formatter);
    }

    /**
     * Path from the root to this node, inclusive. ``[root, ...,
     * this]``. Useful for breadcrumb rendering.
     */
    path(): TypedTreeNode<V, K>[] {
        return this._node
            .getPath()
            .map((n) => new TypedTreeNode<V, K>(n, this._formatter));
    }

    // --- Visitor / search -------------------------------------------------

    /**
     * Traverse the subtree rooted at this node. ``strategy``
     * defaults to ``pre``. Returning ``false`` from the visitor
     * halts the entire walk (tree-model's convention); return
     * ``true`` or ``undefined`` to continue. To skip a subtree
     * without halting, callers should gate their own work inside
     * the visitor and keep returning truthy.
     */
    walk(visitor: Visitor<V, K>, strategy: TraversalStrategy = "pre"): void {
        this._node.walk({strategy}, (n) => {
            const wrapper = new TypedTreeNode<V, K>(n, this._formatter);
            const result = visitor(wrapper);
            // tree-model treats ``false`` (strict) as stop; return
            // the visitor's value verbatim so void/true/false all
            // map cleanly.
            return result !== false;
        });
    }

    /**
     * First descendant (including ``this``) matching the
     * predicate, or ``undefined``. ``pre`` strategy.
     */
    find(predicate: (node: TypedTreeNode<V, K>) => boolean): TypedTreeNode<V, K> | undefined {
        const found = this._node.first((n) =>
            predicate(new TypedTreeNode<V, K>(n, this._formatter)),
        );
        return found ? new TypedTreeNode<V, K>(found, this._formatter) : undefined;
    }

    /**
     * Every descendant (including ``this``) matching the
     * predicate. ``pre`` strategy.
     */
    findAll(predicate: (node: TypedTreeNode<V, K>) => boolean): TypedTreeNode<V, K>[] {
        return this._node
            .all((n) => predicate(new TypedTreeNode<V, K>(n, this._formatter)))
            .map((n) => new TypedTreeNode<V, K>(n, this._formatter));
    }

    /** Total node count in the subtree rooted at this node. */
    count(): number {
        let n = 0;
        this.walk(() => {
            n += 1;
        });
        return n;
    }

    /**
     * Export the subtree as a plain TreeRow object — useful for
     * JSON serialisation and snapshot tests. Walks the model
     * recursively without going through tree-model so the output
     * is a fresh, mutation-safe copy.
     */
    toRow(): TreeRow<V, K> {
        const cloneRow = (row: TreeRow<V, K>): TreeRow<V, K> => ({
            id: row.id,
            value: row.value,
            children: row.children.map(cloneRow),
        });
        return cloneRow(this._node.model);
    }
}
