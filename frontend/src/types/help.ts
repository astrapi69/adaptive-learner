/**
 * Help glossary entry shape (Phase 38).
 *
 * Authored as YAML under ``backend/config/help/``, synced to
 * JSON bundles under ``frontend/src/data/help/`` by
 * ``make sync-help``. The frontend reads the JSON bundles
 * directly via ``import.meta.glob`` — no API roundtrip
 * required.
 */

export type GlossaryCategory = "concepts" | "methods" | "steps" | "features";

export interface GlossaryEntry {
    /** Stable snake_case identifier — used in URLs and as the
     *  prop key on ``HelpTooltip`` / ``HelpDrawer``. */
    key: string;
    /** Display title (matches the language of the bundle). */
    title: string;
    /** 1-2 sentences. Renders inside the tooltip popover. */
    short: string;
    /** Markdown, 200-500 words. Renders inside the help
     *  drawer. */
    long: string;
    /** Which YAML category the entry came from. */
    category: GlossaryCategory;
}
