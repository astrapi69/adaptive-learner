/**
 * Tree-adapter barrel export. See ``TypedTreeNode.ts`` for the
 * library rationale and ``buildTree.ts`` for the flat-to-tree
 * conversion entry point.
 */

export {
    TypedTreeNode,
    type TraversalStrategy,
    type Visitor,
    type DisplayFormatter,
    type TreeRow,
} from "./TypedTreeNode";
export {buildTreeFromFlat, type BuildTreeOptions} from "./buildTree";
