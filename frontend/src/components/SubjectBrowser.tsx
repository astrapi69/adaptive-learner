/**
 * SubjectBrowser (Phase 22D).
 *
 * Tree view of the global Subject taxonomy with:
 *  - case-insensitive search filter
 *  - inline "Add Custom Subject" at any tree level (and at the
 *    root via a top-level button)
 *  - optional click-to-select callback for filter / assignment
 *    use cases (the Dashboard filter bar + the project-
 *    taxonomy assignment UI both wire it)
 *
 * Self-contained: owns the subjects-list fetch and re-fetches
 * after every successful add. Parent components only need to
 * pass the optional ``selectedSubjectId`` + ``onSelect``.
 */

import {useEffect, useMemo, useState} from "react";

import {useI18n} from "../hooks/useI18n";
import {buildTreeFromFlat, type TypedTreeNode} from "../lib/tree";
import {getStorage} from "../storage";
import type {Subject} from "../types/domain";
import {notify} from "../utils/notify";

interface SubjectBrowserProps {
    /** Currently-selected subject id (highlighted in the tree). */
    selectedSubjectId?: string | null;
    /** Fired when the user clicks a row. ``null`` = clear filter. */
    onSelect?: (subjectId: string | null) => void;
    /** When true, hides the "Add Custom Subject" affordances. */
    readOnly?: boolean;
}

function matchesQuery(subject: Subject, query: string): boolean {
    if (!query) return true;
    return subject.name.toLowerCase().includes(query.toLowerCase());
}

/**
 * Walks the forest and keeps every node that matches ``query`` or
 * has any descendant that matches. Returns a NEW filtered flat
 * list ready for ``buildTreeFromFlat``. When the query is empty,
 * passes through unchanged.
 */
function filterSubjects(rows: Subject[], query: string): Subject[] {
    if (!query.trim()) return rows;
    const lower = query.toLowerCase();
    const byId = new Map(rows.map((s) => [s.id, s]));
    const keep = new Set<string>();
    for (const subject of rows) {
        if (subject.name.toLowerCase().includes(lower)) {
            keep.add(subject.id);
            // Walk parents up so the tree path stays connected.
            let cursor: string | null | undefined = subject.parent_id;
            while (cursor) {
                if (keep.has(cursor)) break;
                keep.add(cursor);
                cursor = byId.get(cursor)?.parent_id ?? null;
            }
        }
    }
    return rows.filter((s) => keep.has(s.id));
}

export default function SubjectBrowser({
    selectedSubjectId,
    onSelect,
    readOnly = false,
}: SubjectBrowserProps) {
    const {t} = useI18n();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [addUnder, setAddUnder] = useState<string | null | undefined>(undefined);
    const [newName, setNewName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function refresh() {
        setLoading(true);
        try {
            const rows = await getStorage().subjects.list();
            setSubjects(rows);
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.load_failed", "Failed to load subjects."),
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    const forest = useMemo(() => {
        const filtered = filterSubjects(subjects, query);
        return buildTreeFromFlat(filtered, {
            getId: (s) => s.id,
            getParentId: (s) => s.parent_id,
            sort: (a, b) => a.name.localeCompare(b.name),
        });
    }, [subjects, query]);

    async function handleAdd(parentId: string | null) {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            await getStorage().subjects.create({
                name: trimmed,
                parent_id: parentId,
            });
            notify.success(t("taxonomy.subject_added", "Subject added."));
            setAddUnder(undefined);
            setNewName("");
            await refresh();
        } catch (err) {
            notify.error(
                err instanceof Error
                    ? err.message
                    : t("taxonomy.subject_add_failed", "Could not add subject."),
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="subject-browser" data-testid="subject-browser-loading">
                {t("taxonomy.loading", "Loading subjects…")}
            </div>
        );
    }

    return (
        <div className="subject-browser" data-testid="subject-browser">
            <div className="subject-browser-toolbar">
                <input
                    type="search"
                    className="subject-browser-search"
                    data-testid="subject-browser-search"
                    placeholder={t("taxonomy.search_placeholder", "Search subjects…")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {!readOnly && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        data-testid="subject-browser-add-root"
                        onClick={() => {
                            setAddUnder(null);
                            setNewName("");
                        }}
                    >
                        {t("taxonomy.add_root_subject", "+ Top-level")}
                    </button>
                )}
            </div>
            {addUnder !== undefined && (
                <form
                    className="subject-add-form"
                    data-testid="subject-add-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleAdd(addUnder ?? null);
                    }}
                >
                    <input
                        type="text"
                        data-testid="subject-add-input"
                        placeholder={t("taxonomy.subject_name", "Subject name")}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                        disabled={submitting}
                        required
                    />
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        data-testid="subject-add-submit"
                        disabled={submitting || newName.trim().length === 0}
                    >
                        {t("common.save", "Save")}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        data-testid="subject-add-cancel"
                        onClick={() => {
                            setAddUnder(undefined);
                            setNewName("");
                        }}
                        disabled={submitting}
                    >
                        {t("common.cancel", "Cancel")}
                    </button>
                </form>
            )}
            {forest.length === 0 ? (
                <div className="subject-browser-empty" data-testid="subject-browser-empty">
                    {query
                        ? t("taxonomy.no_matches", "No subjects match your search.")
                        : t("taxonomy.no_subjects", "No subjects yet.")}
                </div>
            ) : (
                <ul className="subject-tree" data-testid="subject-tree">
                    {forest.map((root) => (
                        <SubjectTreeNode
                            key={root.id}
                            node={root}
                            selectedSubjectId={selectedSubjectId}
                            onSelect={onSelect}
                            onRequestAddUnder={(id) => {
                                setAddUnder(id);
                                setNewName("");
                            }}
                            readOnly={readOnly}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

interface SubjectTreeNodeProps {
    node: TypedTreeNode<Subject, string>;
    selectedSubjectId?: string | null;
    onSelect?: (subjectId: string | null) => void;
    onRequestAddUnder: (parentId: string) => void;
    readOnly: boolean;
}

function SubjectTreeNode({
    node,
    selectedSubjectId,
    onSelect,
    onRequestAddUnder,
    readOnly,
}: SubjectTreeNodeProps) {
    const subject = node.value;
    const children = node.children();
    const isSelected = selectedSubjectId === subject.id;
    return (
        <li
            className="subject-tree-node"
            data-testid={`subject-node-${subject.id}`}
        >
            <div
                className={`subject-row${isSelected ? " subject-row-selected" : ""}`}
            >
                {subject.icon && (
                    <span className="subject-icon" aria-hidden="true">
                        {subject.icon}
                    </span>
                )}
                <button
                    type="button"
                    className="subject-row-label"
                    data-testid={`subject-row-${subject.id}`}
                    onClick={() => onSelect?.(isSelected ? null : subject.id)}
                >
                    {subject.name}
                </button>
                {!readOnly && (
                    <button
                        type="button"
                        className="subject-row-add"
                        data-testid={`subject-add-under-${subject.id}`}
                        onClick={() => onRequestAddUnder(subject.id)}
                        aria-label="Add child subject"
                        title="Add child"
                    >
                        +
                    </button>
                )}
            </div>
            {children.length > 0 && (
                <ul className="subject-tree-children">
                    {children.map((child) => (
                        <SubjectTreeNode
                            key={child.id}
                            node={child}
                            selectedSubjectId={selectedSubjectId}
                            onSelect={onSelect}
                            onRequestAddUnder={onRequestAddUnder}
                            readOnly={readOnly}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

// Re-export for tests that need to drive the filter helper.
export {filterSubjects, matchesQuery};
