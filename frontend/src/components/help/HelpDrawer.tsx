/**
 * Help drawer (Phase 38C).
 *
 * Radix Dialog rendered as a slide-over from the right
 * (~600px desktop / full-screen mobile). Renders the long
 * Markdown content of a glossary entry, with auto-generated
 * heading anchors and a "related concepts" footer linking to
 * other glossary entries.
 *
 * Mounted once at the App root. Consumes ``useHelp()`` for
 * the currently-open key + close action. The drawer does NOT
 * push a browser-history entry — it's a transient overlay,
 * not a navigable page.
 *
 * Layout contract: max-width 640px on desktop, takes the full
 * viewport on mobile (< 768px). Long articles scroll inside
 * the drawer; the close button stays sticky at the top.
 */

import * as Dialog from "@radix-ui/react-dialog";
import {X} from "lucide-react";
import Markdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import {useHelp} from "../../contexts/HelpContext";
import {useButtonTooltips} from "../../hooks/useButtonTooltips";
import {useI18n} from "../../hooks/useI18n";
import {getGlossaryEntry, listGlossaryEntries} from "../../lib/help-glossary";
import type {GlossaryEntry} from "../../types/help";

/** Heuristic related-concepts extractor: scans the article's
 *  Markdown text for mentions of other glossary entry
 *  titles (case-insensitive) and returns matching keys, up
 *  to a small cap. Cheap and good-enough for v1 — replace
 *  with explicit ``related: [...]`` YAML field if false
 *  positives surface. */
function findRelatedKeys(
    entry: GlossaryEntry,
    allEntries: GlossaryEntry[],
): GlossaryEntry[] {
    const haystack = entry.long.toLowerCase();
    const matches: GlossaryEntry[] = [];
    for (const other of allEntries) {
        if (other.key === entry.key) continue;
        if (matches.length >= 6) break;
        const needle = other.title.toLowerCase();
        if (needle.length < 4) continue;
        if (haystack.includes(needle)) {
            matches.push(other);
        }
    }
    return matches;
}

export default function HelpDrawer() {
    const {openKey, openHelp, closeHelp} = useHelp();
    const {t, lang} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const entry = openKey ? getGlossaryEntry(openKey, lang) : null;

    if (!entry) return null;

    const allEntries = listGlossaryEntries(lang);
    const related = findRelatedKeys(entry, allEntries);

    return (
        <Dialog.Root
            open={!!openKey}
            onOpenChange={(open) => {
                if (!open) closeHelp();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "var(--bg-overlay)",
                        zIndex: 1200,
                    }}
                />
                <Dialog.Content
                    data-testid="help-drawer"
                    style={{
                        position: "fixed",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "min(640px, 100vw)",
                        background: "var(--surface)",
                        borderLeft: "1px solid var(--border)",
                        boxShadow: "var(--shadow-elevated)",
                        zIndex: 1201,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                    onOpenAutoFocus={(e) => {
                        // Don't steal focus from the page on
                        // open — the user got here via a
                        // tooltip click; the close button is
                        // explicitly findable via keyboard.
                        e.preventDefault();
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "var(--space-4) var(--space-5)",
                            borderBottom: "1px solid var(--border)",
                            background: "var(--surface)",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                        }}
                    >
                        <Dialog.Title
                            style={{
                                margin: 0,
                                fontSize: "1.25rem",
                                fontWeight: 600,
                            }}
                        >
                            {entry.title}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                aria-label={t(
                                    "ui.common.close",
                                    "Close",
                                )}
                                title={
                                    tooltipsOn
                                        ? t(
                                              "ui.common.close",
                                              "Close",
                                          )
                                        : undefined
                                }
                                data-testid="help-drawer-close"
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--fg-muted)",
                                    padding: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "var(--radius-sm)",
                                }}
                            >
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>
                    <div
                        className="help-drawer-body"
                        data-testid="help-drawer-body"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "var(--space-4) var(--space-5)",
                            lineHeight: 1.6,
                            fontSize: "0.9375rem",
                        }}
                    >
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[
                                rehypeSlug,
                                [
                                    rehypeAutolinkHeadings,
                                    {behavior: "wrap"},
                                ],
                            ]}
                        >
                            {entry.long}
                        </Markdown>
                        {related.length > 0 && (
                            <div
                                data-testid="help-drawer-related"
                                style={{
                                    marginTop: "var(--space-5)",
                                    paddingTop: "var(--space-4)",
                                    borderTop: "1px solid var(--border)",
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                        margin: 0,
                                        marginBottom: "var(--space-2)",
                                        color: "var(--fg-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                    }}
                                >
                                    {t(
                                        "ui.help.related",
                                        "Related concepts",
                                    )}
                                </h3>
                                <ul
                                    style={{
                                        listStyle: "none",
                                        padding: 0,
                                        margin: 0,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "var(--space-2)",
                                    }}
                                >
                                    {related.map((r) => (
                                        <li key={r.key}>
                                            <button
                                                type="button"
                                                data-testid={`help-related-${r.key}`}
                                                onClick={() => openHelp(r.key)}
                                                style={{
                                                    background:
                                                        "var(--surface-2)",
                                                    border: "1px solid var(--border)",
                                                    borderRadius:
                                                        "var(--radius-sm)",
                                                    padding:
                                                        "var(--space-1) var(--space-2)",
                                                    fontSize: "0.8125rem",
                                                    cursor: "pointer",
                                                    color: "var(--fg)",
                                                }}
                                            >
                                                {r.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
