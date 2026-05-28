/**
 * Inline SVG placeholder generator (Phase 54D / v1.37.0).
 *
 * Produces a deterministic SVG data URI for a learning choice
 * label when no authored image is available. Categories:
 *
 *   - ``color``: solid swatch keyed to a multilingual color
 *     dictionary (FR / ES / DE / EN). For a label like
 *     "rouge", "rojo", "rot", or "red" the swatch fills with
 *     the matching hex; the label remains the accessible
 *     name on the consumer side.
 *
 *   - ``number``: large styled numeral. The label IS the
 *     numeral, drawn dead-centre on a neutral background.
 *
 *   - ``default`` (avatar): first letter of the label inside
 *     a coloured circle. The colour is a deterministic hash
 *     of the label so repeated rendering of the same choice
 *     always gets the same hue — small but useful for
 *     learners who use position memory.
 *
 *  Deferred categories (animal, food): require curated icon
 *  sets + multi-language lexicons; defaulting to the avatar
 *  shape gives an acceptable fallback in the meantime.
 *
 * Output: ``data:image/svg+xml;utf8,...`` so the <img> tag
 * renders it with zero network calls. Works fully offline +
 * in Dexie mode + on GitHub Pages.
 *
 * Pure + deterministic. Same label + same category produce
 * byte-identical SVG bytes.
 */

export type PlaceholderCategory = "color" | "number" | "default";

/** Multilingual color → hex map. Keyed by lowercase label
 *  with diacritics intact (the lesson author writes "rouge"
 *  / "rojo" / "rot" / "vert", and the lookup matches one of
 *  them directly). Adding a new language is a one-line
 *  extension; adding a new colour bumps every language.
 *
 *  Hex values are picked from the existing CSS palette
 *  (themes/global.css palette tokens where applicable) so
 *  the swatches harmonise with the app chrome on every
 *  theme. */
const COLOR_HEX: Record<string, string> = {
    // English
    red: "#e63946",
    blue: "#1d4ed8",
    green: "#16a34a",
    yellow: "#facc15",
    orange: "#f97316",
    purple: "#7c3aed",
    pink: "#ec4899",
    brown: "#8b5a2b",
    black: "#111827",
    white: "#fafafa",
    gray: "#9ca3af",
    grey: "#9ca3af",
    // French
    rouge: "#e63946",
    bleu: "#1d4ed8",
    vert: "#16a34a",
    jaune: "#facc15",
    violet: "#7c3aed",
    rose: "#ec4899",
    marron: "#8b5a2b",
    noir: "#111827",
    blanc: "#fafafa",
    gris: "#9ca3af",
    // Spanish
    rojo: "#e63946",
    azul: "#1d4ed8",
    verde: "#16a34a",
    amarillo: "#facc15",
    naranja: "#f97316",
    morado: "#7c3aed",
    rosado: "#ec4899",
    negro: "#111827",
    blanco: "#fafafa",
    // (marrón shares the form with French marron)
    "marrón": "#8b5a2b",
    // German (uses umlauts as authored — sync with the
    // German prose policy)
    rot: "#e63946",
    blau: "#1d4ed8",
    "grün": "#16a34a",
    gelb: "#facc15",
    lila: "#7c3aed",
    braun: "#8b5a2b",
    schwarz: "#111827",
    weiß: "#fafafa",
    grau: "#9ca3af",
};

/** Avatar palette — 12 distinct hues hashed by label. Tuned
 *  for readable white text + adequate contrast on each. */
const AVATAR_PALETTE = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#84cc16", // lime
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#64748b", // slate
];

function _hashIndex(s: string, mod: number): number {
    // FNV-1a 32-bit. Tiny + deterministic + good distribution
    // for short strings (the avatar palette only needs 4
    // bits of entropy).
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % mod;
}

/** Auto-detect the category for a label. Color match takes
 *  priority over number → avatar fallback. */
export function detectCategory(label: string): PlaceholderCategory {
    const trimmed = label.trim();
    if (trimmed.length === 0) return "default";
    const lower = trimmed.toLowerCase();
    if (COLOR_HEX[lower]) return "color";
    if (/^\d+$/.test(trimmed)) return "number";
    return "default";
}

function _renderColorSwatch(label: string): string {
    const hex = COLOR_HEX[label.toLowerCase()] ?? "#9ca3af";
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
        `<rect width="100" height="100" rx="8" ry="8" fill="${hex}"/>`,
        // Thin outline so light colors (white, yellow) stay
        // visible on light backgrounds.
        '<rect x="1" y="1" width="98" height="98" rx="7" ry="7" fill="none" stroke="#0001" stroke-width="2"/>',
        "</svg>",
    ].join("");
}

function _renderNumber(label: string): string {
    // Numerals over 4 chars start to overflow the bbox; clip
    // to 4 (e.g. 4-digit year). Anything that doesn't pass
    // the digit regex shouldn't reach this branch.
    const text = label.trim().slice(0, 4);
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
        '<rect width="100" height="100" rx="8" ry="8" fill="#f1f5f9"/>',
        '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ',
        'font-family="system-ui, -apple-system, sans-serif" font-size="48" ',
        `font-weight="700" fill="#0f172a">${_escape(text)}</text>`,
        "</svg>",
    ].join("");
}

function _renderAvatar(label: string): string {
    // First non-whitespace character, uppercased. Falls back
    // to "?" on an empty label (shouldn't reach this path
    // since detectCategory short-circuits, but defensive).
    const first = label.trim().charAt(0);
    const letter = (first || "?").toUpperCase();
    const fill = AVATAR_PALETTE[_hashIndex(label.toLowerCase(), AVATAR_PALETTE.length)];
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
        `<circle cx="50" cy="50" r="46" fill="${fill}"/>`,
        '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ',
        'font-family="system-ui, -apple-system, sans-serif" font-size="48" ',
        `font-weight="700" fill="#ffffff">${_escape(letter)}</text>`,
        "</svg>",
    ].join("");
}

function _escape(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Produce an inline SVG data URI for a learning-choice
 *  label. ``category`` is auto-detected when omitted. */
export function generatePlaceholderSvg(
    label: string,
    category?: PlaceholderCategory,
): string {
    const cat = category ?? detectCategory(label);
    let svg: string;
    switch (cat) {
        case "color":
            svg = _renderColorSwatch(label);
            break;
        case "number":
            svg = _renderNumber(label);
            break;
        case "default":
        default:
            svg = _renderAvatar(label);
            break;
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
