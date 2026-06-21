/**
 * Settings > Help section (Phase 38E).
 *
 * Browse + search the full glossary. Each entry row is a
 * button that opens the help drawer on that entry. The list
 * is grouped by category (Concepts / Methods / Steps /
 * Features) and the search input filters across both
 * ``title`` and ``short`` (case-insensitive substring).
 *
 * Mounted as its own settings-section in ``pages/Settings.tsx``
 * — visible alongside Language / Provider / etc.
 */

import {useMemo, useState} from "react";
import {BookOpen, Search} from "lucide-react";

import {useHelp} from "../../contexts/HelpContext";
import {useGlossary} from "../../hooks/content/useGlossary";
import {useI18n} from "../../hooks/ui/useI18n";
import {listGlossaryEntries} from "../../lib/help/help-glossary";
import type {GlossaryCategory, GlossaryEntry} from "../../types/help";

const CATEGORY_ORDER: GlossaryCategory[] = [
    "concepts",
    "methods",
    "steps",
    "features",
];

function groupByCategory(
    entries: GlossaryEntry[],
): Record<GlossaryCategory, GlossaryEntry[]> {
    const out: Record<GlossaryCategory, GlossaryEntry[]> = {
        concepts: [],
        methods: [],
        steps: [],
        features: [],
    };
    for (const entry of entries) {
        out[entry.category].push(entry);
    }
    return out;
}

export default function HelpBrowser() {
    const {t, lang} = useI18n();
    const {openHelp} = useHelp();
    const [query, setQuery] = useState("");

    // Lazily load the active language's glossary chunk (English is eager);
    // `loaded` flips when the localized entries land so the list recomputes.
    const loaded = useGlossary(lang);
    // `loaded` is a deliberate trigger dep: the memo body doesn't read it, but
    // flipping it forces a recompute once the lazy glossary chunk has landed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const allEntries = useMemo(() => listGlossaryEntries(lang), [lang, loaded]);

    const filtered = useMemo(() => {
        if (!query.trim()) return allEntries;
        const needle = query.trim().toLowerCase();
        return allEntries.filter((entry) => {
            return (
                entry.title.toLowerCase().includes(needle) ||
                entry.short.toLowerCase().includes(needle) ||
                entry.long.toLowerCase().includes(needle)
            );
        });
    }, [allEntries, query]);

    const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

    return (
        <section
            className="settings-section"
            data-testid="settings-help-section"
        >
            <h2
                className="settings-section-title"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                }}
            >
                <BookOpen size={18} />
                {t("ui.help.drawer_title", "Help")}
            </h2>
            <p
                style={{
                    color: "var(--fg-muted)",
                    fontSize: "0.875rem",
                    marginTop: 0,
                }}
            >
                {t(
                    "settings.help_intro",
                    "Browse and search the in-app glossary. Click any entry for the full article.",
                )}
            </p>

            <div
                style={{
                    position: "relative",
                    marginBottom: "var(--space-4)",
                }}
            >
                <span
                    style={{
                        position: "absolute",
                        top: "50%",
                        right: 10,
                        transform: "translateY(-50%)",
                        color: "var(--fg-muted)",
                        pointerEvents: "none",
                    }}
                >
                    <Search size={14} />
                </span>
                <input
                    type="search"
                    data-testid="settings-help-search"
                    placeholder={t(
                        "ui.help.search_placeholder",
                        "Search the glossary...",
                    )}
                    aria-label={t(
                        "ui.help.search_placeholder",
                        "Search the glossary...",
                    )}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "8px 32px 8px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-strong)",
                        fontSize: "0.875rem",
                    }}
                />
            </div>

            {filtered.length === 0 && (
                <p
                    data-testid="settings-help-no-results"
                    style={{
                        color: "var(--fg-muted)",
                        fontSize: "0.875rem",
                        marginTop: "var(--space-4)",
                    }}
                >
                    {t("ui.help.no_results", "No matching entries.")}
                </p>
            )}

            {CATEGORY_ORDER.map((category) => {
                const entries = grouped[category];
                if (entries.length === 0) return null;
                return (
                    <div
                        key={category}
                        data-testid={`settings-help-group-${category}`}
                        style={{marginBottom: "var(--space-4)"}}
                    >
                        <h3
                            style={{
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                margin: 0,
                                marginBottom: "var(--space-2)",
                                color: "var(--fg-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {t(
                                `ui.help.categories.${category}`,
                                category,
                            )}
                        </h3>
                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                            }}
                        >
                            {entries.map((entry) => (
                                <li key={entry.key}>
                                    <button
                                        type="button"
                                        data-testid={`settings-help-entry-${entry.key}`}
                                        onClick={() => openHelp(entry.key)}
                                        style={{
                                            display: "block",
                                            width: "100%",
                                            textAlign: "left",
                                            background: "none",
                                            border: "none",
                                            padding: "var(--space-2) var(--space-3)",
                                            cursor: "pointer",
                                            borderRadius: "var(--radius-sm)",
                                            color: "var(--fg)",
                                            fontSize: "0.875rem",
                                            lineHeight: 1.4,
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                                "var(--surface-2)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                                "none";
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight: 500,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {entry.title}
                                        </div>
                                        <div
                                            style={{
                                                color: "var(--fg-muted)",
                                                fontSize: "0.8125rem",
                                            }}
                                        >
                                            {entry.short}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </section>
    );
}
