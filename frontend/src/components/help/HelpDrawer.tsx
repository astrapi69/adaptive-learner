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

import {X} from "lucide-react";
import Markdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import {Button} from "@/components/ui/button";

import {Sheet, SheetClose, SheetContent, SheetTitle} from "../ui/sheet";
import {useHelp} from "../../contexts/HelpContext";
import {useButtonTooltips} from "../../hooks/useButtonTooltips";
import {useGlossary} from "../../hooks/useGlossary";
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
    // Lazily load the active language's glossary chunk + re-render when it
    // lands (English is eager). Called before the early return so the hook
    // order stays stable.
    useGlossary(lang);
    const entry = openKey ? getGlossaryEntry(openKey, lang) : null;

    if (!entry) return null;

    const allEntries = listGlossaryEntries(lang);
    const related = findRelatedKeys(entry, allEntries);

    return (
        <Sheet
            open={!!openKey}
            onOpenChange={(open) => {
                if (!open) closeHelp();
            }}
        >
            <SheetContent
                side="right"
                showCloseButton={false}
                data-testid="help-drawer"
                className="gap-0 overflow-hidden p-0"
                onOpenAutoFocus={(e) => {
                    // Don't steal focus from the page on open — the user
                    // got here via a tooltip click; the close button is
                    // explicitly findable via keyboard.
                    e.preventDefault();
                }}
            >
                <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-[var(--surface)] px-5 py-4">
                    <SheetTitle className="m-0 text-xl font-semibold">
                        {entry.title}
                    </SheetTitle>
                    <SheetClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            aria-label={t("ui.common.close", "Close")}
                            title={
                                tooltipsOn
                                    ? t("ui.common.close", "Close")
                                    : undefined
                            }
                            data-testid="help-drawer-close"
                            className="rounded-sm text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                        >
                            <X size={20} />
                        </Button>
                    </SheetClose>
                </div>
                <div
                    className="help-drawer-body flex-1 overflow-y-auto px-5 py-4 text-[0.9375rem] leading-relaxed"
                    data-testid="help-drawer-body"
                >
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[
                            rehypeSlug,
                            [rehypeAutolinkHeadings, {behavior: "wrap"}],
                        ]}
                    >
                        {entry.long}
                    </Markdown>
                    {related.length > 0 && (
                        <div
                            data-testid="help-drawer-related"
                            className="mt-5 border-t border-border pt-4"
                        >
                            <h3 className="m-0 mb-2 text-sm font-semibold uppercase tracking-[0.05em] text-[var(--fg-muted)]">
                                {t("ui.help.related", "Related concepts")}
                            </h3>
                            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                                {related.map((r) => (
                                    <li key={r.key}>
                                        <button
                                            type="button"
                                            data-testid={`help-related-${r.key}`}
                                            onClick={() => openHelp(r.key)}
                                            className="cursor-pointer rounded-sm border border-border bg-[var(--surface-2)] px-2 py-1 text-[0.8125rem] text-[var(--fg)]"
                                        >
                                            {r.title}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
