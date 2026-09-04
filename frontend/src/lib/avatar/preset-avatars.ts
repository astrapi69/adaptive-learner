/**
 * Preset avatar catalogue (#2848).
 *
 * Eight deterministic figure avatars, serialized as
 * ``data:image/svg+xml;utf8,...`` URLs (the ``placeholder-svg``
 * pattern) so they persist through the EXISTING avatar path
 * unchanged: ``UserSettings.avatar`` stores the same kind of
 * string an upload produces, both render sites keep their plain
 * ``<img src>``, and the ``.alb`` backup round-trips the value
 * inline (a utf8 SVG data URL is not externalised - pinned in
 * ``albContainer.test.ts``).
 *
 * Colors are BAKED hex values on purpose: CSS ``var()`` does not
 * resolve inside an ``<img>``-embedded SVG, and an avatar is user
 * DATA, not themeable chrome - the same design-token exemption
 * class as the user-tag seed colors and chart colors. Six hues
 * come from the canonical brand palette ({@link METHOD_COLORS});
 * the remaining two extend it in the same saturation family.
 *
 * Pure + deterministic: same id, byte-identical output.
 */

import {METHOD_COLORS} from "../constants";

export interface PresetAvatar {
    /** Stable id, also the i18n suffix (``settings.avatar_preset_<id>``). */
    id: string;
    /** Background hue behind the white figure. */
    background: string;
    /** SVG fragment(s) drawn inside the 64x64 viewBox. */
    figure: string;
}

const WHITE = "#FFFFFF";
// Extensions beyond the 6 method hues, same palette family
// (data colors, not chrome - see the module doc).
const PINK = "#EC4899";
const TEAL = "#14B8A6";

/** The catalogue, in gallery display order. */
export const PRESET_AVATARS: readonly PresetAvatar[] = [
    {
        id: "spark",
        background: METHOD_COLORS.contextual,
        figure:
            `<path fill="${WHITE}" d="M32 10c2 8 6 11 10 16 4 5 5 9 5 12a15 15 0 0 1-30 0c0-5 3-9 6-13 3-4 7-7 9-15z"/>` +
            `<path fill="${METHOD_COLORS.contextual}" d="M32 34c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9z"/>`,
    },
    {
        id: "robot",
        background: METHOD_COLORS.ai_adaptive,
        figure:
            `<rect x="30.75" y="10" width="2.5" height="8" fill="${WHITE}"/>` +
            `<circle cx="32" cy="10" r="3" fill="${WHITE}"/>` +
            `<rect x="16" y="20" width="32" height="26" rx="7" fill="${WHITE}"/>` +
            `<rect x="23" y="28" width="6" height="7" rx="1.5" fill="${METHOD_COLORS.ai_adaptive}"/>` +
            `<rect x="35" y="28" width="6" height="7" rx="1.5" fill="${METHOD_COLORS.ai_adaptive}"/>` +
            `<rect x="25" y="39" width="14" height="2.5" rx="1.25" fill="${METHOD_COLORS.ai_adaptive}"/>`,
    },
    {
        id: "star",
        background: METHOD_COLORS.inductive,
        figure:
            `<polygon fill="${WHITE}" points="32,12 37.9,25.4 52.5,26.9 41.5,36.6 44.6,50.9 32,43.5 19.4,50.9 22.5,36.6 11.5,26.9 26.1,25.4"/>`,
    },
    {
        id: "cat",
        background: METHOD_COLORS.dialogic,
        figure:
            `<polygon fill="${WHITE}" points="17,28 19,12 30,20"/>` +
            `<polygon fill="${WHITE}" points="47,28 45,12 34,20"/>` +
            `<circle cx="32" cy="35" r="17" fill="${WHITE}"/>` +
            `<circle cx="25.5" cy="32" r="2.5" fill="${METHOD_COLORS.dialogic}"/>` +
            `<circle cx="38.5" cy="32" r="2.5" fill="${METHOD_COLORS.dialogic}"/>` +
            `<path d="M28 41q4 3 8 0" stroke="${METHOD_COLORS.dialogic}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    },
    {
        id: "owl",
        background: METHOD_COLORS.deductive,
        figure:
            `<circle cx="23" cy="29" r="11" fill="${WHITE}"/>` +
            `<circle cx="41" cy="29" r="11" fill="${WHITE}"/>` +
            `<circle cx="23" cy="29" r="4" fill="${METHOD_COLORS.deductive}"/>` +
            `<circle cx="41" cy="29" r="4" fill="${METHOD_COLORS.deductive}"/>` +
            `<polygon fill="${WHITE}" points="32,38 27,46 37,46"/>`,
    },
    {
        id: "ghost",
        background: PINK,
        figure:
            `<path fill="${WHITE}" d="M18 52V30a14 14 0 0 1 28 0v22l-4.7-4-4.6 4-4.7-4-4.7 4-4.6-4z"/>` +
            `<circle cx="26" cy="30" r="2.8" fill="${PINK}"/>` +
            `<circle cx="38" cy="30" r="2.8" fill="${PINK}"/>`,
    },
    {
        id: "bolt",
        background: TEAL,
        figure:
            `<polygon fill="${WHITE}" points="37,9 19,36 30,36 27,55 45,28 34,28"/>`,
    },
    {
        id: "heart",
        background: METHOD_COLORS.error_based,
        figure:
            `<path fill="${WHITE}" d="M32 50C19 40 14 31 19 23.5 23.5 17 32 19 32 26c0-7 8.5-9 13-2.5C50 31 45 40 32 50z"/>`,
    },
];

/** Build the full SVG markup for ``preset``. */
function presetSvg(preset: PresetAvatar): string {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
        `<circle cx="32" cy="32" r="32" fill="${preset.background}"/>` +
        preset.figure +
        `</svg>`
    );
}

/**
 * The persistable data URL for the preset with ``id``.
 *
 * Throws on an unknown id so a typo fails loudly instead of
 * storing a broken image in ``UserSettings.avatar``.
 */
export function presetAvatarDataUrl(id: string): string {
    const preset = PRESET_AVATARS.find((p) => p.id === id);
    if (!preset) {
        throw new Error(`Unknown preset avatar id: ${id}`);
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(presetSvg(preset))}`;
}

/**
 * Whether ``value`` is one of the preset figures' data URLs (#2862).
 *
 * The photo-replace confirmation needs to tell an uploaded photo
 * (any other non-empty avatar value) apart from a previously chosen
 * figure - switching figure to figure never asks.
 */
export function isPresetAvatarDataUrl(
    value: string | null | undefined,
): boolean {
    if (!value) return false;
    return PRESET_AVATARS.some((p) => presetAvatarDataUrl(p.id) === value);
}
