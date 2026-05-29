/**
 * Tier-coloured badge SVG generator (Phase 57 / v1.40.0 / D-127).
 *
 * Produces a deterministic inline SVG data URI for a badge. Two
 * orthogonal, independently-meaningful dimensions (accessible — colour
 * is never the ONLY signal):
 *
 *   - SHAPE encodes the badge TYPE. The 28 catalog keys map onto ~10
 *     distinct geometric glyphs (rocket / book / star / flame / target
 *     / globe / sparkles / inbox / compass / brain / layers), grouped
 *     so related badges share a glyph.
 *   - COLOUR PALETTE encodes the TIER (bronze / silver / gold), or a
 *     muted grey for ``locked`` (unearned). A locked badge still renders
 *     its glyph (greyed, not hidden) so the shape — and thus the meaning
 *     — stays legible.
 *
 * Output: ``data:image/svg+xml;utf8,...`` (64x64 viewBox), no external
 * files, no network. Works offline + Dexie mode + GitHub Pages, exactly
 * like the v1.37 placeholder-svg generator it mirrors.
 *
 * Pure + deterministic: same (key, tier) -> byte-identical bytes.
 */

export type BadgeTier = "bronze" | "silver" | "gold" | "locked";

interface TierPalette {
    /** Medallion fill. */
    primary: string;
    /** Ring / outline + glyph detail. */
    secondary: string;
    /** Glyph fill (the recognisable shape). */
    highlight: string;
}

/** Tier palettes (D-127 spec). ``locked`` uses grey-400/500 with a
 *  light-grey glyph so the shape remains visible (a literally
 *  transparent glyph would hide the meaning, breaking the
 *  shape-carries-meaning accessibility requirement). */
export const TIER_PALETTE: Record<BadgeTier, TierPalette> = {
    bronze: {primary: "#CD7F32", secondary: "#8B5A2B", highlight: "#FFF8DC"},
    silver: {primary: "#C0C0C0", secondary: "#808080", highlight: "#F5F5F5"},
    gold: {primary: "#FFD700", secondary: "#B8860B", highlight: "#FFFAF0"},
    locked: {primary: "#9CA3AF", secondary: "#6B7280", highlight: "#E5E7EB"},
};

export type BadgeShape =
    | "rocket"
    | "book"
    | "star"
    | "flame"
    | "target"
    | "globe"
    | "sparkles"
    | "inbox"
    | "compass"
    | "brain"
    | "layers";

/** Catalog key -> glyph. Grouped so related badges share a shape
 *  (~10 shapes across 28 keys). A Vitest pin asserts every
 *  BUNDLED_BADGES key has an entry. */
export const KEY_TO_SHAPE: Record<string, BadgeShape> = {
    // "First X" onboarding -> rocket.
    first_session: "rocket",
    first_assessment: "rocket",
    first_import: "rocket",
    first_lesson: "rocket",
    // Volume of sessions / lessons -> book.
    sessions_10: "book",
    sessions_50: "book",
    sessions_100: "book",
    lessons_10: "book",
    // Level + flawless lessons -> star.
    level_5: "star",
    level_10: "star",
    level_25: "star",
    three_star_streak: "star",
    // Streaks -> flame.
    streak_3_days: "flame",
    streak_7_days: "flame",
    streak_30_days: "flame",
    streak_100_days: "flame",
    // SRS review mastery -> target.
    review_master: "target",
    // Languages -> globe.
    two_languages: "globe",
    // Providers -> sparkles.
    three_providers: "sparkles",
    // Imports -> inbox.
    import_10_conversations: "inbox",
    // Method breadth -> compass.
    all_six_methods: "compass",
    // Per-method depth -> brain.
    deductive_10: "brain",
    inductive_10: "brain",
    error_based_10: "brain",
    dialogic_10: "brain",
    contextual_10: "brain",
    ai_adaptive_10: "brain",
    // Multi-cycle depth -> layers.
    five_cycles_one_session: "layers",
};

// --- Glyph renderers (centred in a 64x64 viewBox; ``c`` = highlight,
// ``s`` = secondary detail). Simple geometry, recognisable at 32px. ---

function glyphRocket(c: string, s: string): string {
    return [
        `<path d="M32 14c6 4 8 12 8 18l-4 6h-8l-4-6c0-6 2-14 8-18z" fill="${c}"/>`,
        `<circle cx="32" cy="27" r="3.5" fill="${s}"/>`,
        `<path d="M24 38l-4 8 8-3zM40 38l4 8-8-3z" fill="${c}"/>`,
    ].join("");
}

function glyphBook(c: string, s: string): string {
    return [
        `<path d="M18 20h12c2 0 2 1 2 2v22c0-1-1-2-2-2H18z" fill="${c}"/>`,
        `<path d="M46 20H34c-2 0-2 1-2 2v22c0-1 1-2 2-2h12z" fill="${c}"/>`,
        `<line x1="32" y1="22" x2="32" y2="44" stroke="${s}" stroke-width="2"/>`,
    ].join("");
}

