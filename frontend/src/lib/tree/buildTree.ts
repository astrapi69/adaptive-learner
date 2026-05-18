/**
 * Flat-to-tree conversion. Backend rows like ``LearningTopic``
 * arrive as a flat list keyed by ``(id, parent_id)``; the UI
 * needs a forest of ``TypedTreeNode`` instances for hierarchical
 * rendering.
 *
 * The builder is O(n) — one pass to index by id, one pass to
 * link parents — and rejects cycles + dangling parent references
 * loudly so a corrupted backend response doesn't quietly drop
 * rows.
 */

import {TypedTreeNode, type DisplayFormatter, type TreeRow} from "./TypedTreeNode";

/**
 * Configuration for ``buildTreeFromFlat``. ``getId`` /
 * ``getParentId`` extract the typed key from each row; ``sort``
 * (optional) orders siblings before they become tree-model
 * children — the order of children at construction time is the
 * order tree-model will preserve.
 */
export interface BuildTreeOptions<V, K> {
    getId: (value: V) => K;
    getParentId: (value: V) => K | null;
    /**
     * Sibling comparator. Receives the raw value (not the
     * wrapping TreeRow) so callers can use field accessors
     * directly. Defaults to "stable / no reordering".
     */
    sort?: (a: V, b: V) => number;
    /** Optional formatter forwarded to TypedTreeNode.of(). */
    formatter?: DisplayFormatter<V>;
}

/**
 * Convert a flat array into a forest of typed tree nodes.
 *
 * Returns an array because a real-world LearningTopic flat-list
 * MAY contain multiple roots (the API does not enforce a single
 * synthetic root). When the caller knows there's exactly one
 * root, ``buildTreeFromFlat(...)[0]`` is the canonical access.
 *
 * Throws on:
 *   - duplicate ``id`` across two rows (would otherwise cause one
 *     row to overwrite the other in the index)
 *   - parent reference that does not resolve to any known id
 *     (silent drop hides backend bugs; loud failure surfaces them)
 *   - cycle in the parent-id chain (each row visited at most once)
 */
export function buildTreeFromFlat<V, K>(
    rows: readonly V[],
    options: BuildTreeOptions<V, K>,
): TypedTreeNode<V, K>[] {
    const {getId, getParentId, sort, formatter} = options;

    // 1) Index rows by id, prepare empty TreeRow shells.
    const shells = new Map<K, TreeRow<V, K>>();
    for (const value of rows) {
        const id = getId(value);
        if (shells.has(id)) {
            throw new Error(`buildTreeFromFlat: duplicate id ${String(id)}`);
        }
        shells.set(id, {id, value, children: []});
    }

    // 2) Link children into parents. Detect dangling-parent and
    //    cycles in the same pass — cycles surface as "I tried to
    //    attach to my own descendant" when a child is reached
    //    twice via different parent paths, but the simpler check
    //    is a per-row count: at most one parent linkage per shell.
    const linkedFromParent = new Set<K>();
    const roots: TreeRow<V, K>[] = [];
    for (const value of rows) {
        const id = getId(value);
        const parentId = getParentId(value);
        const shell = shells.get(id)!;
        if (parentId == null) {
            roots.push(shell);
            continue;
        }
        const parent = shells.get(parentId);
        if (parent === undefined) {
            throw new Error(
                `buildTreeFromFlat: row ${String(id)} references unknown parent ${String(parentId)}`,
            );
        }
        if (linkedFromParent.has(id)) {
            // A row was already attached as a child of someone.
            // Re-link would imply duplicate-id (caught above) or a
            // cycle. Belt-and-braces: refuse.
            throw new Error(
                `buildTreeFromFlat: row ${String(id)} attached twice (cycle?)`,
            );
        }
        linkedFromParent.add(id);
        parent.children.push(shell);
    }

    // 3) Cycle check: any non-root that is unreachable from a root
    //    must be in a cycle. Walk every root, mark visited; rows
    //    not marked are orphans-of-cycle.
    if (rows.length > 0) {
        const reachable = new Set<K>();
        const stack: TreeRow<V, K>[] = [...roots];
        while (stack.length > 0) {
            const row = stack.pop()!;
            if (reachable.has(row.id)) {
                // Visited twice from two parents — DAG, not cycle,
                // but our linkedFromParent check above forbids
                // multiple-parent edges, so this would only fire
                // if a child appeared twice in some parent's
                // children array, which the index map prevents.
                throw new Error(`buildTreeFromFlat: cycle detected at ${String(row.id)}`);
            }
            reachable.add(row.id);
            for (const c of row.children) stack.push(c);
        }
        if (reachable.size !== rows.length) {
            const missing: K[] = [];
            for (const id of shells.keys()) {
                if (!reachable.has(id)) missing.push(id);
            }
            throw new Error(
                `buildTreeFromFlat: cycle or orphan rows detected. unreachable=${missing
                    .map((m) => String(m))
                    .join(",")}`,
            );
        }
    }

    // 4) Optional sibling sort. Sort each shell's children array
    //    before TreeModel.parse() so the resulting tree-model
    //    nodes appear in the desired order.
    if (sort) {
        const sortRecursive = (shell: TreeRow<V, K>) => {
            shell.children.sort((a, b) => sort(a.value, b.value));
            for (const c of shell.children) sortRecursive(c);
        };
        for (const r of roots) sortRecursive(r);
        roots.sort((a, b) => sort(a.value, b.value));
    }

    // 5) Hand each root shell to TypedTreeNode.of for tree-model
    //    wrapping.
    return roots.map((root) => TypedTreeNode.of(root, formatter));
}
