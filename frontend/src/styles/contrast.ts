/**
 * WCAG 2.1 contrast-ratio helpers.
 *
 * Implements the relative-luminance and contrast-ratio
 * formulas exactly as written in WCAG 2.1, so the assertions
 * in ``contrast.test.ts`` can prove the design tokens in
 * ``global.css`` meet AA (4.5:1 normal text, 3:1 large text +
 * UI components).
 *
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *            https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Parse a 3-digit or 6-digit hex color (with or without the
 * leading "#") into the {0..255, 0..255, 0..255} 8-bit channels.
 * Throws on invalid input — invalid color in production CSS is
 * a bug the caller wants to know about loudly.
 */
export function parseHex(input: string): RGB {
    const hex = input.trim().replace(/^#/, "");
    if (hex.length === 3) {
        return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
        };
    }
    if (hex.length === 6) {
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
        };
    }
    throw new Error(`Invalid hex color: ${input}`);
}

/**
 * Linearise a single sRGB 8-bit channel per the WCAG 2.1
 * specification.
 */
function srgbToLinear(channel8bit: number): number {
    const c = channel8bit / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance (L) for an sRGB color, per WCAG 2.1.
 */
export function relativeLuminance(color: RGB | string): number {
    const rgb = typeof color === "string" ? parseHex(color) : color;
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colors, in the 1..21 range. The
 * order of arguments is irrelevant; the formula always puts
 * the lighter color on top.
 */
export function contrastRatio(a: RGB | string, b: RGB | string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 AA threshold for normal text (anything not "large
 * text" per SC 1.4.3): 4.5:1.
 */
export const AA_NORMAL_TEXT = 4.5;

/**
 * WCAG 2.1 AA threshold for large text (>= 18pt OR >= 14pt
 * bold) AND for non-text UI components (SC 1.4.11): 3:1.
 */
export const AA_LARGE_TEXT_OR_UI = 3;

/**
 * Pick the best text color (pure black or pure white) for the
 * given background hex, by maximising contrast ratio. Used by
 * the method badges so each colored background gets the text
 * color that meets WCAG AA without changing the brand palette.
 */
export function bestTextOn(background: string): "#000000" | "#ffffff" {
    const onWhite = contrastRatio(background, "#ffffff");
    const onBlack = contrastRatio(background, "#000000");
    return onBlack >= onWhite ? "#000000" : "#ffffff";
}