function glyphStar(c: string): string {
    return `<path d="M32 16l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" fill="${c}"/>`;
}

function glyphFlame(c: string, s: string): string {
    return [
        `<path d="M32 16c6 7 10 11 10 18a10 10 0 0 1-20 0c0-4 2-7 5-10 1 3 3 4 5 4-2-4 0-9 0-12z" fill="${c}"/>`,
        `<path d="M32 30c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="${s}"/>`,
    ].join("");
}

function glyphTarget(c: string, s: string): string {
    return [
        `<circle cx="32" cy="32" r="14" fill="none" stroke="${c}" stroke-width="3"/>`,
        `<circle cx="32" cy="32" r="8" fill="none" stroke="${c}" stroke-width="3"/>`,
        `<circle cx="32" cy="32" r="3" fill="${s}"/>`,
    ].join("");
}

function glyphGlobe(c: string, s: string): string {
    return [
        `<circle cx="32" cy="32" r="14" fill="none" stroke="${c}" stroke-width="3"/>`,
        `<ellipse cx="32" cy="32" rx="6" ry="14" fill="none" stroke="${s}" stroke-width="2"/>`,
        `<line x1="18" y1="32" x2="46" y2="32" stroke="${s}" stroke-width="2"/>`,
    ].join("");
}

function glyphSparkles(c: string): string {
    return [
        `<path d="M32 16l3 11 11 3-11 3-3 11-3-11-11-3 11-3z" fill="${c}"/>`,
        `<path d="M46 18l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="${c}"/>`,
    ].join("");
}

function glyphInbox(c: string, s: string): string {
    return [
        `<path d="M18 22h28v20H18z" fill="none" stroke="${c}" stroke-width="3"/>`,
        `<path d="M18 36h8l3 4h6l3-4h8" fill="none" stroke="${s}" stroke-width="3"/>`,
    ].join("");
}

function glyphCompass(c: string, s: string): string {
    return [
        `<circle cx="32" cy="32" r="14" fill="none" stroke="${c}" stroke-width="3"/>`,
        `<path d="M32 22l4 10-4 10-4-10z" fill="${s}"/>`,
    ].join("");
}

function glyphBrain(c: string, s: string): string {
    return [
        `<path d="M26 20a6 6 0 0 0-6 6 5 5 0 0 0-1 9 6 6 0 0 0 7 7V20z" fill="${c}"/>`,
        `<path d="M38 20a6 6 0 0 1 6 6 5 5 0 0 1 1 9 6 6 0 0 1-7 7V20z" fill="${c}"/>`,
        `<line x1="32" y1="20" x2="32" y2="44" stroke="${s}" stroke-width="2"/>`,
    ].join("");
}

function glyphLayers(c: string, s: string): string {
    return [
        `<path d="M32 18l16 8-16 8-16-8z" fill="${c}"/>`,
        `<path d="M16 34l16 8 16-8" fill="none" stroke="${s}" stroke-width="3"/>`,
    ].join("");
}

function renderGlyph(shape: BadgeShape, c: string, s: string): string {
    switch (shape) {
        case "rocket":
            return glyphRocket(c, s);
        case "book":
            return glyphBook(c, s);
        case "star":
            return glyphStar(c);
        case "flame":
            return glyphFlame(c, s);
        case "target":
            return glyphTarget(c, s);
        case "globe":
            return glyphGlobe(c, s);
        case "sparkles":
            return glyphSparkles(c);
        case "inbox":
            return glyphInbox(c, s);
        case "compass":
            return glyphCompass(c, s);
        case "brain":
            return glyphBrain(c, s);
        case "layers":
            return glyphLayers(c, s);
        default:
            // Defensive fallback: a plain disc. Unreachable while
            // KEY_TO_SHAPE stays exhaustive (pinned by a test).
            return `<circle cx="32" cy="32" r="10" fill="${c}"/>`;
    }
}

/** Resolve a badge key to its glyph (falls back to ``star``). */
export function shapeForKey(badgeKey: string): BadgeShape {
    return KEY_TO_SHAPE[badgeKey] ?? "star";
}

/**
 * Build the inline SVG data URI for ``badgeKey`` at ``tier``. Pass
 * ``"locked"`` for an unearned badge (greyed medallion, glyph still
 * visible). Deterministic.
 */
export function generateBadgeSvg(badgeKey: string, tier: BadgeTier): string {
    const palette = TIER_PALETTE[tier] ?? TIER_PALETTE.locked;
    const shape = shapeForKey(badgeKey);
    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
        // Medallion: filled disc + ring.
        `<circle cx="32" cy="32" r="30" fill="${palette.primary}"/>`,
        `<circle cx="32" cy="32" r="30" fill="none" stroke="${palette.secondary}" stroke-width="3"/>`,
        renderGlyph(shape, palette.highlight, palette.secondary),
        "</svg>",
    ].join("");
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
